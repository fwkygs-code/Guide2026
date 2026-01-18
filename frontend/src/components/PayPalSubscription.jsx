import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

// PayPal configuration from environment variables
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || '';
const PAYPAL_PLAN_ID = process.env.REACT_APP_PAYPAL_PLAN_ID || 'P-96597808B1860013DNFWI6KI';

if (!PAYPAL_CLIENT_ID) {
  console.error('REACT_APP_PAYPAL_CLIENT_ID environment variable is not set');
}

const PayPalSubscription = ({ onSuccess, onCancel, isSubscribing, setIsSubscribing }) => {
  const paypalButtonContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const [paypalButtons, setPaypalButtons] = useState(null);

  useEffect(() => {
    // Load PayPal SDK script
    if (!PAYPAL_CLIENT_ID) {
      toast.error('PayPal is not configured. Please contact support.');
      return;
    }
    
    if (!paypalScriptLoaded.current && paypalButtonContainerRef.current) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
      script.async = true;
      script.onload = () => {
        paypalScriptLoaded.current = true;
        initializePayPalButtons();
      };
      script.onerror = () => {
        toast.error('Failed to load PayPal SDK. Please refresh the page.');
      };
      document.body.appendChild(script);

      return () => {
        // Cleanup: remove script if component unmounts
        const existingScript = document.querySelector(`script[src*="paypal.com/sdk"]`);
        if (existingScript) {
          existingScript.remove();
        }
        paypalScriptLoaded.current = false;
      };
    } else if (paypalScriptLoaded.current && window.paypal && paypalButtonContainerRef.current && !paypalButtons) {
      // Script already loaded, initialize buttons
      initializePayPalButtons();
    }
  }, [paypalButtonContainerRef.current]);

  const initializePayPalButtons = () => {
    if (!window.paypal || !paypalButtonContainerRef.current || paypalButtons) {
      return;
    }

    try {
      const buttons = window.paypal.Buttons({
        style: {
          shape: 'pill',
          color: 'gold',
          layout: 'vertical',
          label: 'subscribe'
        },
        createSubscription: function(data, actions) {
          setIsSubscribing(true);
          return actions.subscription.create({
            plan_id: PAYPAL_PLAN_ID
          });
        },
        onApprove: async function(data, actions) {
          try {
            const subscriptionID = data.subscriptionID;
            
            // Send subscription ID to backend
            const response = await api.subscribePayPal({ subscriptionID });
            
            if (response.data && response.data.success) {
              toast.success('Subscription created successfully! Your Pro access will be activated shortly.');
              if (onSuccess) {
                onSuccess(subscriptionID);
              }
            } else {
              toast.error('Subscription created but failed to activate. Please contact support.');
            }
          } catch (error) {
            console.error('PayPal subscription approval error:', error);
            toast.error(error.response?.data?.detail || 'Failed to activate subscription. Please contact support.');
          } finally {
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

      if (paypalButtonContainerRef.current) {
        buttons.render(paypalButtonContainerRef.current).then(() => {
          setPaypalButtons(buttons);
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
      <div 
        id="paypal-button-container" 
        ref={paypalButtonContainerRef}
        className="w-full min-h-[200px] flex items-center justify-center"
      >
        {!paypalScriptLoaded.current && (
          <div className="text-slate-500 text-sm">Loading PayPal...</div>
        )}
      </div>
      {isSubscribing && (
        <p className="text-xs text-slate-500 mt-2 text-center">
          Processing subscription...
        </p>
      )}
    </div>
  );
};

export default PayPalSubscription;
