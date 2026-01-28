import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

const OVERLAY_COLOR = 'rgba(2, 6, 23, 0.72)';
const TARGET_PADDING = 12;
const TOOLTIP_MARGIN = 16;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getPaddedRect = (rect) => {
  if (!rect || typeof window === 'undefined') return null;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  return {
    top: clamp(rect.top - TARGET_PADDING, 0, viewportHeight),
    left: clamp(rect.left - TARGET_PADDING, 0, viewportWidth),
    right: clamp(rect.right + TARGET_PADDING, 0, viewportWidth),
    bottom: clamp(rect.bottom + TARGET_PADDING, 0, viewportHeight)
  };
};

const OnboardingOverlay = ({
  rect,
  step,
  stepIndex,
  totalSteps,
  isRTL,
  isWaiting,
  onDismiss,
  onPrimaryAction
}) => {
  const { t, i18n } = useTranslation();
  const tooltipRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
  const [shouldRender, setShouldRender] = useState(false);

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'he', name: 'עברית' }
  ];

  const paddedRect = useMemo(() => getPaddedRect(rect), [rect]);

  useLayoutEffect(() => {
    // Don't render overlay until target is ready or there's no target
    if (isWaiting) {
      setShouldRender(false);
      return;
    }

    setShouldRender(true);

    if (!tooltipRef.current) return;

    if (!paddedRect || typeof window === 'undefined') {
      setTooltipStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - paddedRect.bottom;
    const placeBelow = spaceBelow > tooltipRect.height + TOOLTIP_MARGIN;
    let top = placeBelow
      ? paddedRect.bottom + TOOLTIP_MARGIN
      : paddedRect.top - tooltipRect.height - TOOLTIP_MARGIN;
    top = clamp(top, TOOLTIP_MARGIN, viewportHeight - tooltipRect.height - TOOLTIP_MARGIN);

    let left = isRTL ? paddedRect.right - tooltipRect.width : paddedRect.left;
    left = clamp(left, TOOLTIP_MARGIN, viewportWidth - tooltipRect.width - TOOLTIP_MARGIN);

    setTooltipStyle({ top: `${top}px`, left: `${left}px` });
  }, [paddedRect, isRTL]);

  if (!step || !shouldRender) return null;

  const showTarget = !!paddedRect;

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none" dir={isRTL ? 'rtl' : 'ltr'}>
      {showTarget ? (
        <>
          <div
            className="absolute left-0 right-0 pointer-events-auto"
            style={{ top: 0, height: `${paddedRect.top}px`, background: OVERLAY_COLOR }}
          />
          <div
            className="absolute pointer-events-auto"
            style={{ top: `${paddedRect.top}px`, left: 0, width: `${paddedRect.left}px`, height: `${paddedRect.bottom - paddedRect.top}px`, background: OVERLAY_COLOR }}
          />
          <div
            className="absolute pointer-events-auto"
            style={{ top: `${paddedRect.top}px`, left: `${paddedRect.right}px`, right: 0, height: `${paddedRect.bottom - paddedRect.top}px`, background: OVERLAY_COLOR }}
          />
          <div
            className="absolute left-0 right-0 pointer-events-auto"
            style={{ top: `${paddedRect.bottom}px`, bottom: 0, background: OVERLAY_COLOR }}
          />
          <div
            className="absolute rounded-2xl border border-white/30 shadow-[0_0_30px_rgba(59,130,246,0.45)] pointer-events-none"
            style={{
              top: `${paddedRect.top}px`,
              left: `${paddedRect.left}px`,
              width: `${paddedRect.right - paddedRect.left}px`,
              height: `${paddedRect.bottom - paddedRect.top}px`
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 pointer-events-auto" style={{ background: OVERLAY_COLOR }} />
      )}

      <div
        ref={tooltipRef}
        className="absolute pointer-events-auto max-w-sm rounded-2xl border border-slate-700/60 bg-slate-950/90 backdrop-blur-xl shadow-2xl px-5 py-4 text-slate-100"
        style={tooltipStyle}
      >
        <div className="text-sm uppercase tracking-[0.2em] text-cyan-300/80 mb-2">
          {t('onboardingTour.progress', { current: stepIndex + 1, total: totalSteps })}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{t(step.titleKey)}</h3>
        <p className="text-sm text-slate-200 leading-relaxed">
          {isWaiting ? t('onboardingTour.waiting') : t(step.bodyKey)}
        </p>
        {step.actionKey && (
          <Button className="mt-4 w-full" onClick={onPrimaryAction}>
            {t(step.actionKey)}
          </Button>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 pointer-events-auto">
        <div className="max-w-4xl mx-auto px-6 pb-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700/60 bg-slate-950/80 backdrop-blur-xl px-5 py-3 shadow-xl">
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="text-slate-200 hover:text-white" onClick={onDismiss}>
                {t('onboardingTour.skip')}
              </Button>
              <div className="h-4 w-px bg-slate-600" />
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-slate-200 hover:text-white"
                onClick={() => handleLanguageChange(i18n.language === 'en' ? 'he' : 'en')}
              >
                <Languages className="w-4 h-4" />
                {i18n.language === 'en' ? 'עברית' : 'English'}
              </Button>
            </div>
            <div className="text-sm text-slate-300">
              {t('onboardingTour.progress', { current: stepIndex + 1, total: totalSteps })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
