'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label?: string;
  options: Option[];
  selectedValue: string;
  onChange: (value: string) => void;
  flex?: number | string;
  minWidth?: string;
  clearable?: boolean;
  height?: string;
  fontSize?: string;
}

export default function CustomSelect({
  label,
  options,
  selectedValue,
  onChange,
  flex = 1,
  minWidth = '160px',
  clearable = true,
  height = '42px',
  fontSize = '0.85rem'
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 160 });
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current && containerRef.current.contains(target);
      const inPopup = popupRef.current && popupRef.current.contains(target);
      if (!inContainer && !inPopup) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === selectedValue);

  const showClearButton = clearable && selectedValue && selectedValue !== 'ALL';

  return (
    <div style={{ flex, minWidth, position: 'relative' }} ref={containerRef}>
      {label && (
        <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={selectedOption ? selectedOption.label : ''}
          onClick={() => {
            if (!isOpen && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              setPopupPos({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
              });
            }
            setIsOpen(!isOpen);
          }}
          className="form-input"
          style={{ 
            width: '100%', 
            height: height, 
            paddingRight: '32px', 
            cursor: 'pointer',
            caretColor: 'transparent',
            fontSize: fontSize,
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            outline: 'none',
            paddingLeft: '10px'
          }}
          readOnly
        />
        {showClearButton ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('ALL');
              setIsOpen(false);
            }}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: '4px',
              zIndex: 10
            }}
          >
            ✕
          </button>
        ) : (
          <div style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: isOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            transition: 'transform 0.2s ease',
            transformOrigin: 'center'
          }}>
            <ChevronDown size={14} />
          </div>
        )}
      </div>

      {isOpen && typeof window !== 'undefined' && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: popupPos.top,
            left: popupPos.left,
            width: popupPos.width,
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 9999,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            maxHeight: '260px',
            overflowY: 'auto'
          }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 14px',
                fontSize: fontSize,
                cursor: 'pointer',
                background: selectedValue === opt.value ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: selectedValue === opt.value ? 'var(--color-accent)' : 'var(--text-primary)',
                borderBottom: opt.value === 'ALL' ? '1px solid var(--border-color)' : 'none'
              }}
              className="table-row-hover"
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
