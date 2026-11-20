import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BatteryCharging,
  Clock3,
  Gauge,
  Thermometer,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as BarCell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from '../components/ChartCard';
import MetricCard from '../components/MetricCard';
import SignalChartCard from '../components/SignalChartCard';
import StatusPill from '../components/StatusPill';
import {
  averageSampleInterval,
  formatDuration,
  getCellSummaries,
  getChartRows,
  getSignalSummary,
  getStatusTransitions,
} from '../lib/analytics';
import { getSignalDefinition, isCellSignal } from '../lib/signalRegistry';
import type { Dataset } from '../types/telemetry';

interface OverviewPageProps {
  dataset: Dataset;
}

const DEFAULT_SIGNAL_STORAGE_KEY = 'voltview-visible-signals';
const chartColors = ['#16b8c8', '#f59e0b', '#8b72f6', '#f06b88', '#55b88a', '#527ce8', '#d18c4d', '#4b9fc2'];
const formatNumber = (value: number | null, digits = 2) => value === null ? '—' : value.toFixed(digits);
const formatTime = (value: number | string) => `${Number(value).toFixed(1)}s`;

function readSavedSignals(availableSignals: string[]): string[] {
  try {
    const saved = window.localStorage.getItem(DEFAULT_SIGNAL_STORAGE_KEY);
    if (saved === null) return availableSignals.filter((key, index) => getSignalDefinition(key, index).defaultVisible);
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return availableSignals.filter((key, index) => getSignalDefinition(key, index).defaultVisible);
    const selected = new Set(parsed.filter((key): key is string => typeof key === 'string'));
    return availableSignals.filter((key) => selected.has(key));
  } catch {
    return availableSignals.filter((key, index) => getSignalDefinition(key, index).defaultVisible);
  }
}

