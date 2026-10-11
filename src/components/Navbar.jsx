import React from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Sliders, 
  Smartphone, 
  LayoutDashboard, 
  Columns3, 
  FileCheck2,
  ChevronRight,
  Radio
} from 'lucide-react';
import { SITE_PRESETS } from '../services/weatherService';

export default function Navbar({
  activeSite,
  onSelectSite,
  viewMode,
  onChangeViewMode,
  isPlaygroundOpen,
  onTogglePlayground,
  onOpenReportModal,
  liveWeatherStatus,
}) {
  return (
    <header className="console-nav" id="heatguard-navbar">
      <div className="nav-left">
        <div className="brand-badge">
          <div className="brand-logo-mark">
            <ShieldAlert size={16} color="#ffffff" />
          </div>
          <span>HEATGUARD</span>
        </div>

        {/* Enterprise Breadcrumb Trail */}
        <div className="breadcrumb-trail">
          <span className="breadcrumb-item">Operations</span>
          <ChevronRight size={12} />
          <span className="breadcrumb-item">{activeSite.industry.split(' ')[0]}</span>
          <ChevronRight size={12} />
          <div className="site-dropdown-wrapper">
            <select
              id="site-selector-dropdown"
              className="site-select-input"
              value={activeSite.id}
              onChange={(e) => {
                const selected = SITE_PRESETS.find((s) => s.id === e.target.value);
                if (selected) onSelectSite(selected);
              }}
            >
              {SITE_PRESETS.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.city})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="nav-center">
        {/* Segmented View Mode Tabs */}
        <div className="segmented-control" id="view-mode-tabs">
          <button
            id="tab-supervisor-view"
            className={`segmented-tab ${viewMode === 'supervisor' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('supervisor')}
          >
            <LayoutDashboard size={13} />
            Command Center
          </button>
          <button
            id="tab-worker-view"
            className={`segmented-tab ${viewMode === 'worker' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('worker')}
          >
            <Smartphone size={13} />
            Field Terminal
          </button>
          <button
            id="tab-dual-view"
            className={`segmented-tab ${viewMode === 'dual' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('dual')}
          >
            <Columns3 size={13} />
            Split Telemetry
          </button>
        </div>
      </div>

      <div className="nav-right">
        {/* Weather Stream Status */}
        <div className="stream-status-pill">
          <span 
            className="live-pulse-dot" 
            style={{ 
              background: liveWeatherStatus?.isLive ? 'var(--color-safe)' : 'var(--color-caution)',
              boxShadow: liveWeatherStatus?.isLive ? '0 0 6px var(--color-safe)' : '0 0 6px var(--color-caution)'
            }} 
          />
          <span>{liveWeatherStatus?.isLive ? 'Open-Meteo Live' : 'Physical Model'}</span>
        </div>

        {/* Audit Certificate Button */}
        <button
          id="btn-open-audit-report"
          className="btn-outline-neutral"
          style={{ padding: '6px 12px', fontSize: '0.76rem' }}
          onClick={onOpenReportModal}
        >
          <FileCheck2 size={14} color="#10b981" />
          Audit Ledger
        </button>

        {/* Diagnostics / Playground Toggle */}
        <button
          id="btn-toggle-playground"
          className="btn-outline-neutral"
          style={{ 
            padding: '6px 12px', 
            fontSize: '0.76rem',
            borderColor: isPlaygroundOpen ? 'var(--color-accent)' : undefined,
            color: isPlaygroundOpen ? '#38bdf8' : undefined
          }}
          onClick={onTogglePlayground}
        >
          <Sliders size={13} />
          {isPlaygroundOpen ? 'Diagnostics On' : 'Simulation'}
        </button>
      </div>
    </header>
  );
}
