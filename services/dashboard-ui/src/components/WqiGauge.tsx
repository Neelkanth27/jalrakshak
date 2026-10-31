import React from 'react';
import { Droplets } from 'lucide-react';

interface WqiGaugeProps {
  wqi: number;
  grade: string;
  anomalyScore: number;
}

export const WqiGauge: React.FC<WqiGaugeProps> = ({ wqi, grade, anomalyScore }) => {
  // SVG Circular Gauge parameters
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (wqi / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 90) return { stroke: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (score >= 75) return { stroke: '#34d399', text: 'text-teal-400', bg: 'bg-teal-500/10' };
    if (score >= 50) return { stroke: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { stroke: '#f43f5e', text: 'text-rose-500', bg: 'bg-rose-500/10' };
  };

  const color = getColor(wqi);

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-between shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: color.stroke }}
      />

      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-300">
          <Droplets className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-gray-400">Water Quality Index (WQI)</h2>
        </div>
        <span className="text-xs font-mono text-gray-500">S_comp: {anomalyScore.toFixed(2)}</span>
      </div>

      {/* Circular Radial Gauge */}
      <div className="relative flex items-center justify-center my-3">
        <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 200 200">
          {/* Track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke="#1f2937"
            strokeWidth="14"
            fill="transparent"
          />
          {/* Progress */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke={color.stroke}
            strokeWidth="14"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Score & Label */}
        <div className="absolute flex flex-col items-center text-center">
          <span className={`text-4xl font-extrabold tracking-tight ${color.text}`}>
            {wqi.toFixed(1)}
          </span>
          <span className="text-xs text-gray-400 font-medium mt-0.5">out of 100</span>
        </div>
      </div>

      {/* Grade Classification Pill */}
      <div className="w-full text-center mt-2">
        <div className={`inline-block px-4 py-1.5 rounded-full border border-gray-700 text-xs font-semibold ${color.bg} ${color.text}`}>
          {grade}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Normalized composite metric combining turbidity, TDS (EC25), and temperature deviations.
        </p>
      </div>
    </div>
  );
};
