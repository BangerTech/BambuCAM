import { useEffect } from 'react';

export const useVisibilityChange = (onVisibilityChange) => {
  useEffect(() => {
    // Temporär deaktiviert für Tests
    // const handleVisibilityChange = () => {
    //   onVisibilityChange(!document.hidden);
    // };
    //
    // document.addEventListener('visibilitychange', handleVisibilityChange);
    //
    // return () => {
    //   document.removeEventListener('visibilitychange', handleVisibilityChange);
    // };
  }, [onVisibilityChange]);
}; 