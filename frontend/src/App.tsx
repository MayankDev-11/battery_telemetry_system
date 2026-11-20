import { useEffect, useState } from 'react';
import { AlertTriangle, BatteryFull, CheckCircle2, CircleHelp, FileSpreadsheet, Moon, RefreshCw, Sun } from 'lucide-react';
import FileUploader from './components/FileUploader';
import Sidebar from './components/Sidebar';
import CellAnalysisPage from './pages/CellAnalysisPage';
import OverviewPage from './pages/OverviewPage';
import RawDataPage from './pages/RawDataPage';
import { parseCsvFile, parseCsvText } from './lib/csv';
import type { DashboardView, Dataset } from './types/telemetry';

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return window.localStorage.getItem('voltview-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1321' : '#f3f6fa');
    try {
      window.localStorage.setItem('voltview-theme', theme);
    } catch {
      // Theme still works for this session when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    fetch('/sample-bms.csv')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the bundled demo CSV.');
        return response.text();
      })
      .then((text) => {
        if (cancelled) return;
        setDataset(parseCsvText(text, 'sample-bms.csv'));
        setIsDemo(true);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load the demo dataset.');
      });
    return () => { cancelled = true; };
  }, []);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const nextDataset = await parseCsvFile(file);
      setDataset(nextDataset);
      setIsDemo(false);
      setActiveView('overview');
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Could not parse this CSV file.');
    } finally {
      setBusy(false);
    }
  };

  const reloadDemo = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/sample-bms.csv');
      if (!response.ok) throw new Error('Could not reload the demo CSV.');
      setDataset(parseCsvText(await response.text(), 'sample-bms.csv'));
      setIsDemo(true);
      setActiveView('overview');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to reload demo data.');
    } finally {
      setBusy(false);
    }
  };

  const viewTitle = activeView === 'overview' ? 'OVERVIEW' : activeView === 'cells' ? 'CELL ANALYSIS' : 'RAW DATA';

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={setActiveView} rowCount={dataset?.rows.length ?? 0} />
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-breadcrumb">BATTERY SYSTEM <span>/</span> {viewTitle}</div>
            <div className="topbar-session"><span className="topbar-dot" />{dataset?.sourceName ?? 'Waiting for telemetry file'}</div>
          </div>
          <div className="topbar-actions">
            <button
              className="button button-quiet theme-toggle"
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-pressed={theme === 'dark'}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <div className={`source-badge${isDemo ? ' source-demo' : ' source-live'}`}>
              {isDemo ? <CircleHelp size={13} /> : <CheckCircle2 size={13} />}
              {isDemo ? 'DEMO DATA' : 'CSV LOADED'}
            </div>
            <button className="button button-quiet" onClick={reloadDemo} disabled={busy} title="Reload the bundled sample file"><RefreshCw size={15} /> Demo</button>
            <FileUploader compact onFile={handleFile} busy={busy} />
          </div>
        </header>

        <main className="main-content">
          {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}
          {dataset ? (
            <>
              {dataset.diagnostics.warnings.length > 0 && (
                <div className="diagnostic-banner"><AlertTriangle size={16} /><div><strong>CSV data quality notes</strong><span>{dataset.diagnostics.warnings.join(' ')}</span></div></div>
              )}
              {activeView === 'overview' && <OverviewPage dataset={dataset} />}
              {activeView === 'cells' && <CellAnalysisPage dataset={dataset} />}
              {activeView === 'raw' && <RawDataPage dataset={dataset} />}
            </>
          ) : (
            <div className="empty-state-page">
              <div className="empty-state-icon"><BatteryFull size={30} /></div>
              <h1>Load a telemetry recording</h1>
              <p>Import a CSV exported from your CAN logger to inspect pack signals, cell voltages, and status samples.</p>
              <FileUploader onFile={handleFile} busy={busy} />
              <small>Expected format: timestamp_ms, can_id, pack signals, cell voltage columns, status.</small>
            </div>
          )}
          {busy && <div className="loading-strip"><span />Parsing telemetry file in your browser…</div>}
        </main>
        <footer className="app-footer"><span><FileSpreadsheet size={13} /> LOCAL CSV ANALYSIS</span><span>VOLT VIEW <i>·</i> TELEMETRY WORKSPACE</span></footer>
      </div>
    </div>
  );
}
