import React from 'react';
import { 
  CheckCircle2, 
  Settings2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  TrendingDown, 
  Droplets,
  BookOpen,
  ArrowRight
} from 'lucide-react';

export default function InterventionCard({
  intervention,
  status,
  selectedOption,
  onSelectOption,
  onApprove,
  onOpenModifyModal,
  onOpenRejectModal,
  supervisorNote,
}) {
  const { primaryRecommendation, dangerWindow, personHoursAverted, waterRequirementLiters, options, id } = intervention;

  return (
    <div className="panel-frame" id="protocol-intervention-panel">
      <div className="panel-header-bar">
        <div className="panel-title-group">
          <ShieldAlert size={15} color="var(--color-brand)" />
          <span className="panel-heading-text">Operational Intervention Directive</span>
          <span className="protocol-id-badge">{id}</span>
        </div>

        <div>
          {status === 'APPROVED' && (
            <span className="status-indicator-tag verified">
              ● Active & Dispatched
            </span>
          )}
          {status === 'MODIFIED' && (
            <span className="status-indicator-tag acknowledged">
              ● Custom Parameters
            </span>
          )}
          {status === 'REJECTED' && (
            <span className="status-indicator-tag emergency">
              ● Exception Logged
            </span>
          )}
          {status === 'PENDING_APPROVAL' && (
            <span className="status-indicator-tag pending">
              ● Awaiting Supervisor Auth
            </span>
          )}
        </div>
      </div>

      <div className="intervention-console">
        <h2 className="directive-headline">{primaryRecommendation.title}</h2>
        
        <div className="directive-summary-box">
          {primaryRecommendation.summary}
        </div>

        {/* 3-Column Enterprise Impact Strip */}
        <div className="impact-strip">
          <div className="impact-tile">
            <div className="impact-label">Exposure Window</div>
            <div className="impact-value" style={{ color: 'var(--color-danger)' }}>
              <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />
              {dangerWindow}
            </div>
          </div>
          <div className="impact-tile">
            <div className="impact-label">Risk Mitigation</div>
            <div className="impact-value" style={{ color: 'var(--color-safe)' }}>
              <TrendingDown size={13} style={{ display: 'inline', marginRight: 4 }} />
              {primaryRecommendation.operationalTradeoff.heatStrokeRiskMitigation}
            </div>
          </div>
          <div className="impact-tile">
            <div className="impact-label">Hydration Logistics</div>
            <div className="impact-value" style={{ color: 'var(--color-accent)' }}>
              <Droplets size={13} style={{ display: 'inline', marginRight: 4 }} />
              {waterRequirementLiters}L Electrolyte
            </div>
          </div>
        </div>

        {/* Selectable Strategy Matrix */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
            OPERATIONAL STRATEGY VARIANT:
          </div>
          <div className="strategy-selector">
            {options.map((opt) => (
              <div
                key={opt.id}
                className={`strategy-row ${selectedOption === opt.id ? 'selected' : ''}`}
                onClick={() => onSelectOption(opt.id)}
              >
                <div className="strategy-title-block">
                  <div className="custom-radio">
                    {selectedOption === opt.id && <div className="custom-radio-inner" />}
                  </div>
                  <div>
                    <div className="strategy-name">{opt.name}</div>
                    <div className="strategy-desc">{opt.description}</div>
                  </div>
                </div>

                <div className="strategy-meta-chip">
                  -{opt.riskReduction} Exposure
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Regulatory Citation */}
        <div className="regulatory-citation-strip">
          <BookOpen size={13} color="var(--text-tertiary)" />
          <span><strong>Compliance Standard:</strong> {primaryRecommendation.regulatoryBasis}</span>
        </div>

        {supervisorNote && (
          <div 
            style={{ 
              fontSize: '0.78rem', 
              background: 'rgba(2, 132, 199, 0.08)', 
              border: '1px solid rgba(2, 132, 199, 0.25)', 
              color: '#38bdf8', 
              padding: '8px 12px', 
              borderRadius: 'var(--radius-xs)', 
              marginBottom: '16px',
              fontFamily: 'var(--font-mono)'
            }}
          >
            <strong>SUPERVISOR EXCEPTION NOTE:</strong> "{supervisorNote}"
          </div>
        )}

        {/* Action Controls */}
        <div className="action-controls-bar">
          <button
            id="btn-approve-intervention"
            className="btn-authorize"
            onClick={onApprove}
            disabled={status === 'APPROVED'}
            style={{ opacity: status === 'APPROVED' ? 0.75 : 1 }}
          >
            <CheckCircle2 size={16} />
            {status === 'APPROVED' ? 'Protocol Dispatched & Active' : 'Authorize & Deploy Protocol'}
          </button>

          <button
            id="btn-modify-intervention"
            className="btn-outline-neutral"
            onClick={onOpenModifyModal}
          >
            <Settings2 size={14} />
            Configure Parameters
          </button>

          <button
            id="btn-reject-intervention"
            className="btn-outline-danger"
            onClick={onOpenRejectModal}
          >
            <XCircle size={14} />
            Log Exception / Override
          </button>
        </div>
      </div>
    </div>
  );
}
