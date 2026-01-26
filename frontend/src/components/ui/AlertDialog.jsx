import React from 'react';
import {
  AlertDialog as AlertDialogPrimitive,
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
 * AlertDialog - Translated replacement for window.alert()
 * 
 * Architectural enforcement: All alerts must use this component.
 * Browser-native dialogs are forbidden for translation integrity.
 * 
 * @param {boolean} open - Dialog open state
 * @param {function} onOpenChange - State change handler
 * @param {string} titleKey - Translation key for title
 * @param {string} descriptionKey - Translation key for description
 * @param {object} values - Interpolation values for translation
 * @param {function} onClose - Callback when user closes
 * @param {string} closeTextKey - Translation key for close button (default: 'common.close')
 */
export function AlertDialog({
  open,
  onOpenChange,
  titleKey,
  descriptionKey,
  values = {},
  onClose,
  closeTextKey = 'common.close'
}) {
  const { t } = useTranslation();

  const handleClose = () => {
    if (onClose) onClose();
    onOpenChange(false);
  };

  return (
    <AlertDialogPrimitive open={open} onOpenChange={onOpenChange}>
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
          <AlertDialogAction onClick={handleClose}>
            {t(closeTextKey)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialogPrimitive>
  );
}

/**
 * useAlert - Hook for programmatic alert dialogs
 * 
 * Usage:
 * const alert = useAlert();
 * await alert({
 *   titleKey: 'dialogs.alert.noSupportContact',
 *   descriptionKey: 'dialogs.alert.noSupportContactDescription'
 * });
 */
export function useAlert() {
  const [state, setState] = React.useState({
    open: false,
    titleKey: '',
    descriptionKey: '',
    values: {},
    resolve: null
  });

  const alert = React.useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        titleKey: options.titleKey,
        descriptionKey: options.descriptionKey,
        values: options.values || {},
        closeTextKey: options.closeTextKey,
        resolve
      });
    });
  }, []);

  const handleClose = React.useCallback(() => {
    if (state.resolve) state.resolve();
    setState(prev => ({ ...prev, open: false }));
  }, [state.resolve]);

  const dialog = (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open && state.resolve) {
          state.resolve();
        }
        setState(prev => ({ ...prev, open }));
      }}
      titleKey={state.titleKey}
      descriptionKey={state.descriptionKey}
      values={state.values}
      onClose={handleClose}
      closeTextKey={state.closeTextKey}
    />
  );

  return { alert, dialog };
}

export default AlertDialog;
