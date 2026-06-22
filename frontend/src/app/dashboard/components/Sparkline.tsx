import React from 'react';

interface SparklineProps {
  points: number[];
  color: string;
}

export const Sparkline: React.FC<SparklineProps> = ({ points, color }) => {
  const width = 70;
  const height = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pathPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height + 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="sparkline-svg" viewBox={`0 0 ${width} ${height + 4}`}>
      <polyline
        className="sparkline-path"
        style={{ stroke: color }}
        points={pathPoints}
      />
    </svg>
  );
};
