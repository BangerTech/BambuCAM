import { useEffect } from 'react';

// Zeit in Millisekunden, nach der die Seite neu geladen wird
const VISIBILITY_TIMEOUT = 2 * 60 * 1000; // 2 Minuten

export const useVisibilityChange = (onVisible) => {
  useEffect(() => {
    let lastHidden = document.hidden;
    let setLastHidden = (value) => {
      lastHidden = value;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setLastHidden(Date.now());
      } else {
        const hiddenDuration = Date.now() - lastHidden;
        if (hiddenDuration > VISIBILITY_TIMEOUT) {
          // Prüfe ob Login-Dialog offen ist
          const isLoginActive = document.querySelector('[role="dialog"]');
          if (isLoginActive) {
            return; // Keine Neuladen während Login
          }
          window.location.reload();
        }
      }
    };

    // Event Listener für Visibility Change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onVisible]);
}; 