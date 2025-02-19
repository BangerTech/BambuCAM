import { useEffect } from 'react';

export const useVisibilityChange = (onVisible) => {
  useEffect(() => {
    let lastHidden = document.hidden;

    const handleVisibilityChange = () => {
      // Wenn die Seite vorher hidden war und jetzt wieder sichtbar ist
      if (lastHidden && !document.hidden) {
        onVisible();
      }
      lastHidden = document.hidden;
    };

    // Event Listener für Visibility Change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onVisible]);
}; 