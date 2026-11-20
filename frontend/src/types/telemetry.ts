export const REQUIRED_COLUMNS = [
  'timestamp_ms',
  'can_id',
  'status',
] as const;

export interface TelemetryRow {
  timestamp_ms: number;
  can_id: string;
  pack_voltage_v: number | null;
  pack_current_a: number | null;
  soc_percent: number | null;
  pack_temperature_c: number | null;
  /** Every numeric telemetry channel discovered in the CSV, including cell channels. */
  signals: Record<string, number | null>;
  /** Kept separately for cell-focused summaries and comparison views. */
  cellVoltages: Record<string, number | null>;
  status: string;
  raw: Record<string, string>;
  sourceIndex: number;
}

export interface Dataset {
  rows: TelemetryRow[];
  /** All numeric signal columns discovered in the source CSV. */
  signalKeys: string[];
  /** Subset of signalKeys matching cell_<number>_voltage_v. */
  cellKeys: string[];
  headers: string[];
  sourceName: string;
  loadedAt: Date;
  diagnostics: DataDiagnostics;
}

export interface DataDiagnostics {
  sourceRows: number;
  acceptedRows: number;
  invalidTimestampRows: number;
  missingNumericValues: number;
  outOfOrderRows: number;
  duplicateTimestamps: number;
  statusValues: string[];
  warnings: string[];
}

export interface MetricSummary {
  latest: number | null;
  min: number | null;
  max: number | null;
  average: number | null;
}

export interface CellSummary {
  key: string;
  label: string;
  latest: number | null;
  min: number | null;
  max: number | null;
  deviationFromMean: number | null;
}

export interface SignalDefinition {
  key: string;
  label: string;
  unit: string;
  color: string;
  precision: number;
  defaultVisible: boolean;
  category: 'electrical' | 'thermal' | 'motion' | 'other';
}

export interface ChartRow {
  time_s: number;
  timestamp_ms: number;
  pack_voltage_v: number | null;
  pack_current_a: number | null;
  soc_percent: number | null;
  pack_temperature_c: number | null;
  [key: string]: number | null;
}

export type DashboardView = 'overview' | 'cells' | 'raw';
