import type {
  CellSummary,
  ChartRow,
  Dataset,
  MetricSummary,
  TelemetryRow,
} from '../types/telemetry';

export function summarize(values: (number | null)[]): MetricSummary {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (valid.length === 0) return { latest: null, min: null, max: null, average: null };
  let min = valid[0] as number;
  let max = valid[0] as number;
  let sum = 0;
  for (const value of valid) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }
  return {
    latest: valid[valid.length - 1] ?? null,
    min,
    max,
    average: sum / valid.length,
  };
}

export function getSignalSummary(rows: TelemetryRow[], key: string): MetricSummary {
  return summarize(rows.map((row) => row.signals[key] ?? null));
}

export function getCellSummaries(dataset: Dataset): CellSummary[] {
  const perCell = dataset.cellKeys.map((key) => ({
    key,
    summary: summarize(dataset.rows.map((row) => row.cellVoltages[key] ?? null)),
  }));
  const latestValues = perCell
    .map(({ summary }) => summary.latest)
    .filter((value): value is number => value !== null);
  const mean = latestValues.length > 0
    ? latestValues.reduce((sum, value) => sum + value, 0) / latestValues.length
    : null;

  return perCell.map(({ key, summary }) => ({
    key,
    label: key.replace('_voltage_v', '').replace('_', ' ').toUpperCase(),
    latest: summary.latest,
    min: summary.min,
    max: summary.max,
    deviationFromMean: summary.latest !== null && mean !== null ? summary.latest - mean : null,
  }));
}

export function getStatusTransitions(rows: TelemetryRow[]) {
  return rows.reduce<{ timestamp_ms: number; status: string; can_id: string }[]>((events, row, index) => {
    if (index === 0 || rows[index - 1]?.status !== row.status) {
      events.push({ timestamp_ms: row.timestamp_ms, status: row.status, can_id: row.can_id });
    }
    return events;
  }, []);
}

export function getChartRows(dataset: Dataset, maxPoints = 1200): ChartRow[] {
  const { rows, signalKeys } = dataset;
  if (rows.length === 0) return [];
  const stride = Math.max(1, Math.ceil(rows.length / maxPoints));
  const firstTimestamp = rows[0]?.timestamp_ms ?? 0;
  const selected = rows.filter((_, index) => index % stride === 0 || index === rows.length - 1);
  return selected.map((row) => {
    const chartRow: ChartRow = {
      time_s: (row.timestamp_ms - firstTimestamp) / 1000,
      timestamp_ms: row.timestamp_ms,
      pack_voltage_v: row.pack_voltage_v,
      pack_current_a: row.pack_current_a,
      soc_percent: row.soc_percent,
      pack_temperature_c: row.pack_temperature_c,
    };
    signalKeys.forEach((key) => {
      chartRow[key] = row.signals[key] ?? null;
    });
    return chartRow;
  });
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}.${Math.floor((durationMs % 1000) / 100)}s`;
}

export function formatTimestamp(timestampMs: number, startMs: number): string {
  return `${((timestampMs - startMs) / 1000).toFixed(2)} s`;
}

export function averageSampleInterval(rows: TelemetryRow[]): number | null {
  if (rows.length < 2) return null;
  const deltas = rows.slice(1).map((row, index) => row.timestamp_ms - (rows[index]?.timestamp_ms ?? row.timestamp_ms));
  const valid = deltas.filter((delta) => delta > 0);
  return valid.length > 0 ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

export function getFilteredRows(
  rows: TelemetryRow[],
  search: string,
  status: string,
): TelemetryRow[] {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    const statusMatches = status === 'ALL' || row.status === status;
    if (!statusMatches) return false;
    if (!query) return true;
    return row.can_id.toLowerCase().includes(query)
      || row.status.toLowerCase().includes(query)
      || String(row.timestamp_ms).includes(query)
      || Object.values(row.raw).some((value) => value.toLowerCase().includes(query));
  });
}
