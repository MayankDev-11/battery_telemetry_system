import Papa from 'papaparse';
import {
  REQUIRED_COLUMNS,
  type DataDiagnostics,
  type Dataset,
  type TelemetryRow,
} from '../types/telemetry';

const CELL_COLUMN = /^cell_\d+_voltage_v$/i;
const STRUCTURAL_COLUMNS = new Set(['timestamp_ms', 'can_id', 'status']);

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDataset(
  inputRows: Record<string, unknown>[],
  headerFields: string[],
  sourceName: string,
): Dataset {
  const headers = headerFields.map((header) => header.trim());
  const headerSet = new Set(headers);
  const missingHeaders = REQUIRED_COLUMNS.filter((column) => !headerSet.has(column));
  const signalKeys = headers
    .filter((header) => !STRUCTURAL_COLUMNS.has(header))
    .filter((header) => inputRows.some((record) => parseNumber(record[header]) !== null))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const cellKeys = signalKeys
    .filter((header) => CELL_COLUMN.test(header))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required column${missingHeaders.length > 1 ? 's' : ''}: ${missingHeaders.join(', ')}`);
  }
  if (signalKeys.length === 0) {
    throw new Error('No numeric telemetry columns found. Include at least one numeric signal such as pack_voltage_v or cell_01_voltage_v.');
  }

  let invalidTimestampRows = 0;
  let missingNumericValues = 0;
  let outOfOrderRows = 0;
  let duplicateTimestamps = 0;
  let lastTimestamp = Number.NEGATIVE_INFINITY;
  const seenTimestamps = new Set<number>();
  const rows: TelemetryRow[] = [];

  inputRows.forEach((rawRecord, index) => {
    const raw: Record<string, string> = {};
    headers.forEach((header) => {
      raw[header] = String(rawRecord[header] ?? '').trim();
    });

    const timestamp = parseNumber(rawRecord.timestamp_ms);
    if (timestamp === null) {
      invalidTimestampRows += 1;
      return;
    }
    if (timestamp < lastTimestamp) outOfOrderRows += 1;
    if (seenTimestamps.has(timestamp)) duplicateTimestamps += 1;
    seenTimestamps.add(timestamp);
    lastTimestamp = timestamp;

    const signals: Record<string, number | null> = {};
    signalKeys.forEach((key) => {
      signals[key] = parseNumber(rawRecord[key]);
    });
    const cellVoltages: Record<string, number | null> = {};
    cellKeys.forEach((key) => {
      cellVoltages[key] = signals[key] ?? null;
    });
    const numeric = {
      pack_voltage_v: signals.pack_voltage_v ?? null,
      pack_current_a: signals.pack_current_a ?? null,
      soc_percent: signals.soc_percent ?? null,
      pack_temperature_c: signals.pack_temperature_c ?? null,
    };

    const allNumeric = Object.values(signals);
    missingNumericValues += allNumeric.filter((value) => value === null).length;

    rows.push({
      timestamp_ms: timestamp,
      can_id: String(rawRecord.can_id ?? '').trim() || '—',
      ...numeric,
      signals,
      status: String(rawRecord.status ?? '').trim().toUpperCase() || 'UNKNOWN',
      cellVoltages,
      raw,
      sourceIndex: index + 1,
    });
  });

  if (rows.length === 0) {
    throw new Error('No usable rows found. Check that timestamp_ms contains numeric values.');
  }

  // Charts and summary calculations use chronological order; sourceIndex preserves the original row location.
  rows.sort((a, b) => a.timestamp_ms - b.timestamp_ms || a.sourceIndex - b.sourceIndex);

  const statusValues = [...new Set(rows.map((row) => row.status))].sort();
  const warnings: string[] = [];
  if (invalidTimestampRows > 0) warnings.push(`${invalidTimestampRows} row(s) skipped because timestamp_ms was not numeric.`);
  if (missingNumericValues > 0) warnings.push(`${missingNumericValues} signal value(s) were blank or non-numeric and are omitted from calculations.`);
  if (outOfOrderRows > 0) warnings.push(`${outOfOrderRows} row(s) were out of timestamp order; the plotted data has been sorted chronologically.`);
  if (duplicateTimestamps > 0) warnings.push(`${duplicateTimestamps} duplicate timestamp(s) were retained.`);

  const diagnostics: DataDiagnostics = {
    sourceRows: inputRows.length,
    acceptedRows: rows.length,
    invalidTimestampRows,
    missingNumericValues,
    outOfOrderRows,
    duplicateTimestamps,
    statusValues,
    warnings,
  };

  return {
    rows,
    signalKeys,
    cellKeys,
    headers,
    sourceName,
    loadedAt: new Date(),
    diagnostics,
  };
}

/**
 * Papa Parse sends its parser configuration to a Web Worker when `worker: true`.
 * Functions inside that configuration (for example `transformHeader`) cannot be
 * structured-cloned, which causes the browser error:
 * "function object could not be cloned".
 *
 * Keep the worker configuration data-only, then normalize the parsed field names
 * and records on the main thread after parsing has completed.
 */
function normalizeParsedResult(
  data: Record<string, unknown>[],
  originalFields: string[],
): { data: Record<string, unknown>[]; fields: string[] } {
  const fields = originalFields.map((field) => field.replace(/^\uFEFF/, '').trim());
  const normalizedData = data.map((record) => {
    const normalizedRecord: Record<string, unknown> = {};
    originalFields.forEach((originalField, index) => {
      const normalizedField = fields[index];
      if (normalizedField) normalizedRecord[normalizedField] = record[originalField];
    });
    return normalizedRecord;
  });

  return { data: normalizedData, fields };
}

function throwCsvParseError(errors: Papa.ParseError[]): void {
  const firstError = errors[0];
  if (firstError) {
    throw new Error(`CSV parse error on row ${firstError.row ?? 'unknown'}: ${firstError.message}`);
  }
}

export function parseCsvText(text: string, sourceName = 'uploaded.csv'): Dataset {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
  });
  throwCsvParseError(result.errors);
  const normalized = normalizeParsedResult(result.data, result.meta.fields ?? []);
  return buildDataset(normalized.data, normalized.fields, sourceName);
}

export function parseCsvFile(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    try {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        // Do not put callbacks such as transformHeader in this config: Papa Parse
        // serializes worker config with postMessage, and functions are not cloneable.
        worker: true,
        complete: (result) => {
          try {
            throwCsvParseError(result.errors);
            const normalized = normalizeParsedResult(result.data, result.meta.fields ?? []);
            resolve(buildDataset(normalized.data, normalized.fields, file.name));
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Unable to read this CSV file.'));
          }
        },
        error: (error) => reject(new Error(error.message)),
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Unable to start CSV parsing.'));
    }
  });
}

export function exportRowsToCsv(dataset: Dataset, rows: TelemetryRow[]): string {
  const records = rows.map((row) => {
    const record: Record<string, string | number> = {};
    dataset.headers.forEach((header) => {
      const rawValue = row.raw[header];
      record[header] = rawValue ?? '';
    });
    return record;
  });
  return Papa.unparse(records, { columns: dataset.headers });
}
