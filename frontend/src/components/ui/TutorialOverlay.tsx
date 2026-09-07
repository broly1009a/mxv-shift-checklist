'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTutorial } from '@/context/TutorialContext';
import { X, ChevronLeft, ChevronRight, BookOpen, CheckCircle } from 'lucide-react';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPos {
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TOOLTIP_W = 340;
const TOOLTIP_H_ESTIMATE = 200;
const SPOTLIGHT_PAD = 10;

function getSpotlightRect(target: string, padding = SPOTLIGHT_PAD): SpotlightRect | null {
  let el: Element | null = null;
  try {
    el = document.querySelector(target);
  } catch {
    return null;
  }
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function calcTooltipPos(
  spotlight: SpotlightRect,
  preferredPlacement: 'top' | 'bottom' | 'left' | 'right' | 'center' | undefined,
  vpW: number,
  vpH: number,
): TooltipPos {
  const margin = 16;

  if (preferredPlacement === 'center') {
    return {
      top: (vpH - TOOLTIP_H_ESTIMATE) / 2,
      left: (vpW - TOOLTIP_W) / 2,
      placement: 'center',
    };
  }

  // Auto placement logic
  const spaceBelow = vpH - (spotlight.top + spotlight.height);
  const spaceAbove = spotlight.top;
  const spaceRight = vpW - (spotlight.left + spotlight.width);
  const spaceLeft = spotlight.left;

  let placement: 'top' | 'bottom' | 'left' | 'right' = preferredPlacement || 'bottom';

  if (!preferredPlacement) {
    if (spaceBelow >= TOOLTIP_H_ESTIMATE + margin) {
      placement = 'bottom';
    } else if (spaceAbove >= TOOLTIP_H_ESTIMATE + margin) {
      placement = 'top';
    } else if (spaceRight >= TOOLTIP_W + margin) {
      placement = 'right';
    } else if (spaceLeft >= TOOLTIP_W + margin) {
      placement = 'left';
    } else {
      placement = 'bottom';
    }
  }

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'bottom':
      top = spotlight.top + spotlight.height + margin;
      left = Math.min(
        Math.max(spotlight.left + spotlight.width / 2 - TOOLTIP_W / 2, margin),
        vpW - TOOLTIP_W - margin
      );
      break;
    case 'top':
      top = spotlight.top - TOOLTIP_H_ESTIMATE - margin;
      left = Math.min(
        Math.max(spotlight.left + spotlight.width / 2 - TOOLTIP_W / 2, margin),
        vpW - TOOLTIP_W - margin
      );
      break;
    case 'right':
      top = Math.min(
        Math.max(spotlight.top + spotlight.height / 2 - TOOLTIP_H_ESTIMATE / 2, margin),
        vpH - TOOLTIP_H_ESTIMATE - margin
      );
      left = spotlight.left + spotlight.width + margin;
      break;
    case 'left':
      top = Math.min(
        Math.max(spotlight.top + spotlight.height / 2 - TOOLTIP_H_ESTIMATE / 2, margin),
        vpH - TOOLTIP_H_ESTIMATE - margin
      );
      left = spotlight.left - TOOLTIP_W - margin;
      break;
  }

  // Clamp to viewport
  top = Math.max(margin, Math.min(top, vpH - TOOLTIP_H_ESTIMATE - margin));
  left = Math.max(margin, Math.min(left, vpW - TOOLTIP_W - margin));

  return { top, left, placement };
}

export default function TutorialOverlay() {
  const { isActive, currentStep, steps, nextStep, prevStep, closeTutorial } = useTutorial();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const rafRef = useRef<number | null>(null);

  const step = steps[currentStep];

  const updatePositions = useCallback(() => {
    if (!step) return;

    const padding = step.padding ?? SPOTLIGHT_PAD;
    const rect = getSpotlightRect(step.target, padding);
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    if (!rect && step.placement !== 'center') {
      // Element not found — use center placement
      setSpotlight(null);
      setTooltipPos({
        top: (vpH - TOOLTIP_H_ESTIMATE) / 2,
        left: (vpW - TOOLTIP_W) / 2,
        placement: 'center',
      });
    } else {
      setSpotlight(rect);
      if (rect) {
        setTooltipPos(calcTooltipPos(rect, step.placement, vpW, vpH));
      }
    }
  }, [step]);

  // Scroll target into view + recalculate positions
  useEffect(() => {
    if (!isActive || !step) {
      setVisible(false);
      return;
    }

    setTransitioning(true);
    setVisible(false);

    const tryScrollAndPosition = () => {
      try {
        const el = document.querySelector(step.target);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      } catch {}
      updatePositions();
    };

    // First attempt after brief pause
    const timer1 = setTimeout(() => {
      tryScrollAndPosition();
      setVisible(true);
      setTransitioning(false);
    }, 150);

    // Followup attempts in case data was fetching or DOM was expanding
    const timer2 = setTimeout(() => {
      updatePositions();
    }, 400);

    const timer3 = setTimeout(() => {
      updatePositions();
    }, 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isActive, currentStep, step, updatePositions]);

  // Recalculate on resize
  useEffect(() => {
    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePositions);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updatePositions]);

  if (!isActive) return null;

  const total = steps.length;
  const isLast = currentStep === total - 1;
  const isFirst = currentStep === 0;
  const progress = ((currentStep + 1) / total) * 100;

  return (
    <>
      {/* Global tutorial styles */}
      <style>{`
        @keyframes tutorial-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tutorial-slide-up {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tutorial-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.6); }
          70% { box-shadow: 0 0 0 12px rgba(37, 99, 235, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
        .tutorial-spotlight-ring {
          animation: tutorial-pulse-ring 2s infinite;
        }
        .tutorial-tooltip {
          animation: tutorial-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .tutorial-backdrop {
          animation: tutorial-fade-in 0.25s ease forwards;
        }
        .tutorial-btn-next:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        .tutorial-btn-prev:hover {
          background: #e2e8f0 !important;
          color: #0f172a !important;
        }
        .tutorial-btn-skip:hover {
          background: #fee2e2 !important;
          color: #ef4444 !important;
        }
      `}</style>

      {/* === Backdrop with spotlight cutout === */}
      <div
        className="tutorial-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'all',
        }}
        onClick={(e) => {
          // Only close if clicking on backdrop directly (not inside tooltip)
          if (e.target === e.currentTarget) closeTutorial(false);
        }}
      >
        {/* SVG mask for spotlight cutout */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="tutorial-spotlight-mask">
              {/* White = show backdrop | Black = cutout (transparent) */}
              <rect width="100%" height="100%" fill="white" />
              {spotlight && (
                <rect
                  x={spotlight.left}
                  y={spotlight.top}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx="10"
                  ry="10"
                  fill="black"
                  style={{ transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              )}
            </mask>
          </defs>
          {/* Lightened backdrop overlay using mask */}
          <rect
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.48)"
            mask="url(#tutorial-spotlight-mask)"
            style={{ backdropFilter: 'blur(3px)' }}
          />
        </svg>

        {/* Spotlight border ring */}
        {spotlight && visible && (
          <div
            className="tutorial-spotlight-ring"
            style={{
              position: 'absolute',
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              borderRadius: '10px',
              border: '2px solid #2563eb',
              boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.25), 0 0 20px rgba(37, 99, 235, 0.3)',
              pointerEvents: 'none',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 9999,
            }}
          />
        )}
      </div>

      {/* === Tooltip Card: Bright, Clean & Modern Design === */}
      {visible && tooltipPos && step && (
        <div
          className="tutorial-tooltip"
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            width: TOOLTIP_W,
            zIndex: 10000,
            pointerEvents: 'all',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '18px',
              padding: '22px',
              boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.2), 0 8px 16px -6px rgba(15, 23, 42, 0.08)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px', height: '28px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}>
                  <BookOpen size={14} color="white" />
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: '#2563eb',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Hướng dẫn sử dụng
                </span>
              </div>
              <button
                className="tutorial-btn-skip"
                onClick={() => closeTutorial(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
                title="Đóng hướng dẫn"
              >
                <X size={15} />
              </button>
            </div>

            {/* Step Title */}
            <h4 style={{
              margin: '0 0 10px 0',
              fontSize: '1.05rem',
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: '1.35',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {step.icon && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  background: 'rgba(37, 99, 235, 0.1)',
                  borderRadius: '7px',
                  flexShrink: 0,
                }}>
                  {React.createElement(step.icon, { size: 14, color: '#2563eb', strokeWidth: 2.2 })}
                </span>
              )}
              {step.title}
            </h4>

            {/* Description */}
            <p style={{
              margin: '0 0 16px 0',
              fontSize: '0.86rem',
              color: '#475569',
              lineHeight: '1.65',
              fontWeight: 450,
            }}>
              {step.description}
            </p>

            {/* Progress bar */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                  Bước {currentStep + 1} / {total}
                </span>
                <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 800 }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div style={{
                height: '4px',
                background: '#e2e8f0',
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                  borderRadius: '3px',
                  transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
              </div>
              {/* Step dots */}
              <div style={{
                display: 'flex',
                gap: '5px',
                marginTop: '10px',
                flexWrap: 'wrap',
              }}>
                {steps.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === currentStep ? '18px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      background: i < currentStep
                        ? 'rgba(37, 99, 235, 0.45)'
                        : i === currentStep
                          ? '#2563eb'
                          : '#cbd5e1',
                      transition: 'all 0.3s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {!isFirst && (
                <button
                  className="tutorial-btn-prev"
                  onClick={prevStep}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '9px 14px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '9px',
                    color: '#475569',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ChevronLeft size={14} /> Trước
                </button>
              )}

              <button
                className="tutorial-btn-next"
                onClick={nextStep}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  background: isLast
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none',
                  borderRadius: '9px',
                  color: 'white',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isLast
                    ? '0 4px 14px rgba(16, 185, 129, 0.35)'
                    : '0 4px 14px rgba(37, 99, 235, 0.35)',
                }}
              >
                {isLast ? (
                  <><CheckCircle size={15} /> Hoàn thành!</>
                ) : (
                  <>Tiếp theo <ChevronRight size={14} /></>
                )}
              </button>

              {!isLast && (
                <button
                  className="tutorial-btn-skip"
                  onClick={() => closeTutorial(true)}
                  style={{
                    padding: '9px 14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '9px',
                    color: '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Bỏ qua
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
