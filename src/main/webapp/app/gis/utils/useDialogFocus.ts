import { useEffect, useRef } from 'react';

/** Scope keyboard handling to the topmost dialog, including nested capture dialogs. */
export function useDialogFocus(open: boolean, onClose: () => void, busy = false) {
  const ref = useRef<HTMLDivElement>(null);
  const handlersRef = useRef({ onClose, busy });
  useEffect(() => {
    handlersRef.current = { onClose, busy };
  }, [onClose, busy]);
  useEffect(() => {
    if (!open) return undefined;
    const element = ref.current;
    if (!element) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    element.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!element.contains(event.target as Node)) return;
      // A non-modal panel (the map record drawer) answers only while no modal dialog is open, and does not trap Tab.
      const modal = element.getAttribute('aria-modal') !== 'false';
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      if (modal ? dialogs[dialogs.length - 1] !== element : dialogs.length > 0) return;
      if (event.key === 'Escape' && !handlersRef.current.busy) {
        event.preventDefault();
        event.stopPropagation();
        handlersRef.current.onClose();
      }
      if (event.key !== 'Tab' || !modal) return;
      const controls = Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter(control => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
