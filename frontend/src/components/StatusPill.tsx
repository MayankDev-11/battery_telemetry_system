interface StatusPillProps {
  status: string;
  subtle?: boolean;
}

export default function StatusPill({ status, subtle = false }: StatusPillProps) {
  const normalized = status.toUpperCase();
  const tone = normalized === 'NORMAL' || normalized === 'OK'
    ? 'normal'
    : normalized === 'WARNING' || normalized === 'WARN'
      ? 'warning'
      : normalized === 'CRITICAL' || normalized === 'FAULT' || normalized === 'ERROR'
        ? 'critical'
        : 'neutral';

  return (
    <span className={`status-pill status-${tone}${subtle ? ' status-subtle' : ''}`}>
      <span className="status-dot" />
      {status || 'UNKNOWN'}
    </span>
  );
}
