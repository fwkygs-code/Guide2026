export interface WalkthroughStep {
  id: string;
  index: number;
  title: string;
  description: string;
  targeting: {
    selector: string;
  };
}

export interface WalkthroughDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WalkthroughStep[];
}

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
        selector: 'body'
      }
    },
    {
      id: 'step-2',
      index: 1,
      title: 'Step 2: Target Element',
      description: 'This step targets a specific element. Notice how the spotlight highlights it.',
      targeting: {
        selector: 'h1'
      }
    },
    {
      id: 'step-3',
      index: 2,
      title: 'Final Step',
      description: 'This is the final step. Click Finish to complete the walkthrough.',
      targeting: {
        selector: 'body'
      }
    }
  ]
};
