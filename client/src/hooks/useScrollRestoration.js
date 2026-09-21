import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Remember scroll position per history entry so "Back" from a movie lands where the user left off.
 * react-query keeps the loaded pages in memory, so the content height exists again when we restore.
 */
export function useScrollRestoration(ready) {
  const { key } = useLocation();
  const storageKey = `reel:scroll:${key}`;
  const restored = useRef(false);

  useEffect(() => {
    let raf = 0;
    const save = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(storageKey, String(window.scrollY));
        } catch {
          /* storage unavailable: skip */
        }
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      window.removeEventListener('scroll', save);
      cancelAnimationFrame(raf);
    };
  }, [storageKey]);

  useLayoutEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    let y = 0;
    try {
      y = Number(sessionStorage.getItem(storageKey)) || 0;
    } catch {
      /* storage unavailable: start at top */
    }
    window.scrollTo(0, y);
  }, [ready, storageKey]);
}