export default function OverviewPage({ dataset }: OverviewPageProps) {
  const { rows } = dataset;
  const chartRows = useMemo(() => getChartRows(dataset), [dataset]);
  const availableSignals = useMemo(() => dataset.signalKeys.filter((key) => !isCellSignal(key)), [dataset.signalKeys]);
  const availableSignalSignature = availableSignals.join('|');
  const [visibleSignalKeys, setVisibleSignalKeys] = useState<string[]>(() => readSavedSignals(availableSignals));
  const [showCellSnapshot, setShowCellSnapshot] = useState(() => {
    try { return window.localStorage.getItem('voltview-show-cell-snapshot') !== 'false'; }
    catch { return true; }
  });

  useEffect(() => {
    setVisibleSignalKeys((current) => {
      const validKeys = new Set(availableSignals);
      const retained = current.filter((key) => validKeys.has(key));
      const newlyRecommended = availableSignals.filter((key, index) => (
        !current.includes(key) && getSignalDefinition(key, index).defaultVisible
      ));
      return [...retained, ...newlyRecommended];
    });
  }, [availableSignalSignature]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEFAULT_SIGNAL_STORAGE_KEY, JSON.stringify(visibleSignalKeys));
    } catch {
      // Chart preferences still work for this session when storage is unavailable.
    }
  }, [visibleSignalKeys]);

  useEffect(() => {
    try { window.localStorage.setItem('voltview-show-cell-snapshot', String(showCellSnapshot)); }
    catch { /* Snapshot visibility still works for this session. */ }
  }, [showCellSnapshot]);

  const firstTimestamp = rows[0]?.timestamp_ms ?? 0;
  const lastTimestamp = rows[rows.length - 1]?.timestamp_ms ?? firstTimestamp;
  const duration = formatDuration(lastTimestamp - firstTimestamp);
  const voltage = getSignalSummary(rows, 'pack_voltage_v');
  const current = getSignalSummary(rows, 'pack_current_a');
  const soc = getSignalSummary(rows, 'soc_percent');
  const temperature = getSignalSummary(rows, 'pack_temperature_c');
  const cells = getCellSummaries(dataset);
  const latestCells = cells.filter((cell) => cell.latest !== null);
  const lowCell = latestCells.length > 0 ? latestCells.reduce((low, cell) => cell.latest! < low.latest! ? cell : low) : undefined;
  const highCell = latestCells.length > 0 ? latestCells.reduce((high, cell) => cell.latest! > high.latest! ? cell : high) : undefined;
  const cellSpread = lowCell && highCell ? (highCell.latest ?? 0) - (lowCell.latest ?? 0) : null;
  const sampleInterval = averageSampleInterval(rows);
  const transitions = getStatusTransitions(rows);
  const statusCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});
  const statusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const selectedSignalSet = new Set(visibleSignalKeys);
  const selectedSignals = availableSignals.flatMap((key, index) => (
    selectedSignalSet.has(key) ? [getSignalDefinition(key, index)] : []
  ));
  const hiddenSignalCount = Math.max(0, availableSignals.length - selectedSignals.length);

  const toggleSignal = (key: string) => {
    setVisibleSignalKeys((current) => current.includes(key)
      ? current.filter((entry) => entry !== key)
      : [...current, key]);
  };
  const showRecommended = () => setVisibleSignalKeys(
    availableSignals.filter((key, index) => getSignalDefinition(key, index).defaultVisible),
  );
  const showAll = () => setVisibleSignalKeys(availableSignals);
  const clearAll = () => setVisibleSignalKeys([]);

  return (
    <div className="page-stack">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> RUN ANALYSIS / 01</div>
          <h1>Battery overview</h1>
          <p className="page-subtitle">A configurable signal-level view of the pack across this telemetry recording.</p>
        </div>
        <div className="run-meta-chip"><Clock3 size={15} /><span>{duration} <small>recorded</small></span></div>
      </div>

      <div className="metric-grid">
        <MetricCard label="Pack voltage" value={formatNumber(voltage.latest)} unit="V" icon={<Zap size={18} />} accent="cyan" detail={voltage.min === null || voltage.max === null ? 'Range unavailable' : `Range ${voltage.min.toFixed(2)} – ${voltage.max.toFixed(2)}`} />
        <MetricCard label="Pack current" value={formatNumber(current.latest)} unit="A" icon={<Activity size={18} />} accent="amber" detail={current.min === null || current.max === null ? 'Range unavailable' : `Range ${current.min.toFixed(2)} – ${current.max.toFixed(2)}`} />
        <MetricCard label="State of charge" value={formatNumber(soc.latest)} unit="%" icon={<BatteryCharging size={18} />} accent="violet" detail={soc.min === null || soc.max === null ? 'Range unavailable' : `Range ${soc.min.toFixed(2)} – ${soc.max.toFixed(2)}`} />
        <MetricCard label="Pack temperature" value={formatNumber(temperature.latest)} unit="°C" icon={<Thermometer size={18} />} accent="green" detail={temperature.min === null || temperature.max === null ? 'Range unavailable' : `Range ${temperature.min.toFixed(2)} – ${temperature.max.toFixed(2)}`} />
      </div>

      <section className="signal-controls-card">
        <div className="signal-controls-heading">
          <div className="signal-controls-title">
            <span className="icon-well"><Activity size={17} /></span>
            <div><h2>Telemetry graph controls</h2><p>Choose which numeric signals get their own graph. New numeric CSV columns appear here automatically.</p></div>
          </div>
          <div className="signal-control-actions">
            <button type="button" onClick={showRecommended}>Recommended</button>
            <button type="button" onClick={showAll}>Show all</button>
            <button type="button" onClick={clearAll}>Clear</button>
            {latestCells.length > 0 && <button type="button" onClick={() => setShowCellSnapshot((current) => !current)} aria-pressed={showCellSnapshot}>{showCellSnapshot ? 'Hide cell snapshot' : 'Show cell snapshot'}</button>}
          </div>
        </div>
        {availableSignals.length > 0 ? (
          <div className="signal-picker-list">
            {availableSignals.map((key, index) => {
              const definition = getSignalDefinition(key, index);
              const selected = selectedSignalSet.has(key);
              return (
                <button
                  type="button"
                  key={key}
                  className={`signal-picker-chip${selected ? ' signal-picker-chip-active' : ''}`}
                  onClick={() => toggleSignal(key)}
                  aria-pressed={selected}
                >
                  <span className="signal-picker-dot" style={{ backgroundColor: definition.color }} />
                  <span>{definition.label}</span>
                  {definition.unit && <small>{definition.unit}</small>}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="signal-empty-note">No numeric signal columns were detected in this file.</p>
        )}
        <div className="signal-controls-footnote">
          <span>{selectedSignals.length} graph{selectedSignals.length === 1 ? '' : 's'} visible · {hiddenSignalCount} hidden</span>
          <span>Cell voltage traces are configured separately in Cell analysis.</span>
        </div>
      </section>

      {selectedSignals.length > 0 ? (
        <div className="signal-chart-grid">
          {selectedSignals.map((definition) => (
            <SignalChartCard key={definition.key} definition={definition} data={chartRows} onHide={toggleSignal} />
          ))}
        </div>
      ) : (
        <div className="signal-no-charts"><Activity size={22} /><strong>No signal graphs selected</strong><span>Choose one or more channels above to build your telemetry view.</span></div>
      )}

      {latestCells.length > 0 && showCellSnapshot && (
        <ChartCard title="Latest cell voltage snapshot" subtitle={`${latestCells.length} cell channels detected · most recent sample`}>
          <ResponsiveContainer width="100%" height={245}>
            <BarChart data={cells} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 10 }} />
              <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 11 }} width={46} />
              <Tooltip contentStyle={{ border: '1px solid var(--line)', borderRadius: 12, backgroundColor: 'var(--panel-raised)', color: 'var(--ink)', boxShadow: 'var(--shadow-lg)', fontSize: 12 }} formatter={(value) => [`${Number(value).toFixed(3)} V`, 'Cell voltage']} />
              <Bar dataKey="latest" radius={[5, 5, 0, 0]} maxBarSize={42} isAnimationActive={false}>
                {cells.map((cell, index) => <BarCell key={cell.key} fill={chartColors[index % chartColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-footnote"><span><i className="footnote-dot violet-dot" />Latest sample per cell</span><strong>{cellSpread === null ? '—' : `${(cellSpread * 1000).toFixed(1)} mV spread`}</strong></div>
        </ChartCard>
      )}

      <div className="bottom-grid">
        <section className="info-card session-card">
          <div className="section-title-row"><div><h2>Run details</h2><p>Recording and sampling context</p></div><span className="icon-well"><Gauge size={17} /></span></div>
          <div className="detail-grid">
            <div className="detail-item"><span>Samples</span><strong>{rows.length.toLocaleString()}</strong></div>
            <div className="detail-item"><span>Duration</span><strong>{duration}</strong></div>
            <div className="detail-item"><span>Avg. sample interval</span><strong>{sampleInterval === null ? '—' : `${sampleInterval.toFixed(1)} ms`}</strong></div>
            <div className="detail-item"><span>Numeric signals</span><strong>{dataset.signalKeys.length}</strong></div>
            <div className="detail-item"><span>Cell channels</span><strong>{dataset.cellKeys.length}</strong></div>
          </div>
        </section>

        <section className="info-card status-card">
          <div className="section-title-row"><div><h2>Status distribution</h2><p>Counts from the CSV status column</p></div><span className="icon-well"><Activity size={17} /></span></div>
          <div className="status-distribution">
            {statusEntries.map(([status, count], index) => (
              <div className="status-distribution-row" key={status}>
                <div className="status-distribution-label"><StatusPill status={status} subtle /><span>{count.toLocaleString()} rows</span></div>
                <div className="status-track"><span style={{ width: `${(count / rows.length) * 100}%`, background: chartColors[index % chartColors.length] }} /></div>
                <strong>{((count / rows.length) * 100).toFixed(1)}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="info-card event-card">
          <div className="section-title-row"><div><h2>Status transitions</h2><p>Changes in the recorded status signal</p></div><span className="icon-well"><Clock3 size={17} /></span></div>
          {transitions.length > 0 ? (
            <div className="event-list">
              {transitions.slice(-4).reverse().map((event, index) => (
                <div className="event-row" key={`${event.timestamp_ms}-${index}`}>
                  <span className="event-marker"><i /></span>
                  <div className="event-copy"><strong><StatusPill status={event.status} subtle /></strong><small className="event-time">{formatTime((event.timestamp_ms - firstTimestamp) / 1000)} elapsed</small></div>
                  <span className="event-can">{event.can_id}</span>
                </div>
              ))}
            </div>
          ) : <p className="empty-inline">No status samples recorded.</p>}
        </section>
      </div>
      <div className="method-note"><span className="note-mark">i</span><span>Charts display decoded numeric values from the CSV. Unknown numeric columns are available automatically; add a definition in <code>src/lib/signalRegistry.ts</code> to customize their label, unit, colour, precision, and default visibility.</span></div>
    </div>
  );
}
