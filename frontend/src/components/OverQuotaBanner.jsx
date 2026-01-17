import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useQuota } from '../hooks/useQuota';

const OverQuotaBanner = ({ onUpgrade, onDismiss, workspaceId = null }) => {
  const { quotaData, isOverQuota } = useQuota(workspaceId);
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || !quotaData || !isOverQuota()) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <Alert variant="destructive" className="mb-4 border-2 border-destructive/50">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="flex items-center justify-between">
        <span>Storage Quota Exceeded</span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>
          You have exceeded your storage quota. You cannot upload new files until you delete some files or upgrade your plan.
        </span>
        {onUpgrade && (
          <Button
            size="sm"
            onClick={onUpgrade}
            className="shrink-0"
          >
            Upgrade Plan
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default OverQuotaBanner;
