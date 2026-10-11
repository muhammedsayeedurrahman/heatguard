import React, { useState } from 'react';
import { Settings2, X, Check } from 'lucide-react';

export default function ModifyInterventionModal({ isOpen, onClose, onSave, intervention, activeSite }) {
  if (!isOpen) return null;

  const [shiftStart, setShiftStart] = useState('06:30');
  const [shiftEnd, setShiftEnd] = useState('11:00');
  const [restDurationMins, setRestDurationMins] = useState(30);
  const [waterPerWorkerLiters, setWaterPerWorkerLiters] = useState(3.5);
  const [activeMistingFans, setActiveMistingFans] = useState(4);
  const [supervisorNote, setSupervisorNote] = useState('Shift advanced by 2 hours. Misting canopies active at Tower 4.');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      shiftStart,
      shiftEnd,
      restDurationMins,
      waterPerWorkerLiters,
      activeMistingFans,
      supervisorNote,
    });
    onClose();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
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
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 800 }}>
            <Settings2 size={17} color="#38bdf8" />
            <span>Configure Operational Parameters</span>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Shift Start:
              </label>
              <input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Shift End:
              </label>
              <input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Rest Duration:
              </label>
              <select
                value={restDurationMins}
                onChange={(e) => setRestDurationMins(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.82rem',
                }}
              >
                <option value={15}>15m Rest / 45m Work</option>
                <option value={20}>20m Rest / 40m Work</option>
                <option value={30}>30m Rest / 30m Work</option>
                <option value={45}>45m Rest / 15m Work</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Water Quota (L/Worker):
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="8"
                value={waterPerWorkerLiters}
                onChange={(e) => setWaterPerWorkerLiters(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Supervisor Safety Rationale (Recorded to EventBridge):
            </label>
            <textarea
              rows={3}
              value={supervisorNote}
              onChange={(e) => setSupervisorNote(e.target.value)}
              placeholder="Operational reasoning for schedule modification..."
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
              type="submit"
              className="btn-authorize"
            >
              <Check size={14} />
              Save & Dispatch Custom Shift
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
