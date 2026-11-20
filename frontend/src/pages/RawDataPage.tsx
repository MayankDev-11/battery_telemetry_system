import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search, SlidersHorizontal } from 'lucide-react';
import StatusPill from '../components/StatusPill';
import { formatTimestamp, getFilteredRows } from '../lib/analytics';
import { exportRowsToCsv } from '../lib/csv';
import { getSignalDefinition } from '../lib/signalRegistry';
import type { Dataset } from '../types/telemetry';

interface RawDataPageProps {
  dataset: Dataset;
}

const PAGE_SIZE = 20;

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function RawDataPage({ dataset }: RawDataPageProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const filteredRows = useMemo(() => getFilteredRows(dataset.rows, search, status), [dataset.rows, search, status]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const firstTimestamp = dataset.rows[0]?.timestamp_ms ?? 0;
  const statuses = dataset.diagnostics.statusValues;

  useEffect(() => setPage(0), [search, status, dataset]);

  const exportFiltered = () => {
    const base = dataset.sourceName.replace(/\.csv$/i, '');
    downloadCsv(`${base}-filtered.csv`, exportRowsToCsv(dataset, filteredRows));
  };

  return (
    <div className="page-stack">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> RUN ANALYSIS / 03</div>
          <h1>Raw telemetry data</h1>
          <p className="page-subtitle">Inspect every parsed numeric channel—including newly added telemetry columns—and export the original signal columns.</p>
        </div>
        <button className="button button-secondary" onClick={exportFiltered} disabled={filteredRows.length === 0}><Download size={16} /> Export filtered CSV</button>
      </div>

      <section className="info-card raw-data-card">
        <div className="raw-toolbar">
          <div className="raw-toolbar-title"><span className="icon-well"><SlidersHorizontal size={17} /></span><div><strong>Sample explorer</strong><small>{filteredRows.length.toLocaleString()} of {dataset.rows.length.toLocaleString()} rows</small></div></div>
          <div className="raw-filters">
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search CAN ID, status, values…" /></label>
            <label className="select-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
        </div>
        <div className="table-scroll raw-table-scroll">
          <table className="data-table raw-table">
            <thead>
              <tr>
                <th>ELAPSED</th><th>TIMESTAMP MS</th><th>CAN ID</th>
                {dataset.signalKeys.map((key, index) => {
                  const definition = getSignalDefinition(key, index);
                  return <th key={key}>{definition.label.toUpperCase()}{definition.unit ? ` (${definition.unit})` : ''}</th>;
                })}
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={`${row.sourceIndex}-${row.timestamp_ms}`}>
                  <td className="elapsed-cell">{formatTimestamp(row.timestamp_ms, firstTimestamp)}</td>
                  <td className="numeric-cell">{row.timestamp_ms.toLocaleString()}</td>
                  <td><span className="can-id-tag">{row.can_id}</span></td>
                  {dataset.signalKeys.map((key, index) => {
                    const definition = getSignalDefinition(key, index);
                    return <td className="numeric-cell" key={key}>{row.signals[key] === null || row.signals[key] === undefined ? '—' : row.signals[key]?.toFixed(definition.precision)}</td>;
                  })}
                  <td><StatusPill status={row.status} subtle /></td>
                </tr>
              ))}
              {visibleRows.length === 0 && <tr><td colSpan={4 + dataset.signalKeys.length} className="empty-table-cell">No rows match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Showing {filteredRows.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length.toLocaleString()} samples</span>
          <div className="pagination-controls"><button onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ChevronLeft size={16} /> Previous</button><span>Page <strong>{page + 1}</strong> / {pageCount}</span><button onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}>Next <ChevronRight size={16} /></button></div>
        </div>
      </section>
      <div className="method-note"><span className="note-mark">i</span><span>Rows are displayed in timestamp order. The source row index is retained internally for traceability; exported CSV values are taken from the parsed input columns.</span></div>
    </div>
  );
}
