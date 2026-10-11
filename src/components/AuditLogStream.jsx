import React from 'react';
import { History, ShieldCheck, AlertCircle, Info } from 'lucide-react';

export default function AuditLogStream({ auditLogs }) {
  return (
    <div className="panel-frame" id="audit-logs-panel">
      <div className="panel-header-bar">
        <div className="panel-title-group">
          <History size={15} color="#38bdf8" />
          <span className="panel-heading-text">EventBridge Immutable Audit Trail</span>
        </div>
        <span className="panel-meta-tag">
          {auditLogs.length} Events Recorded
        </span>
      </div>

      <div className="audit-stream-list" id="audit-stream-container">
        {auditLogs.map((log) => {
          let badgeColor = '#3b82f6';
          let IconComponent = Info;

          if (log.severity === 'danger') {
            badgeColor = 'var(--color-danger)';
            IconComponent = AlertCircle;
          } else if (log.severity === 'success') {
            badgeColor = 'var(--color-safe)';
            IconComponent = ShieldCheck;
          }

          return (
            <div key={log.id} className="audit-stream-item">
              <div className="audit-timestamp">{log.time}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconComponent size={13} color={badgeColor} />
                  <span className="audit-actor-title">{log.actor}</span>
                  <span className="panel-meta-tag" style={{ fontSize: '0.62rem' }}>
                    {log.type}
                  </span>
                </div>
                <div className="audit-details-text">{log.details}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
