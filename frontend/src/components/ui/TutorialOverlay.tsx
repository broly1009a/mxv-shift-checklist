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

    const timer = setTimeout(() => {
      // Scroll element into view
      try {
        const el = document.querySelector(step.target);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      } catch {}

      // Give scroll time to settle
      setTimeout(() => {
        updatePositions();
        setVisible(true);
        setTransitioning(false);
      }, 350);
    }, 100);

    return () => clearTimeout(timer);
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
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.6); }
          70% { box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
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
          background: #4f46e5 !important;
          transform: translateX(2px);
        }
        .tutorial-btn-prev:hover {
          background: rgba(255,255,255,0.12) !important;
        }
        .tutorial-btn-skip:hover {
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
          {/* Dark overlay using mask */}
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#tutorial-spotlight-mask)"
            style={{ backdropFilter: 'blur(2px)' }}
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
              border: '2px solid rgba(99, 102, 241, 0.8)',
              pointerEvents: 'none',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 9999,
            }}
          />
        )}
      </div>

      {/* === Tooltip Card === */}
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
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px', height: '28px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {step.icon
                    ? React.createElement(step.icon, { size: 14, color: 'white', strokeWidth: 2 })
                    : <BookOpen size={14} color="white" />}
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#a5b4fc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Hướng dẫn sử dụng
                </span>
              </div>
              <button
                className="tutorial-btn-skip"
                onClick={() => closeTutorial(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(148, 163, 184, 0.7)',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.2s ease',
                }}
                title="Đóng hướng dẫn"
              >
                <X size={16} />
              </button>
            </div>

            {/* Step Title */}
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#f1f5f9',
              lineHeight: '1.3',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {step.icon && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '22px',
                  height: '22px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  borderRadius: '6px',
                  flexShrink: 0,
                }}>
                  {React.createElement(step.icon, { size: 13, color: '#a5b4fc', strokeWidth: 2 })}
                </span>
              )}
              {step.title}
            </h4>

            {/* Description */}
            <p style={{
              margin: '0 0 16px 0',
              fontSize: '0.85rem',
              color: '#94a3b8',
              lineHeight: '1.6',
            }}>
              {step.description}
            </p>

            {/* Progress bar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                  Bước {currentStep + 1} / {total}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 700 }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div style={{
                height: '3px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  borderRadius: '2px',
                  transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
              </div>
              {/* Step dots */}
              <div style={{
                display: 'flex',
                gap: '4px',
                marginTop: '8px',
                flexWrap: 'wrap',
              }}>
                {steps.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === currentStep ? '16px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      background: i < currentStep
                        ? 'rgba(99,102,241,0.5)'
                        : i === currentStep
                          ? '#6366f1'
                          : 'rgba(255,255,255,0.1)',
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
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#94a3b8',
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
                  padding: '9px 16px',
                  background: isLast
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isLast
                    ? '0 4px 12px rgba(16,185,129,0.3)'
                    : '0 4px 12px rgba(99,102,241,0.3)',
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
                    padding: '8px 12px',
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'color 0.2s ease',
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
