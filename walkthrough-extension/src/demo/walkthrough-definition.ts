import { WalkthroughDefinition } from '../types';

export const DEMO_WALKTHROUGH: WalkthroughDefinition = {
  id: 'demo-walkthrough',
  name: 'Demo Walkthrough',
  description: 'A simple demonstration walkthrough',
  version: '1.0.0',
  steps: [
    {
      id: 'step-1',
      index: 0,
      title: 'Welcome to the Demo',
      description: 'This is a simple walkthrough demonstration. Click Next to continue.',
      targeting: {
        selector: 'body',
        constraints: {
          mustBeVisible: true,
          mustBeInteractable: true,
          mustBeInViewport: true
        },
        search: {
          timeout: 5000,
          maxRetries: 3,
          searchScope: 'document'
        }
      },
      validation: {
        completion: {
          type: 'click',
          requireInteraction: true,
          interactionTimeout: 30000
        },
        state: {
          validateBeforeStep: true,
          validateAfterStep: true,
          strictValidation: true
        }
      },
      behavior: {
        blocking: {
          blockNavigation: false,
          blockScrolling: true,
          blockClicks: true,
          allowEscKey: true
        },
        autoAdvance: {
          enabled: false,
          delay: 0,
          requireValidation: true
        },
        retry: {
          enabled: true,
          maxAttempts: 3,
          backoffStrategy: 'linear',
          retryDelay: 1000
        },
        skip: {
          allowSkip: true,
          skipKey: 's',
          requireConfirmation: false
        }
      },
      ui: {
        position: 'center',
        offset: { x: 0, y: 0 },
        width: 400,
        showProgress: true,
        showSkip: true,
        showPrevious: false,
        showNext: true,
        showClose: true,
        animation: {
          type: 'fade',
          duration: 300,
          easing: 'ease-in-out'
        }
      }
    },
    {
      id: 'step-2',
      index: 1,
      title: 'Step 2: Target Element',
      description: 'This step targets a specific element. Notice how the spotlight highlights it.',
      targeting: {
        selector: 'h1',
        constraints: {
          mustBeVisible: true,
          mustBeInteractable: true,
          mustBeInViewport: true
        },
        search: {
          timeout: 5000,
          maxRetries: 3,
          searchScope: 'document'
        }
      },
      validation: {
        completion: {
          type: 'click',
          requireInteraction: true,
          interactionTimeout: 30000
        },
        state: {
          validateBeforeStep: true,
          validateAfterStep: true,
          strictValidation: true
        }
      },
      behavior: {
        blocking: {
          blockNavigation: false,
          blockScrolling: true,
          blockClicks: true,
          allowEscKey: true
        },
        autoAdvance: {
          enabled: false,
          delay: 0,
          requireValidation: true
        },
        retry: {
          enabled: true,
          maxAttempts: 3,
          backoffStrategy: 'linear',
          retryDelay: 1000
        },
        skip: {
          allowSkip: true,
          skipKey: 's',
          requireConfirmation: false
        }
      },
      ui: {
        position: 'bottom',
        offset: { x: 0, y: 20 },
        width: 350,
        showProgress: true,
        showSkip: true,
        showPrevious: true,
        showNext: true,
        showClose: true,
        animation: {
          type: 'slide',
          duration: 300,
          easing: 'ease-in-out'
        }
      }
    },
    {
      id: 'step-3',
      index: 2,
      title: 'Final Step',
      description: 'This is the final step. Click Finish to complete the walkthrough.',
      targeting: {
        selector: 'body',
        constraints: {
          mustBeVisible: true,
          mustBeInteractable: true,
          mustBeInViewport: true
        },
        search: {
          timeout: 5000,
          maxRetries: 3,
          searchScope: 'document'
        }
      },
      validation: {
        completion: {
          type: 'click',
          requireInteraction: true,
          interactionTimeout: 30000
        },
        state: {
          validateBeforeStep: true,
          validateAfterStep: true,
          strictValidation: true
        }
      },
      behavior: {
        blocking: {
          blockNavigation: false,
          blockScrolling: true,
          blockClicks: true,
          allowEscKey: true
        },
        autoAdvance: {
          enabled: false,
          delay: 0,
          requireValidation: true
        },
        retry: {
          enabled: true,
          maxAttempts: 3,
          backoffStrategy: 'linear',
          retryDelay: 1000
        },
        skip: {
          allowSkip: true,
          skipKey: 's',
          requireConfirmation: false
        }
      },
      ui: {
        position: 'center',
        offset: { x: 0, y: 0 },
        width: 400,
        showProgress: true,
        showSkip: false,
        showPrevious: true,
        showNext: false,
        showClose: true,
        animation: {
          type: 'fade',
          duration: 300,
          easing: 'ease-in-out'
        }
      }
    }
  ],
  configuration: {
    autoStart: false,
    showProgress: true,
    allowSkip: true,
    allowRestart: true,
    allowClose: true,
    keyboardNavigation: true,
    autoScroll: true,
    overlay: {
      opacity: 0.7,
      blur: false,
      animation: {
        type: 'fade',
        duration: 300,
        easing: 'ease-in-out'
      }
    },
    spotlight: {
      padding: 10,
      borderRadius: 8,
      animation: {
        type: 'scale',
        duration: 300,
        easing: 'ease-in-out'
      }
    },
    errorHandling: {
      showErrors: true,
      allowRetry: true,
      maxRetries: 3,
      fallbackStrategy: 'skip'
    }
  }
};
