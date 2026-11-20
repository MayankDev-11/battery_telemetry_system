import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, BatteryCharging, Layers3 } from 'lucide-react';
import {
  Bar,
  Brush,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from '../components/ChartCard';
import { getCellSummaries, getChartRows } from '../lib/analytics';
import type { Dataset } from '../types/telemetry';

interface CellAnalysisPageProps {
  dataset: Dataset;
}

const palette = ['#16b8c8', '#8b72f6', '#f2a43a', '#40ad83', '#e879a0', '#527ce8', '#d18c4d', '#4b9fc2', '#9b83d8', '#85a84d', '#e28b65', '#4dabb0'];
const formatTime = (value: number | string) => `${Number(value).toFixed(1)}s`;
const formatVoltage = (value: number | null, digits = 3) => value === null ? '—' : value.toFixed(digits);

export default function CellAnalysisPage({ dataset }: CellAnalysisPageProps) {
  const summaries = useMemo(() => getCellSummaries(dataset), [dataset]);
  const chartRows = useMemo(() => getChartRows(dataset), [dataset]);
  const [selectedCells, setSelectedCells] = useState<string[]>(dataset.cellKeys.slice(0, 8));

  useEffect(() => {
    setSelectedCells(dataset.cellKeys.slice(0, 8));
  }, [dataset]);

  const valid = summaries.filter((cell) => cell.latest !== null);
  const lowest = valid.length > 0 ? valid.reduce((a, b) => (a.latest ?? Infinity) < (b.latest ?? Infinity) ? a : b) : undefined;
  const highest = valid.length > 0 ? valid.reduce((a, b) => (a.latest ?? -Infinity) > (b.latest ?? -Infinity) ? a : b) : undefined;
  const average = valid.length > 0 ? valid.reduce((sum, cell) => sum + (cell.latest ?? 0), 0) / valid.length : null;
  const spread = lowest && highest ? (highest.latest ?? 0) - (lowest.latest ?? 0) : null;
  const toggleCell = (key: string) => {
    setSelectedCells((current) => current.includes(key)
      ? current.filter((entry) => entry !== key)
      : [...current, key]);
  };

  return (
    <div className="page-stack">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> RUN ANALYSIS / 02</div>
          <h1>Cell analysis</h1>
          <p className="page-subtitle">Compare individual cell voltage channels and inspect the latest recorded spread.</p>
        </div>
        <div className="cell-count-chip"><BatteryCharging size={15} />{dataset.cellKeys.length} channels detected</div>
      </div>

      <div className="cell-stat-grid">
        <div className="cell-stat-card"><span className="cell-stat-icon cell-low"><ArrowDown size={16} /></span><div><small>Lowest latest cell</small><strong>{formatVoltage(lowest?.latest ?? null)} <i>V</i></strong><span>{lowest?.label ?? 'No value'}</span></div></div>
        <div className="cell-stat-card"><span className="cell-stat-icon cell-high"><ArrowUp size={16} /></span><div><small>Highest latest cell</small><strong>{formatVoltage(highest?.latest ?? null)} <i>V</i></strong><span>{highest?.label ?? 'No value'}</span></div></div>
        <div className="cell-stat-card"><span className="cell-stat-icon cell-spread"><Activity size={16} /></span><div><small>Latest cell spread</small><strong>{spread === null ? '—' : `${(spread * 1000).toFixed(1)}`} <i>mV</i></strong><span>Highest minus lowest</span></div></div>
        <div className="cell-stat-card"><span className="cell-stat-icon cell-mean"><Layers3 size={16} /></span><div><small>Latest cell average</small><strong>{formatVoltage(average)}</strong><span>Across valid cell samples</span></div></div>
      </div>

      {dataset.cellKeys.length > 0 ? <ChartCard
        title="Cell voltage over time"
        subtitle="Select channels below to compare their traces · elapsed run time"
        action={<span className="selection-counter">{selectedCells.length} / {dataset.cellKeys.length} selected</span>}
      >
        <div className="cell-line-chart">
          <ResponsiveContainer width="100%" height={330}>
            <LineChart data={chartRows} margin={{ top: 12, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="time_s" tickFormatter={formatTime} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 11 }} minTickGap={28} />
              <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 11 }} width={48} />
              <Tooltip
                contentStyle={{ border: '1px solid var(--line)', borderRadius: 12, backgroundColor: 'var(--panel-raised)', color: 'var(--ink)', boxShadow: 'var(--shadow-lg)', fontSize: 12 }}
                labelFormatter={(label) => `Elapsed ${formatTime(Number(label))}`}
                formatter={(value, name) => [`${Number(value).toFixed(4)} V`, String(name)]}
              />
              {selectedCells.map((key) => {
                const index = dataset.cellKeys.indexOf(key);
                return <Line key={key} type="monotone" dataKey={key} name={key.replace('_voltage_v', '').toUpperCase()} stroke={palette[index % palette.length]} strokeWidth={2.2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} connectNulls={false} />;
              })}
              <Brush dataKey="time_s" height={20} stroke="#8b72f6" fill="var(--chart-control-fill)" travellerWidth={8} tickFormatter={formatTime} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="cell-selector-wrap">
          <div className="cell-selector-heading"><span>VISIBLE CHANNELS</span><div><button onClick={() => setSelectedCells(dataset.cellKeys.slice(0, 12))}>First 12</button><button onClick={() => setSelectedCells(dataset.cellKeys)}>All</button><button onClick={() => setSelectedCells([])}>Clear</button></div></div>
          <div className="cell-selector-list">
            {dataset.cellKeys.map((key, index) => (
              <button key={key} className={`cell-toggle${selectedCells.includes(key) ? ' cell-toggle-active' : ''}`} onClick={() => toggleCell(key)}>
                <span style={{ background: palette[index % palette.length] }} />{key.replace('_voltage_v', '').replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </ChartCard> : (
        <div className="signal-no-charts"><BatteryCharging size={22} /><strong>No cell voltage channels found</strong><span>This CSV has other numeric telemetry channels, but no columns matching cell_01_voltage_v.</span></div>
      )}

      {dataset.cellKeys.length > 0 && <ChartCard title="Latest cell voltage snapshot" subtitle="Side-by-side comparison of the most recent sample from each cell channel">
        <ResponsiveContainer width="100%" height={270}>
          <BarChart data={summaries} margin={{ top: 12, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 10 }} />
            <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 11 }} width={48} />
            <Tooltip contentStyle={{ border: '1px solid var(--line)', borderRadius: 12, backgroundColor: 'var(--panel-raised)', color: 'var(--ink)', boxShadow: 'var(--shadow-lg)', fontSize: 12 }} formatter={(value) => [`${Number(value).toFixed(4)} V`, 'Cell voltage']} />
            <Bar dataKey="latest" radius={[5, 5, 0, 0]} maxBarSize={54} fill="#8b72f6" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>}

      {dataset.cellKeys.length > 0 && <section className="info-card cell-table-card">
        <div className="section-title-row"><div><h2>Cell channel summary</h2><p>Latest value, observed range, and difference from the latest cell average</p></div><span className="icon-well"><Layers3 size={17} /></span></div>
        <div className="table-scroll">
          <table className="data-table cell-summary-table">
            <thead><tr><th>CHANNEL</th><th>LATEST</th><th>MIN</th><th>MAX</th><th>VS. MEAN</th></tr></thead>
            <tbody>
              {summaries.map((cell, index) => (
                <tr key={cell.key}>
                  <td><span className="table-cell-name"><i style={{ background: palette[index % palette.length] }} />{cell.label}</span></td>
                  <td className="numeric-cell">{formatVoltage(cell.latest)}</td>
                  <td className="numeric-cell">{formatVoltage(cell.min)}</td>
                  <td className="numeric-cell">{formatVoltage(cell.max)}</td>
                  <td className="numeric-cell"><span className={`deviation-value${(cell.deviationFromMean ?? 0) < 0 ? ' deviation-negative' : ' deviation-positive'}`}>{cell.deviationFromMean === null ? '—' : `${cell.deviationFromMean > 0 ? '+' : ''}${(cell.deviationFromMean * 1000).toFixed(1)} mV`}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>}
      <div className="method-note"><span className="note-mark">i</span><span>Cell spread and deviation are descriptive comparisons only. The dashboard does not apply chemistry-specific limits or infer cell health.</span></div>
    </div>
  );
}
