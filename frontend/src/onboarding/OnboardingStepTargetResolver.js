import { useEffect, useRef, useState } from 'react';

const normalizeRect = (rect) => ({
  top: rect.top,
  left: rect.left,
  right: rect.right,
  bottom: rect.bottom,
  width: rect.width,
  height: rect.height
});

const isSameRect = (a, b) => (
  a &&
  b &&
  a.top === b.top &&
  a.left === b.left &&
  a.right === b.right &&
  a.bottom === b.bottom &&
  a.width === b.width &&
  a.height === b.height
);

export const useTargetRect = (selector, enabled = true) => {
  const [rect, setRect] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const rafRef = useRef(null);
  const lastRectRef = useRef(null);

  useEffect(() => {
    if (!enabled || !selector || typeof document === 'undefined') {
      setRect(null);
      setIsReady(false);
      return undefined;
    }

    const updateRect = () => {
      const selectors = Array.isArray(selector) ? selector : [selector];
      const element = selectors.map((item) => document.querySelector(item)).find(Boolean);
      if (!element) {
        setIsReady(false);
        setRect(null);
        lastRectRef.current = null;
        return;
      }
      const nextRect = normalizeRect(element.getBoundingClientRect());
      if (!isSameRect(nextRect, lastRectRef.current)) {
        lastRectRef.current = nextRect;
        setRect(nextRect);
      }
      setIsReady(true);
    };

    const scheduleUpdate = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updateRect);
    };

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);

    updateRect();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [selector, enabled]);

  return { rect, isReady };
};
