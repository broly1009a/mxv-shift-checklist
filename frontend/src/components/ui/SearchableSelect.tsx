'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  label?: string;
  placeholder?: string;
  options: Option[];
  selectedValue: string;
  onChange: (value: string) => void;
  flex?: number | string;
  minWidth?: string;
  fontSize?: string;
}

export default function SearchableSelect({
  label,
  placeholder = 'Chọn...',
  options,
  selectedValue,
  onChange,
  flex = 1,
  minWidth = '200px',
  fontSize = '0.85rem'
}: SearchableSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedOption = options.find(opt => opt.value === selectedValue);

  const showClearButton = selectedValue && selectedValue !== 'ALL';

  return (
    <div style={{ flex, minWidth, position: 'relative' }} ref={containerRef}>
      {label && (
        <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {isOpen && (
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={isOpen ? searchQuery : (selectedOption ? selectedOption.label : placeholder)}
          onFocus={() => {
            setIsOpen(true);
            setSearchQuery('');
          }}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input"
          style={{ 
            width: '100%', 
            height: '42px', 
            paddingLeft: isOpen ? '32px' : '14px',
            paddingRight: '32px', 
            cursor: 'pointer',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            outline: 'none',
            fontSize: fontSize
          }}
          readOnly={!isOpen}
        />
        {showClearButton ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('ALL');
              setSearchQuery('');
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
          maxHeight: '220px',
          overflowY: 'auto',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}>
          {options.some(opt => opt.value === 'ALL') && (
            <div
              onClick={() => {
                onChange('ALL');
                setIsOpen(false);
              }}
              style={{
                padding: '10px 14px',
                fontSize: fontSize,
                cursor: 'pointer',
                background: selectedValue === 'ALL' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: selectedValue === 'ALL' ? 'var(--color-accent)' : 'var(--text-primary)',
                borderBottom: '1px solid var(--border-color)'
              }}
              className="table-row-hover"
            >
              {options.find(opt => opt.value === 'ALL')?.label || '-- Tất cả --'}
            </div>
          )}

          {filteredOptions.filter(opt => opt.value !== 'ALL').length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Không tìm thấy lựa chọn nào
            </div>
          ) : (
            filteredOptions
              .filter(opt => opt.value !== 'ALL')
              .map(opt => (
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
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  className="table-row-hover"
                >
                  <span style={{ fontWeight: 600 }}>{opt.label}</span>
                  {opt.sublabel && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{opt.sublabel}</span>
                  )}
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
