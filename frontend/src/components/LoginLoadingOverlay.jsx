import React, { useEffect, useRef, useState, useCallback } from 'react';
import { INTERGUIDE_MAIN_ANIMATION_URL, INTERGUIDE_LOGO_MAIN_280_URL } from '../utils/logo';

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

  const requestClose = useCallback(() => {
    if (fading) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = Math.max(0, now - startTimeRef.current);
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    const finish = () => {
      setFading(true);
      fadeTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setFading(false);
        if (onFinish) onFinish();
      }, FADE_DURATION_MS);
    };

    if (remaining > 0 && !reducedMotion) {
      fadeTimeoutRef.current = setTimeout(finish, remaining);
    } else {
      finish();
    }
  }, [fading, onFinish, reducedMotion]);

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
  }, [active, requestClose]);

  useEffect(() => {
    if (!active || !visible) return;
    if (ready) {
      requestClose();
    }
  }, [active, ready, visible, requestClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      data-login-loading-overlay
      style={{
        backgroundColor: 'rgb(0, 0, 0)',
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms ease`
      }}
      aria-hidden="true"
    >
      {/* TEMP – mobile-only login loading overlay background test */}
      <style jsx>{`
        @media (max-width: 768px) {
          [data-login-loading-overlay] {
            background-color: #000 !important;
            background: #000 !important;
          }
        }
      `}</style>
      <div className="relative w-full h-full flex items-center justify-center">
        {reducedMotion ? (
          <img
            src={INTERGUIDE_LOGO_MAIN_280_URL}
            alt="InterGuide"
            className="w-24 h-24 object-contain"
            loading="eager"
          />
        ) : (
          <video
            className="absolute inset-0 w-full h-full object-contain max-w-[80vw] max-h-[80vh] m-auto"
            autoPlay
            muted
            playsInline
            preload="auto"
          >
            <source src={INTERGUIDE_MAIN_ANIMATION_URL} />
          </video>
        )}
        <p className="relative z-10 text-sm text-slate-200">Loading your dashboard...</p>
      </div>
    </div>
  );
};

export default LoginLoadingOverlay;
