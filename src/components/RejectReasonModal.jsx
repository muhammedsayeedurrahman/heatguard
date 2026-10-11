import React, { useState } from 'react';
import { AlertOctagon, X, ShieldAlert } from 'lucide-react';

export default function RejectReasonModal({ isOpen, onClose, onConfirmReject, activeSite }) {
  // Hooks must run on every render, so the early return comes after them.
  const [selectedReason, setSelectedReason] = useState('ACTIVE_COOLING_DEPLOYED');
  const [customExplanation, setCustomExplanation] = useState('');

  if (!isOpen) return null;

  const REASONS = [
    {
      id: 'ACTIVE_COOLING_DEPLOYED',
      label: 'Industrial Misting Fans & Ice Vests Active on Elevated Viaduct',
      description: 'Physical cooling infrastructure deployed directly reduces microclimate WBGT by ~3.2°C.',
    },
    {
      id: 'CRITICAL_CONCRETE_POUR',
      label: 'Structural Concrete Curing Window in Progress',
      description: 'Pour cannot be halted; additional relief teams dispatched with continuous hydration monitoring.',
    },
    {
      id: 'LOCAL_MEASUREMENT_VARIATION',
      label: 'Handheld Wet-Bulb Sensor Shows Lower Heat Stress (Under 29°C)',
      description: 'On-site canopy microclimate is cooler than ambient meteorological model estimates.',
    },
    {
      id: 'OTHER_OPERATIONAL_OVERRIDE',
      label: 'Manual Operational Override (Supervisor Legal Accountability)',
      description: 'Custom explanation required for labor compliance registry.',
    },
  ];

  const handleConfirm = () => {
    const chosen = REASONS.find((r) => r.id === selectedReason);
    const finalReason = customExplanation.trim()
      ? `${chosen.label} — Detail: ${customExplanation}`
      : chosen.label;

    onConfirmReject(finalReason);
    onClose();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div 
        style={{ 
          maxWidth: '540px', 
          width: '100%', 
          padding: '24px', 
          background: '#0d1017',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 800, color: 'var(--color-danger)' }}>
            <AlertOctagon size={18} />
            <span>Mandatory Safety Exception Log</span>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
          Rejecting an OSHA/NIOSH-derived heat intervention requires logging a valid operational justification into the immutable safety ledger.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {REASONS.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedReason(r.id)}
              style={{
                background: selectedReason === r.id ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 0, 0, 0.25)',
                border: selectedReason === r.id ? '1px solid var(--color-danger)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
                padding: '10px 12px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: selectedReason === r.id ? '#fca5a5' : 'var(--text-primary)' }}>
                {r.label}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                {r.description}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
            Additional Supervisor Comments (Optional):
          </label>
          <input
            type="text"
            value={customExplanation}
            onChange={(e) => setCustomExplanation(e.target.value)}
            placeholder="e.g. Batch supplier arrivals; 3 auxiliary shade tents deployed"
            style={{
              width: '100%',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              padding: '8px 10px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.82rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            className="btn-outline-neutral"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-outline-danger"
            style={{ background: 'var(--color-danger)', color: '#fff', borderColor: 'var(--color-danger)' }}
            onClick={handleConfirm}
          >
            Confirm Rejection & Log Exception
          </button>
        </div>
      </div>
    </div>
  );
}
