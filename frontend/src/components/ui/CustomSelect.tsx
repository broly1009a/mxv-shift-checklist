'use client';

import React, { useState, useEffect, useRef } from 'react';

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
}

export default function CustomSelect({
  label,
  options,
  selectedValue,
  onChange,
  flex = 1,
  minWidth = '160px'
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === selectedValue);

  return (
    <div style={{ flex, minWidth, position: 'relative' }} ref={containerRef}>
      {label && (
        <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={selectedOption ? selectedOption.label : ''}
          onClick={() => setIsOpen(!isOpen)}
          className="form-control"
          style={{ 
            width: '100%', 
            height: '42px', 
            paddingRight: selectedValue && selectedValue !== 'ALL' ? '32px' : '14px', 
            cursor: 'pointer',
            caretColor: 'transparent'
          }}
          readOnly
        />
        {selectedValue && selectedValue !== 'ALL' && (
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
        )}
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 50,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
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
                fontSize: '0.85rem',
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
