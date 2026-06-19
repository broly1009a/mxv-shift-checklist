'use client';

import 'temporal-polyfill/global';
import React, { useMemo } from 'react';
import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import {
  createViewMonthGrid,
  createViewWeek,
  createViewDay,
} from '@schedule-x/calendar';
import '@schedule-x/theme-default/dist/index.css';

import { Temporal } from 'temporal-polyfill';

interface CalendarEntry {
  date: string;
  isTradingDay: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  note?: string;
}

interface CalendarViewProps {
  entries: CalendarEntry[];
  onSelectDate: (date: string, entry?: CalendarEntry) => void;
}

export default function CalendarView({ entries, onSelectDate }: CalendarViewProps) {
  // Generate events covering 60 days back and 90 days forward
  const events = useMemo(() => {
    const generatedEvents = [];
    const entryMap = new Map<string, CalendarEntry>(entries.map((e) => [e.date, e]));

    // Start 60 days ago at mid-day (12:00) to remain timezone-resilient
    const start = new Date();
    start.setDate(start.getDate() - 60);
    start.setHours(12, 0, 0, 0);

    for (let i = 0; i < 150; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const customEntry = entryMap.get(dateStr);
      if (customEntry) {
        if (customEntry.isTradingDay) {
          generatedEvents.push({
            id: `trading-${dateStr}`,
            title: `GD: ${customEntry.note || 'Cấu hình giao dịch'}`,
            start: Temporal.PlainDate.from(dateStr),
            end: Temporal.PlainDate.from(dateStr),
            calendarId: 'trading_custom',
            description: customEntry.note || 'Cấu hình ngày giao dịch đặc biệt'
          });
        } else {
          generatedEvents.push({
            id: `holiday-${dateStr}`,
            title: `Nghỉ: ${customEntry.note || 'Cấu hình nghỉ lễ'}`,
            start: Temporal.PlainDate.from(dateStr),
            end: Temporal.PlainDate.from(dateStr),
            calendarId: 'holiday_custom',
            description: customEntry.note || 'Cấu hình ngày nghỉ đặc biệt'
          });
        }
      } else {
        const dayOfWeek = d.getDay(); // 0: Sun, 6: Sat
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          generatedEvents.push({
            id: `weekend-${dateStr}`,
            title: 'Cuối tuần (Nghỉ mặc định)',
            start: Temporal.PlainDate.from(dateStr),
            end: Temporal.PlainDate.from(dateStr),
            calendarId: 'weekend_default',
            description: 'Nghỉ cuối tuần mặc định'
          });
        } else {
          generatedEvents.push({
            id: `trading-${dateStr}`,
            title: 'Ngày GD mặc định',
            start: Temporal.PlainDate.from(dateStr),
            end: Temporal.PlainDate.from(dateStr),
            calendarId: 'trading_default',
            description: 'Ngày giao dịch mặc định'
          });
        }
      }
    }

    return generatedEvents;
  }, [entries]);

  const calendar = useCalendarApp({
    views: [createViewMonthGrid(), createViewWeek(), createViewDay()],
    events,
    defaultView: 'month-grid',
    calendars: {
      trading_custom: {
        colorName: 'trading-custom',
        lightColors: {
          main: '#10b981',
          container: 'rgba(16, 185, 129, 0.15)',
          onContainer: '#10b981'
        }
      },
      holiday_custom: {
        colorName: 'holiday-custom',
        lightColors: {
          main: '#ef4444',
          container: 'rgba(239, 68, 68, 0.15)',
          onContainer: '#ef4444'
        }
      },
      weekend_default: {
        colorName: 'weekend-default',
        lightColors: {
          main: '#f97316',
          container: 'rgba(249, 115, 22, 0.08)',
          onContainer: '#f97316'
        }
      },
      trading_default: {
        colorName: 'trading-default',
        lightColors: {
          main: '#3b82f6',
          container: 'rgba(59, 130, 246, 0.08)',
          onContainer: '#3b82f6'
        }
      }
    },
    callbacks: {
      onClickDate(date) {
        const dateStr = date.toString();
        const entry = entries.find((e) => e.date === dateStr);
        onSelectDate(dateStr, entry);
      },
      onEventClick(event) {
        const dateStr = event.start.toString().substring(0, 10);
        const entry = entries.find((e) => e.date === dateStr);
        onSelectDate(dateStr, entry);
      }
    }
  });

  return (
    <div className="glass-panel" style={{ padding: '16px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sx__calendar-wrapper {
          --sx-font-family: inherit;
          --sx-border-radius: 12px;
          --sx-color-background: var(--bg-panel, rgba(30, 41, 59, 0.3));
          --sx-color-on-background: var(--text-primary, #ffffff);
          --sx-color-border-subtle: var(--border-color, rgba(255, 255, 255, 0.08));
          --sx-color-grid-line: var(--border-color, rgba(255, 255, 255, 0.08));
          border: none !important;
        }

        .sx__calendar {
          border: none !important;
          border-radius: 12px !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .sx__calendar-header {
          border-bottom: 1px solid var(--border-color) !important;
          padding: 12px 16px !important;
          background: rgba(255, 255, 255, 0.01) !important;
        }

        .sx__range-heading {
          font-size: 1rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
        }

        .sx__today-button,
        .sx__view-selection-selected-item,
        .sx__calendar-header .sx__date-input {
          border: 1px solid var(--border-color) !important;
          border-radius: 8px !important;
          padding: 6px 12px !important;
          font-size: 0.8rem !important;
          font-weight: 600 !important;
          background: var(--bg-app) !important;
          color: var(--text-secondary) !important;
          height: 34px !important;
          cursor: pointer !important;
        }

        .sx__today-button:hover,
        .sx__view-selection-selected-item:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          color: var(--text-primary) !important;
        }

        .sx__chevron-wrapper {
          min-height: 30px !important;
          min-width: 30px !important;
          height: 30px !important;
          width: 30px !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 6px !important;
          background: var(--bg-app) !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
        }

        .sx__chevron-wrapper:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }

        .sx__chevron-wrapper .sx__chevron {
          border-color: var(--text-secondary) !important;
        }

        .sx__week-grid__date-number {
          color: var(--text-primary) !important;
          font-weight: 600 !important;
        }

        .sx__month-grid-day {
          border-right: 1px solid var(--border-color) !important;
          border-bottom: 1px solid var(--border-color) !important;
          background: rgba(255, 255, 255, 0.002) !important;
        }

        .sx__month-grid-day__header {
          padding: 6px !important;
        }

        .sx__month-grid-day__date-number {
          font-size: 0.85rem !important;
          font-weight: 600 !important;
          color: var(--text-secondary) !important;
        }

        .sx__month-grid-day--is-today {
          background: rgba(59, 130, 246, 0.05) !important;
        }

        .sx__month-grid-day--is-today .sx__month-grid-day__date-number {
          background-color: var(--color-primary, #3b82f6) !important;
          color: #ffffff !important;
          border-radius: 50% !important;
          padding: 2px 6px !important;
        }

        .sx__month-grid-day__events {
          padding: 4px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 2px !important;
        }

        .sx__event {
          border-radius: 4px !important;
          font-size: 0.72rem !important;
          font-weight: 600 !important;
          padding: 4px 6px !important;
          box-shadow: none !important;
          border: none !important;
        }

        .sx__event-title {
          font-weight: 700 !important;
        }
      `}} />
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
