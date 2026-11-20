import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from './ChartCard';
import type { ChartRow, SignalDefinition } from '../types/telemetry';

interface SignalChartCardProps {
  definition: SignalDefinition;
  data: ChartRow[];
  onHide: (key: string) => void;
}

const formatTime = (value: number | string) => `${Number(value).toFixed(1)}s`;

export default function SignalChartCard({ definition, data, onHide }: SignalChartCardProps) {
  const [style, setStyle] = useState<'line' | 'area'>('line');
  const gradientId = `signal-fill-${definition.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const tooltipFormatter = (value: unknown) => {
    const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
    const formatted = numericValue.toFixed(definition.precision);
    return [`${formatted}${definition.unit ? ` ${definition.unit}` : ''}`, definition.label];
  };
  const chartContent = (
    <>
      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="time_s" tickFormatter={formatTime} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 11 }} minTickGap={28} />
      <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 11 }} width={48} />
      <Tooltip
        contentStyle={{ border: '1px solid var(--line)', borderRadius: 12, backgroundColor: 'var(--panel-raised)', color: 'var(--ink)', boxShadow: 'var(--shadow-lg)', fontSize: 12 }}
        labelFormatter={(label) => `Elapsed ${formatTime(Number(label))}`}
        formatter={tooltipFormatter}
      />
    </>
  );

  return (
    <ChartCard
      title={definition.label}
      subtitle={`${definition.key}${definition.unit ? ` · ${definition.unit}` : ''} · elapsed run time`}
      className="signal-chart-card"
      action={(
        <div className="signal-chart-actions">
          <div className="signal-style-switch" aria-label={`${definition.label} chart style`}>
            <button type="button" className={style === 'line' ? 'active' : ''} onClick={() => setStyle('line')} aria-pressed={style === 'line'}>Line</button>
            <button type="button" className={style === 'area' ? 'active' : ''} onClick={() => setStyle('area')} aria-pressed={style === 'area'}>Area</button>
          </div>
          <button type="button" className="signal-hide-button" onClick={() => onHide(definition.key)} aria-label={`Hide ${definition.label}`} title="Hide this graph"><EyeOff size={14} /></button>
        </div>
      )}
    >
      <ResponsiveContainer width="100%" height={260}>
        {style === 'area' ? (
          <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={definition.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={definition.color} stopOpacity={0.015} />
              </linearGradient>
            </defs>
            {chartContent}
            <Area type="monotone" dataKey={definition.key} name={definition.label} stroke={definition.color} strokeWidth={2.4} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} connectNulls={false} />
            <Brush dataKey="time_s" height={20} stroke={definition.color} fill="var(--chart-control-fill)" travellerWidth={8} tickFormatter={formatTime} />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
            {chartContent}
            <Line type="monotone" dataKey={definition.key} name={definition.label} stroke={definition.color} strokeWidth={2.4} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} connectNulls={false} />
            <Brush dataKey="time_s" height={20} stroke={definition.color} fill="var(--chart-control-fill)" travellerWidth={8} tickFormatter={formatTime} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  );
}
