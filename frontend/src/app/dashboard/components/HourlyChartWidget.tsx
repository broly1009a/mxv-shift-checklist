import React from 'react';
import { GripVertical } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
  BarController,
  LineController
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler,
  BarController,
  LineController
);

interface HourlyChartWidgetProps {
  showChart: boolean;
  summary: {
    hourlyChecks?: number[];
    hourlyProgress?: number[];
    totalJobs?: number;
  } | null;
}

const hourlyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        boxWidth: 12,
        usePointStyle: true,
        font: { size: 11, family: 'Outfit, Inter' }
      }
    },
    tooltip: {
      padding: 10,
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleFont: { size: 12, family: 'Outfit' },
      bodyFont: { size: 12, family: 'Inter' },
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 } }
    },
    y: {
      position: 'left' as const,
      grid: { color: 'rgba(128,128,128,0.08)' },
      ticks: { font: { size: 11 } }
    },
    y1: {
      position: 'right' as const,
      grid: { drawOnChartArea: false },
      ticks: {
        font: { size: 11 },
        callback: function (value: any) { return value + '%'; }
      },
      min: 0,
      max: 100
    }
  }
};

export const HourlyChartWidget: React.FC<HourlyChartWidgetProps> = ({ showChart, summary }) => {
  if (!showChart) return null;

  const labels = ['06h', '07h', '08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h'];

  // Default mock data when page is first loading or we haven't selected a day with jobs yet
  let checksData = [30, 55, 62, 78, 98, 92, 70, 60, 68, 75, 82, 90];
  let progressData = [25, 38, 55, 72, 85, 95, 99.2, 92, 94, 96, 98, 99.2];

  // If summary is loaded:
  if (summary) {
    // If there are actually jobs on that day, display the calculated metrics.
    // If there are no jobs at all (totalJobs === 0), we want to show 0s.
    if (summary.totalJobs === 0) {
      checksData = new Array(12).fill(0);
      progressData = new Array(12).fill(0);
    } else {
      checksData = labels.map((_, index) => {
        const hour = index + 6;
        return (summary.hourlyChecks && summary.hourlyChecks[hour]) || 0;
      });
      progressData = labels.map((_, index) => {
        const hour = index + 6;
        return (summary.hourlyProgress && summary.hourlyProgress[hour]) || 0;
      });
    }
  }

  const hourlyChartData = {
    labels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Tỷ lệ hoàn thành nhiệm vụ (%)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#3b82f6',
        pointBorderWidth: 2.5,
        pointRadius: 4.5,
        pointHoverRadius: 6,
        data: progressData,
        yAxisID: 'y1',
      } as any,
      {
        type: 'bar' as const,
        label: 'Tần suất kiểm tra (Số lượng)',
        backgroundColor: 'rgba(59, 130, 246, 0.75)',
        hoverBackgroundColor: '#3b82f6',
        borderRadius: 6,
        borderWidth: 0,
        barPercentage: 0.5,
        categoryPercentage: 0.8,
        data: checksData,
        yAxisID: 'y',
      } as any
    ]
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>
      <div style={{ marginBottom: '20px', paddingRight: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
          Khối lượng giao dịch & tần suất tác vụ theo giờ
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Biểu đồ cột + đường nối biểu diễn số lượng tác vụ kiểm tra phát sinh và xử lý trong ngày.
        </p>
      </div>
      <div style={{ height: '280px', position: 'relative', width: '100%', minWidth: 0 }}>
        <Bar data={hourlyChartData as any} options={hourlyChartOptions as any} />
      </div>
    </div>
  );
};
