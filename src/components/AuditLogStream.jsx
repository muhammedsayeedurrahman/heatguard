import React from 'react';
import { History, ShieldCheck, AlertCircle, Info, Fingerprint } from 'lucide-react';

function LedgerStatus({ ledger, onVerify, count }) {
  if (!ledger?.head) {
    return <span className="panel-meta-tag">{count} Events · Browser Session Only</span>;
  }
  const verification = ledger.verification;
  const store = ledger.kind === 'dynamodb' ? 'DynamoDB' : 'In-memory';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span
        className="panel-meta-tag"
        title={`Ledger head ${ledger.head.headHash}`}
        style={{ color: verification ? (verification.valid ? 'var(--color-safe)' : 'var(--color-danger)') : undefined }}
      >
        {store} · #{ledger.head.seq}
        {verification ? (verification.valid ? ' · chain ✓' : ` · BROKEN @${verification.brokenAtSeq}`) : ''}
      </span>
      <button
        id="btn-verify-ledger"
        className="btn-outline-neutral"
        style={{ padding: '2px 8px', fontSize: '0.66rem', gap: '4px' }}
        onClick={onVerify}
        title="Re-hash the full SHA-256 chain from genesis"
      >
        <Fingerprint size={11} />
        Verify
      </button>
    </span>
  );
}

export default function AuditLogStream({ auditLogs, ledger, onVerifyLedger }) {
  return (
    <div className="panel-frame" id="audit-logs-panel">
      <div className="panel-header-bar" style={{ gap: '8px', flexWrap: 'wrap' }}>
        <div className="panel-title-group">
          <History size={15} color="#38bdf8" />
          <span className="panel-heading-text">Tamper-Evident Audit Ledger</span>
        </div>
        <LedgerStatus ledger={ledger} onVerify={onVerifyLedger} count={auditLogs.length} />
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <IconComponent size={13} color={badgeColor} />
                  <span className="audit-actor-title">{log.actor}</span>
                  <span className="panel-meta-tag" style={{ fontSize: '0.62rem' }}>
                    {log.type}
                  </span>
                  {log.persisted ? (
                    <span className="ledger-chip persisted" title={`SHA-256 ${log.hash}`}>
                      #{log.seq} · {log.hash.slice(0, 8)}
                    </span>
                  ) : (
                    ledger?.head && <span className="ledger-chip" title="Not (yet) written to the server ledger">local</span>
                  )}
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
