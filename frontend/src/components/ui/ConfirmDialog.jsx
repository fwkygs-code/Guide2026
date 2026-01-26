import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

/**
 * ConfirmDialog - Translated replacement for window.confirm()
 * 
 * Architectural enforcement: All confirmations must use this component.
 * Browser-native dialogs are forbidden for translation integrity.
 * 
 * @param {boolean} open - Dialog open state
 * @param {function} onOpenChange - State change handler
 * @param {string} titleKey - Translation key for title
 * @param {string} descriptionKey - Translation key for description
 * @param {object} values - Interpolation values for translation
 * @param {function} onConfirm - Callback when user confirms
 * @param {function} onCancel - Callback when user cancels (optional)
 * @param {string} confirmTextKey - Translation key for confirm button (default: 'common.confirm')
 * @param {string} cancelTextKey - Translation key for cancel button (default: 'common.cancel')
 * @param {string} variant - Button variant: 'default' | 'destructive' (default: 'default')
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  titleKey,
  descriptionKey,
  values = {},
  onConfirm,
  onCancel,
  confirmTextKey = 'common.confirm',
  cancelTextKey = 'common.cancel',
  variant = 'default'
}) {
  const { t } = useTranslation();

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(titleKey, values)}</AlertDialogTitle>
          {descriptionKey && (
            <AlertDialogDescription>
              {t(descriptionKey, values)}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {t(cancelTextKey)}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {t(confirmTextKey)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * useConfirm - Hook for programmatic confirmation dialogs
 * 
 * Usage:
 * const confirm = useConfirm();
 * const result = await confirm({
 *   titleKey: 'dialogs.confirm.deleteBlock',
 *   descriptionKey: 'dialogs.confirm.deleteBlockDescription',
 *   variant: 'destructive'
 * });
 * if (result) { // user confirmed }
 */
export function useConfirm() {
  const [state, setState] = React.useState({
    open: false,
    titleKey: '',
    descriptionKey: '',
    values: {},
    variant: 'default',
    resolve: null
  });

  const confirm = React.useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        titleKey: options.titleKey,
        descriptionKey: options.descriptionKey,
        values: options.values || {},
        variant: options.variant || 'default',
        confirmTextKey: options.confirmTextKey,
        cancelTextKey: options.cancelTextKey,
        resolve
      });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    if (state.resolve) state.resolve(true);
    setState(prev => ({ ...prev, open: false }));
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    if (state.resolve) state.resolve(false);
    setState(prev => ({ ...prev, open: false }));
  }, [state.resolve]);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open && state.resolve) {
          state.resolve(false);
        }
        setState(prev => ({ ...prev, open }));
      }}
      titleKey={state.titleKey}
      descriptionKey={state.descriptionKey}
      values={state.values}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmTextKey={state.confirmTextKey}
      cancelTextKey={state.cancelTextKey}
      variant={state.variant}
    />
  );

  return { confirm, dialog };
}

export default ConfirmDialog;
