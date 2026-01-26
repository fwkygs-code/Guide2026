import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const WorkspaceLockModal = ({ open, onOpenChange, lockedBy, onCancel, onEnterAnyway }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <DialogTitle>Workspace Currently in Use</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            <p className="text-sm text-muted-foreground">
              <strong>{lockedBy}</strong> is currently connected to this workspace.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Entering will force the other user out and may cause data loss if their progress isn't saved.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onEnterAnyway}>
            Enter Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkspaceLockModal;
