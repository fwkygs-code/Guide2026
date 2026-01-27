import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

// PayPal configuration from environment variables
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || '';
const PAYPAL_PLAN_ID = process.env.REACT_APP_PAYPAL_PLAN_ID || 'P-96597808B1860013DNFWI6KI';

if (!PAYPAL_CLIENT_ID) {
  console.error('REACT_APP_PAYPAL_CLIENT_ID environment variable is not set');
}

const PayPalSubscription = ({ onSuccess, onCancel, isSubscribing, setIsSubscribing, refreshQuota, planType = 'pro' }) => {
  const paypalButtonContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const [paypalButtons, setPaypalButtons] = useState(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false); // Track if payment was completed
  const [pollingActive, setPollingActive] = useState(false); // Track if polling is active
  const pollingIntervalRef = useRef(null); // Store polling interval

  // PRODUCTION HARDENING: Poll reconciliation endpoint until PayPal confirms state
  const startPollingForActivation = () => {
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max with base interval
    let currentInterval = 2000; // Start at 2 seconds
    const baseInterval = 2000;
    const maxInterval = 16000; // Max 16 seconds
    let consecutiveRateLimits = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        // Timeout - stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setPollingActive(false);
        setIsSubscribing(false);
        toast.info('Subscription is being processed. Please refresh the page to check status.');
        // Close modal on timeout
        if (onSuccess) {
          onSuccess(null);
        }
        return;
      }
      
      attempts++;
      
      try {
        // PRODUCTION HARDENING: Call reconciliation endpoint (backend queries PayPal directly)
        const response = await api.reconcileSubscription();
        const reconcileData = response.data;
        
        // Reset backoff on successful response
        consecutiveRateLimits = 0;
        currentInterval = baseInterval;
        
        // Log reconciliation result for debugging
        console.log('[POLL] Reconciliation result:', reconcileData);
        
        if (reconcileData.success) {
          const { access_granted, is_terminal_for_polling, paypal_status, access_reason } = reconcileData;
          
          // PRODUCTION RULE: Stop polling if access granted OR terminal-for-polling
          if (access_granted) {
            // Access granted - PayPal confirmed activation
            console.log('[APPROVAL HIT]', Date.now());
            console.log('[RELOAD CALLED]');
            
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            
            toast.success('Pro access activated! Welcome to Pro plan.');
            
            // CRITICAL: Navigate immediately, synchronously, unconditionally
            // Do NOT call onSuccess, do NOT use setTimeout, do NOT await anything
            // This guarantees convergence even if React state is corrupted
            window.location.replace(window.location.pathname);
            return;
            
          } else if (is_terminal_for_polling) {
            // Terminal-for-polling reached but no access
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setPollingActive(false);
            setIsSubscribing(false);
            
            toast.error(`Subscription ${paypal_status?.toLowerCase()}: ${access_reason}`);
            
            if (onSuccess) {
              onSuccess(null);
            }
          }
          // Otherwise continue polling (non-terminal-for-polling, no access yet)
        } else {
          // CRITICAL: Reconciliation failed (PayPal API error)
          console.error('[POLL] Reconciliation failed:', reconcileData.error);
          
          // If we've failed multiple times, stop polling and show error
          if (attempts >= 3) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setPollingActive(false);
            setIsSubscribing(false);
            
            toast.error(
              'Unable to verify subscription with PayPal. Please refresh the page in a few moments.',
              { duration: 8000 }
            );
            
            // Auto-refresh after 5 seconds to check if it resolved
            setTimeout(() => {
              window.location.reload();
            }, 5000);
            
            return;
          }
          // Continue polling for first 2 failures (might be temporary)
        }
      } catch (error) {
        console.error('[POLL] Error:', error);
        
        // PRODUCTION HARDENING: Exponential backoff ONLY for 429 (transport-level)
        if (error.response?.status === 429) {
          consecutiveRateLimits++;
          currentInterval = Math.min(currentInterval * 2, maxInterval);
          console.log(`[POLL] Rate limited (${consecutiveRateLimits}x), backing off to ${currentInterval}ms`);
          
          // Restart interval with new backoff
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          pollingIntervalRef.current = setInterval(poll, currentInterval);
        }
        // Continue polling on other errors (no backoff)
      }
    };
    
    // Start polling immediately, then every 2 seconds (or current backoff interval)
    poll();
    pollingIntervalRef.current = setInterval(poll, currentInterval);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Load PayPal SDK script
    if (!PAYPAL_CLIENT_ID) {
      toast.error('PayPal is not configured. Please contact support.');
      return;
    }
    
    // Only initialize when container ref is available
    if (!paypalButtonContainerRef.current) {
      return;
    }
    
    // Prevent double initialization
    if (paypalButtons) {
      return;
    }
    
    // Load script if not already loaded
    if (!paypalScriptLoaded.current) {
      // Check if script already exists in DOM (from previous mount)
      const existingScript = document.querySelector(`script[src*="paypal.com/sdk"]`);
      if (existingScript) {
        paypalScriptLoaded.current = true;
        // Wait for window.paypal to be available
        const checkPayPal = setInterval(() => {
          if (window.paypal && paypalButtonContainerRef.current && !paypalButtons) {
            clearInterval(checkPayPal);
            initializePayPalButtons();
          }
        }, 100);
        return () => clearInterval(checkPayPal);
      }
      
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
      script.async = true;
      script.onload = () => {
        paypalScriptLoaded.current = true;
        if (paypalButtonContainerRef.current && !paypalButtons) {
          initializePayPalButtons();
        }
      };
      script.onerror = () => {
        toast.error('Failed to load PayPal SDK. Please refresh the page.');
        paypalScriptLoaded.current = false;
      };
      document.body.appendChild(script);
      // CRITICAL: Never remove script - it must persist
    } else if (window.paypal && paypalButtonContainerRef.current && !paypalButtons) {
      // Script already loaded, initialize buttons
      initializePayPalButtons();
    }
    
    // CRITICAL: No cleanup on unmount - PayPal SDK manages its own DOM
    // Removing cleanup prevents removeChild errors
    return () => {
      // Cleanup polling on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [paypalButtons]);

  const initializePayPalButtons = () => {
    // CRITICAL: Prevent double initialization
    if (!window.paypal || !paypalButtonContainerRef.current || paypalButtons) {
      return;
    }

    try {
      // Clear container before rendering (only if empty)
      if (paypalButtonContainerRef.current && paypalButtonContainerRef.current.children.length === 0) {
        paypalButtonContainerRef.current.innerHTML = '';
      }
      
      const buttons = window.paypal.Buttons({
        style: {
          shape: 'pill',
          color: 'gold',
          layout: 'vertical',
          label: 'subscribe'
        },
        createSubscription: function(data, actions) {
          setIsSubscribing(true);
          // Always use production PayPal plan ID
          return actions.subscription.create({
            plan_id: PAYPAL_PLAN_ID
          });
        },
        onApprove: async function(data, actions) {
          // CRITICAL: Mark payment as completed immediately to prevent duplicate clicks
          setPaymentCompleted(true);
          setIsSubscribing(true);
          
          try {
            const subscriptionID = data.subscriptionID;
            
            // Send subscription ID to backend
            const response = await api.subscribePayPal({ subscriptionID });
            
            if (response.data && response.data.success) {
              toast.success('Subscription created successfully! Waiting for activation...');
              
              // Start polling for subscription activation
              setPollingActive(true);
              startPollingForActivation();
            } else {
              toast.error('Subscription created but failed to activate. Please contact support.');
              setPaymentCompleted(false); // Allow retry on error
              setIsSubscribing(false);
            }
          } catch (error) {
            console.error('PayPal subscription approval error:', error);
            toast.error(error.response?.data?.detail || 'Failed to activate subscription. Please contact support.');
            setPaymentCompleted(false); // Allow retry on error
            setIsSubscribing(false);
          }
        },
        onCancel: function(data) {
          setIsSubscribing(false);
          if (onCancel) {
            onCancel();
          }
        },
        onError: function(err) {
          console.error('PayPal error:', err);
          setIsSubscribing(false);
          toast.error('An error occurred with PayPal. Please try again.');
        }
      });

      // CRITICAL: Only render if container still exists and buttons not already set
      if (paypalButtonContainerRef.current && !paypalButtons) {
        buttons.render(paypalButtonContainerRef.current).then(() => {
          // Only set if still not initialized (prevent race conditions)
          if (!paypalButtons) {
            setPaypalButtons(buttons);
          }
        }).catch((err) => {
          console.error('PayPal button render error:', err);
          toast.error('Failed to render PayPal button. Please refresh the page.');
        });
      }
    } catch (error) {
      console.error('PayPal initialization error:', error);
      toast.error('Failed to initialize PayPal. Please refresh the page.');
    }
  };

  return (
    <div className="w-full">
      {paymentCompleted ? (
        <div className="w-full min-h-[200px] flex items-center justify-center flex-col space-y-2">
          <div className="text-green-600 text-sm font-medium">✓ Subscription submitted successfully!</div>
          <div className="text-xs text-muted-foreground text-center">
            {pollingActive ? (
              <>
                Waiting for activation...<br/>
                This may take a few seconds.
              </>
            ) : (
              <>
                Your Pro access will be activated shortly.<br/>
                Please wait for webhook confirmation.
              </>
            )}
          </div>
          {pollingActive && (
            <div className="mt-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div 
            id="paypal-button-container" 
            ref={paypalButtonContainerRef}
            className="w-full min-h-[200px] flex items-center justify-center"
            style={{ pointerEvents: isSubscribing ? 'none' : 'auto', opacity: isSubscribing ? 0.6 : 1 }}
          >
            {!paypalScriptLoaded.current && (
              <div className="text-muted-foreground text-sm">Loading PayPal...</div>
            )}
          </div>
          {isSubscribing && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Processing subscription...
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default PayPalSubscription;
