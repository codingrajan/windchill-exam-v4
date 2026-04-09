import { useEffect } from 'react';
import { auth } from '../services/firebase';
import { isAdminEmail } from '../services/authz';

export function useContentProtection(enabled = true) {
  useEffect(() => {
    const admin = isAdminEmail(auth.currentUser?.email);
    if (!enabled || admin) return;

    const prevent = (event: Event) => {
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (['c', 'p', 's', 'u'].includes(key)) {
        event.preventDefault();
      }
    };

    const onBeforePrint = () => {
      document.body.classList.add('participant-print-blocked');
    };

    const onAfterPrint = () => {
      document.body.classList.remove('participant-print-blocked');
    };

    document.body.classList.add('participant-protected');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('contextmenu', prevent);
    window.addEventListener('copy', prevent);
    window.addEventListener('cut', prevent);
    window.addEventListener('dragstart', prevent);
    window.addEventListener('selectstart', prevent);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      document.body.classList.remove('participant-protected');
      document.body.classList.remove('participant-print-blocked');
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('contextmenu', prevent);
      window.removeEventListener('copy', prevent);
      window.removeEventListener('cut', prevent);
      window.removeEventListener('dragstart', prevent);
      window.removeEventListener('selectstart', prevent);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [enabled]);
}
