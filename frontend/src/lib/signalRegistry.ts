import type { SignalDefinition } from '../types/telemetry';

/**
 * Central signal catalogue. Add an entry here when a new channel needs a
 * deliberately chosen label, unit, colour, precision, or default visibility.
 * Unknown numeric CSV columns are still discovered and chartable automatically.
 */
const SIGNAL_REGISTRY: Record<string, Partial<SignalDefinition>> = {
  pack_voltage_v: {
    label: 'Pack voltage', unit: 'V', color: '#16b8c8', precision: 2,
    defaultVisible: true, category: 'electrical',
  },
  pack_current_a: {
    label: 'Pack current', unit: 'A', color: '#f2a43a', precision: 2,
    defaultVisible: true, category: 'electrical',
  },
  soc_percent: {
    label: 'State of charge', unit: '%', color: '#8b72f6', precision: 2,
    defaultVisible: true, category: 'electrical',
  },
  pack_temperature_c: {
    label: 'Pack temperature', unit: '°C', color: '#40ad83', precision: 2,
    defaultVisible: true, category: 'thermal',
  },
};

const CHART_PALETTE = [
  '#16b8c8', '#f2a43a', '#8b72f6', '#40ad83', '#e879a0',
  '#527ce8', '#d18c4d', '#4b9fc2', '#9b83d8', '#85a84d',
];

const UNIT_SUFFIXES: Array<{ suffix: string; unit: string; precision: number; category: SignalDefinition['category'] }> = [
  { suffix: '_voltage_v', unit: 'V', precision: 3, category: 'electrical' },
  { suffix: '_current_a', unit: 'A', precision: 2, category: 'electrical' },
  { suffix: '_temperature_c', unit: '°C', precision: 2, category: 'thermal' },
  { suffix: '_percent', unit: '%', precision: 2, category: 'other' },
  { suffix: '_rpm', unit: 'rpm', precision: 0, category: 'motion' },
  { suffix: '_speed_kmh', unit: 'km/h', precision: 1, category: 'motion' },
  { suffix: '_speed_kph', unit: 'km/h', precision: 1, category: 'motion' },
  { suffix: '_speed_mps', unit: 'm/s', precision: 2, category: 'motion' },
  { suffix: '_pressure_kpa', unit: 'kPa', precision: 2, category: 'other' },
  { suffix: '_pressure_bar', unit: 'bar', precision: 2, category: 'other' },
  { suffix: '_pressure_pa', unit: 'Pa', precision: 0, category: 'other' },
  { suffix: '_power_kw', unit: 'kW', precision: 2, category: 'electrical' },
  { suffix: '_power_w', unit: 'W', precision: 1, category: 'electrical' },
  { suffix: '_energy_kwh', unit: 'kWh', precision: 3, category: 'electrical' },
  { suffix: '_energy_wh', unit: 'Wh', precision: 1, category: 'electrical' },
  { suffix: '_resistance_ohm', unit: 'Ω', precision: 3, category: 'electrical' },
  { suffix: '_frequency_hz', unit: 'Hz', precision: 1, category: 'other' },
  { suffix: '_time_ms', unit: 'ms', precision: 1, category: 'other' },
  { suffix: '_distance_m', unit: 'm', precision: 2, category: 'motion' },
  { suffix: '_flow_lpm', unit: 'L/min', precision: 2, category: 'other' },
];

function titleCaseWords(value: string): string {
  const words = value.replace(/_/g, ' ').trim();
  if (!words) return '';
  return words.replace(/\b\w+/g, (word) => {
    const lower = word.toLowerCase();
    if (['bms', 'rpm', 'hv', 'lv', 'soc', 'can', 'dc', 'ac'].includes(lower)) return lower.toUpperCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

function titleCaseSignal(key: string): string {
  const suffixLabels: Record<string, string> = {
    _voltage_v: 'voltage',
    _current_a: 'current',
    _temperature_c: 'temperature',
    _percent: 'percent',
    _rpm: 'RPM',
    _speed_kmh: 'speed',
    _speed_kph: 'speed',
    _speed_mps: 'speed',
    _pressure_kpa: 'pressure',
    _pressure_bar: 'pressure',
    _pressure_pa: 'pressure',
    _power_kw: 'power',
    _power_w: 'power',
    _energy_kwh: 'energy',
    _energy_wh: 'energy',
    _resistance_ohm: 'resistance',
    _frequency_hz: 'frequency',
    _time_ms: 'time',
    _distance_m: 'distance',
    _flow_lpm: 'flow',
  };
  const suffix = UNIT_SUFFIXES.find(({ suffix: candidate }) => key.toLowerCase().endsWith(candidate));
  if (!suffix) return titleCaseWords(key);
  const base = key.slice(0, -suffix.suffix.length);
  return `${titleCaseWords(base)} ${suffixLabels[suffix.suffix] ?? ''}`.trim();
}

export function getSignalDefinition(key: string, index = 0): SignalDefinition {
  const configured = SIGNAL_REGISTRY[key];
  const inferred = UNIT_SUFFIXES.find(({ suffix }) => key.toLowerCase().endsWith(suffix));
  const unit = configured?.unit ?? inferred?.unit ?? '';
  const category = configured?.category ?? inferred?.category ?? 'other';

  return {
    key,
    label: configured?.label ?? titleCaseSignal(key),
    unit,
    color: configured?.color ?? CHART_PALETTE[index % CHART_PALETTE.length] ?? '#16b8c8',
    precision: configured?.precision ?? inferred?.precision ?? 2,
    defaultVisible: configured?.defaultVisible ?? false,
    category,
  };
}

export function getSignalDefinitions(keys: string[]): SignalDefinition[] {
  return keys.map((key, index) => getSignalDefinition(key, index));
}

export function isCellSignal(key: string): boolean {
  return /^cell_\d+_voltage_v$/i.test(key);
}
