import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: ReactNode;
  accent: 'cyan' | 'violet' | 'amber' | 'green';
  detail: string;
  trend?: 'up' | 'down' | 'flat';
  eyebrow?: string;
}

export default function MetricCard({
  label,
  value,
  unit,
  icon,
  accent,
  detail,
  trend,
  eyebrow = 'LATEST VALID',
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-${accent}`}>
      <div className="metric-topline">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value-row">
        <strong className="metric-value">{value}</strong>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      <div className="metric-foot">
        <span className="metric-detail">{detail}</span>
        <span className="metric-eyebrow">{trend === 'up' ? <ArrowUpRight size={13} /> : trend === 'down' ? <ArrowDownRight size={13} /> : trend === 'flat' ? <Minus size={13} /> : null}{eyebrow}</span>
      </div>
    </article>
  );
}
