'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  label: string;
  value: string; // Định dạng 'YYYY-MM-DD'
  onChange: (value: string) => void;
  flex?: number | string;
  minWidth?: string;
  fontSize?: string;
}

export default function CustomDatePicker({
  label,
  value,
  onChange,
  flex = 1,
  minWidth = '170px',
  fontSize = '0.85rem'
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse ngày hiện tại khi có giá trị truyền vào
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setCurrentMonth(parsed);
      }
    }
  }, [value]);

  // Click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Định dạng ngày hiển thị (VD: 06/08/2026)
  const getFormattedDisplay = () => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Logic sinh ngày trong tháng
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-11

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Chủ nhật

  // Các ngày của tháng trước để điền vào tuần đầu tiên
  const prevMonthDays = new Date(year, month, 0).getDate();
  const prevMonthCells = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevMonthCells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      monthOffset: -1
    });
  }

  // Các ngày của tháng hiện tại
  const currentMonthCells = [];
  for (let i = 1; i <= daysInMonth; i++) {
    currentMonthCells.push({
      day: i,
      isCurrentMonth: true,
      monthOffset: 0
    });
  }

  // Các ngày của tháng sau để hoàn thiện lưới 6 hàng (42 ô)
  const nextMonthCells = [];
  const remainingCells = 42 - (prevMonthCells.length + currentMonthCells.length);
  for (let i = 1; i <= remainingCells; i++) {
    nextMonthCells.push({
      day: i,
      isCurrentMonth: false,
      monthOffset: 1
    });
  }

  const allCells = [...prevMonthCells, ...currentMonthCells, ...nextMonthCells];

  const handleCellClick = (cell: { day: number; isCurrentMonth: boolean; monthOffset: number }) => {
    let targetYear = year;
    let targetMonth = month + cell.monthOffset;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    } else if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    const formattedDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  // Check xem ô lịch đó có phải là ngày đang chọn không
  const isSelected = (cell: { day: number; isCurrentMonth: boolean; monthOffset: number }) => {
    if (!value || !cell.isCurrentMonth) return false;
    const date = new Date(value);
    return date.getDate() === cell.day && date.getMonth() === month && date.getFullYear() === year;
  };

  // Check ngày hôm nay
  const isToday = (cell: { day: number; isCurrentMonth: boolean; monthOffset: number }) => {
    const today = new Date();
    return cell.isCurrentMonth && 
      today.getDate() === cell.day && 
      today.getMonth() === month && 
      today.getFullYear() === year;
  };

  return (
    <div style={{ flex, minWidth, position: 'relative' }} ref={containerRef}>
      <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <CalendarIcon 
          size={15} 
          style={{ 
            position: 'absolute', 
            left: '14px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--text-muted)', 
            pointerEvents: 'none',
            zIndex: 3
          }} 
        />
        <input
          type="text"
          value={getFormattedDisplay()}
          placeholder="Chọn ngày..."
          onClick={() => setIsOpen(!isOpen)}
          className="form-input"
          style={{ 
            width: '100%', 
            height: '42px', 
            cursor: 'pointer',
            paddingLeft: '38px',
            paddingRight: value ? '32px' : '14px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            caretColor: 'transparent',
            fontSize: fontSize,
            color: 'var(--text-primary)',
            outline: 'none'
          }}
          readOnly
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
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

      {/* Bảng lịch tự viết (Custom Calendar Popup) */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 90,
          padding: '16px',
          width: '280px',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          userSelect: 'none'
        }}>
          {/* Lịch Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <button 
              type="button" 
              onClick={prevMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="table-row-hover"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {monthNames[month]} năm {year}
            </span>
            <button 
              type="button" 
              onClick={nextMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="table-row-hover"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Các thứ trong tuần */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '8px' }}>
            {weekdays.map(day => (
              <span key={day} style={{ fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-muted)' }}>
                {day}
              </span>
            ))}
          </div>

          {/* Lưới ngày (Grid of Days) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {allCells.map((cell, idx) => {
              const selected = isSelected(cell);
              const today = isToday(cell);
              
              let cellColor = 'var(--text-primary)';
              if (!cell.isCurrentMonth) {
                cellColor = 'var(--text-muted)';
              } else if (selected) {
                cellColor = '#fff';
              }

              return (
                <div
                  key={idx}
                  onClick={() => handleCellClick(cell)}
                  style={{
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: cell.isCurrentMonth ? 500 : 400,
                    cursor: 'pointer',
                    borderRadius: '50%',
                    color: cellColor,
                    background: selected ? 'var(--color-accent)' : 'transparent',
                    border: today && !selected ? '1px solid var(--color-accent)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  className={selected ? '' : 'table-row-hover'}
                >
                  {cell.day}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
