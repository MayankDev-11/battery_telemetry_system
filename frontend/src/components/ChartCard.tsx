import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export default function ChartCard({ title, subtitle, children, className = '', action }: ChartCardProps) {
  return (
    <section className={`chart-card ${className}`}>
      <div className="chart-card-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {action && <div className="chart-card-action">{action}</div>}
      </div>
      <div className="chart-body">{children}</div>
    </section>
  );
}
