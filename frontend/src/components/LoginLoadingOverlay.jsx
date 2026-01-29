import React, { useEffect, useRef, useState } from 'react';

const MIN_DISPLAY_MS = 1200;
const MAX_DISPLAY_MS = 8000;
const FADE_DURATION_MS = 400;

const LoginLoadingOverlay = ({ active, ready, onFinish }) => {
  const [visible, setVisible] = useState(active);
  const [fading, setFading] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const startTimeRef = useRef(0);
  const fadeTimeoutRef = useRef(null);
  const maxTimeoutRef = useRef(null);
  const unmountTimeoutRef = useRef(null);
  const overflowRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setReducedMotion(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const requestClose = () => {
    if (fading) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = Math.max(0, now - startTimeRef.current);
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      setFading(true);
      if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
      unmountTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setFading(false);
        if (onFinish) onFinish();
      }, FADE_DURATION_MS);
    }, remaining);
  };

  useEffect(() => {
    if (!active) {
      setVisible(false);
      setFading(false);
      return;
    }
    setVisible(true);
    setFading(false);
    startTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (typeof document !== 'undefined') {
      overflowRef.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
    maxTimeoutRef.current = setTimeout(() => {
      requestClose();
    }, MAX_DISPLAY_MS);
    return () => {
      if (typeof document !== 'undefined' && overflowRef.current !== null) {
        document.body.style.overflow = overflowRef.current;
      }
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
      if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !visible) return;
    if (ready) {
      requestClose();
    }
  }, [active, ready, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      style={{
        backgroundColor: 'rgb(15, 23, 42)',
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms ease`
      }}
      aria-hidden="true"
    >
      {reducedMotion ? (
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="h-12 w-12 rounded-full border-2 border-primary/60 border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      ) : (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={requestClose}
        >
          <source src="/Animation.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
};

export default LoginLoadingOverlay;
