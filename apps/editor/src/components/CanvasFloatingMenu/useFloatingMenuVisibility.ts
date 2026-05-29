import { useCallback, useRef, useState } from 'react';

export function useFloatingMenuVisibility() {
  const hiddenRef = useRef(false);
  const [hidden, setHidden] = useState(false);

  const setHiddenSafely = useCallback((next: boolean) => {
    if (hiddenRef.current === next) return;
    hiddenRef.current = next;
    setHidden(next);
  }, []);

  const show = useCallback(() => setHiddenSafely(false), [setHiddenSafely]);
  const hide = useCallback(() => setHiddenSafely(true), [setHiddenSafely]);
  const reset = useCallback(() => {
    hiddenRef.current = false;
    setHidden(false);
  }, []);

  return { hidden, show, hide, reset };
}
