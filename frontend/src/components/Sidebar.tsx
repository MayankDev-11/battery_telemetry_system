import { BatteryCharging, ChevronRight, Database, Gauge, LayoutDashboard, Waves } from 'lucide-react';
import type { DashboardView } from '../types/telemetry';

interface SidebarProps {
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  rowCount: number;
}

const navItems: { id: DashboardView; label: string; icon: typeof LayoutDashboard; description: string }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Run summary' },
  { id: 'cells', label: 'Cell analysis', icon: BatteryCharging, description: 'Cell-level voltage' },
  { id: 'raw', label: 'Raw data', icon: Database, description: 'CSV samples' },
];

export default function Sidebar({ activeView, onNavigate, rowCount }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark"><Waves size={22} strokeWidth={2.3} /></div>
        <div className="brand-name">VOLT<span>VIEW</span><small>BATTERY TELEMETRY</small></div>
      </div>

      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Dashboard navigation">
        {navItems.map(({ id, label, icon: Icon, description }) => (
          <button key={id} className={`nav-item${activeView === id ? ' nav-item-active' : ''}`} onClick={() => onNavigate(id)}>
            <Icon size={18} />
            <span className="nav-copy"><strong>{label}</strong><small>{description}</small></span>
            {activeView === id && <ChevronRight size={15} className="nav-chevron" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />
      <div className="sidebar-run-card">
        <div className="sidebar-run-icon"><Gauge size={17} /></div>
        <div><strong>Telemetry loaded</strong><small>{rowCount.toLocaleString()} samples</small></div>
        <span className="loaded-indicator" />
      </div>
      <div className="sidebar-footer">
        <span>VOLT / ENGINEERING TOOLS</span>
        <span>BUILD 1.0.0</span>
      </div>
    </aside>
  );
}
