import React, { useState } from 'react';
import { Users, Send, AlertOctagon, Droplets, CheckCircle, Clock } from 'lucide-react';

export default function WorkforceGrid({ workers, onPingUnacknowledged, onSelectWorkerForPreview }) {
  const [filter, setFilter] = useState('ALL');

  const filteredWorkers = workers.filter((w) => {
    if (filter === 'PENDING') return w.status === 'NOTIFIED';
    if (filter === 'ACK') return w.status === 'ACKNOWLEDGED' || w.status === 'RESTING_SHADE';
    if (filter === 'EMERGENCY') return w.emergency;
    return true;
  });

  const pendingCount = workers.filter((w) => w.status === 'NOTIFIED').length;
  const emergencyCount = workers.filter((w) => w.emergency).length;

  return (
    <div className="panel-frame" id="workforce-compliance-panel">
      <div className="panel-header-bar">
        <div className="panel-title-group">
          <Users size={15} color="var(--color-safe)" />
          <span className="panel-heading-text">Personnel Verification Roster</span>
          <span className="panel-meta-tag">{workers.length} Total Field Personnel</span>
        </div>

        {pendingCount > 0 && (
          <button
            id="btn-ping-pending-workers"
            className="btn-outline-neutral"
            style={{ padding: '4px 10px', fontSize: '0.72rem', gap: '5px' }}
            onClick={onPingUnacknowledged}
            title="Dispatch priority SMS reminder to unacknowledged personnel"
          >
            <Send size={12} color="var(--color-brand)" />
            Nudge {pendingCount} Pending
          </button>
        )}
      </div>

      {/* Roster Filter Bar */}
      <div className="roster-toolbar">
        <div className="roster-filter-pills">
          <button
            className={`filter-pill-btn ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            All Personnel ({workers.length})
          </button>
          <button
            className={`filter-pill-btn ${filter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setFilter('PENDING')}
          >
            Pending ({pendingCount})
          </button>
          <button
            className={`filter-pill-btn ${filter === 'ACK' ? 'active' : ''}`}
            onClick={() => setFilter('ACK')}
          >
            Verified ({workers.length - pendingCount})
          </button>
          {emergencyCount > 0 && (
            <button
              className="filter-pill-btn"
              style={{
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderColor: 'var(--color-danger-border)',
                fontWeight: 700,
              }}
              onClick={() => setFilter('EMERGENCY')}
            >
              SOS Alert ({emergencyCount})
            </button>
          )}
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Sync: 1-Tap Telemetry Active
        </span>
      </div>

      {/* Data Table */}
      <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
        <table className="roster-table" id="roster-data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Personnel</th>
              <th>Trade / Assignment</th>
              <th>Cooling Hub</th>
              <th>Hydration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkers.map((worker) => (
              <tr
                key={worker.id}
                className={worker.emergency ? 'emergency-row' : ''}
                onClick={() => onSelectWorkerForPreview && onSelectWorkerForPreview(worker)}
                style={{ cursor: 'pointer' }}
                title="Select to view mobile field terminal"
              >
                <td className="personnel-id">{worker.id}</td>
                <td>
                  <span className="personnel-name">{worker.name}</span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{worker.role}</td>
                <td style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                  {worker.hub}
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0284c7' }}>
                    <Droplets size={12} />
                    {worker.waterGlasses} gl
                  </span>
                </td>
                <td>
                  {worker.emergency ? (
                    <span className="status-indicator-tag emergency">
                      <AlertOctagon size={11} /> SOS DISTRESS
                    </span>
                  ) : worker.status === 'RESTING_SHADE' ? (
                    <span className="status-indicator-tag verified">
                      <CheckCircle size={11} /> RESTING SHADE
                    </span>
                  ) : worker.status === 'ACKNOWLEDGED' ? (
                    <span className="status-indicator-tag acknowledged">
                      ACKNOWLEDGED
                    </span>
                  ) : (
                    <span className="status-indicator-tag pending">
                      <Clock size={11} /> PENDING
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
