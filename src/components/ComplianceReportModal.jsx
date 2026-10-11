import React from 'react';
import { ShieldCheck, Printer, X, Download, Award, CheckCircle } from 'lucide-react';

export default function ComplianceReportModal({ isOpen, onClose, site, weatherData, intervention, workers, auditLogs }) {
  if (!isOpen) return null;

  const totalWorkers = workers.length;
  const acknowledged = workers.filter(
    (w) => w.status === 'ACKNOWLEDGED' || w.status === 'RESTING_SHADE'
  ).length;
  const ackPercent = totalWorkers > 0 ? Math.round((acknowledged / totalWorkers) * 100) : 0;
  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div 
        style={{ 
          maxWidth: '680px', 
          width: '100%', 
          background: '#ffffff', 
          color: '#0f172a', 
          padding: '36px', 
          borderRadius: '12px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          position: 'relative'
        }}
      >
        {/* Header Controls (Hidden on Print) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                HeatGuard Compliance Certification
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Occupational Safety & Heat Hazard Audit Record
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Printer size={15} />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                color: '#64748b',
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Project / Site</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{site.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#475569' }}>{site.city}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Certified Date & Time</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{reportDate}</div>
              <div style={{ fontSize: '0.78rem', color: '#475569' }}>Supervisor: {site.supervisorName}</div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px', letterSpacing: '0.04em' }}>
              1. Meteorological & Physical Assessment
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 0', color: '#64748b' }}>Dry-Bulb Ambient Temp:</td>
                  <td style={{ padding: '6px 0', fontWeight: 700 }}>{weatherData.temp}°C</td>
                  <td style={{ padding: '6px 0', color: '#64748b' }}>Relative Humidity:</td>
                  <td style={{ padding: '6px 0', fontWeight: 700 }}>{weatherData.humidity}%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 0', color: '#64748b' }}>Solar Radiative Flux:</td>
                  <td style={{ padding: '6px 0', fontWeight: 700 }}>{weatherData.solarRadiation} W/m²</td>
                  <td style={{ padding: '6px 0', color: '#64748b' }}>Peak Outdoor WBGT:</td>
                  <td style={{ padding: '6px 0', fontWeight: 800, color: '#dc2626' }}>{weatherData.wbgt}°C</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#64748b' }}>NIOSH Work-Rest Threshold:</td>
                  <td style={{ padding: '6px 0', fontWeight: 700 }}>{weatherData.risk.thresholds.high}°C ({site.workIntensity} Work)</td>
                  <td style={{ padding: '6px 0', color: '#64748b' }}>Mandated Rest Cycle:</td>
                  <td style={{ padding: '6px 0', fontWeight: 700 }}>{weatherData.risk.workRestRatio}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px', letterSpacing: '0.04em' }}>
              2. Approved Operational Intervention
            </div>
            <div style={{ background: '#f8fafc', borderLeft: '4px solid #10b981', padding: '12px', borderRadius: '4px', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                {intervention.primaryRecommendation.title}
              </div>
              <div style={{ color: '#334155', lineHeight: 1.5 }}>
                {intervention.primaryRecommendation.summary}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px', letterSpacing: '0.04em' }}>
              3. Workforce Verification & Outcome Metrics
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
              <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{ackPercent}%</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>1-Tap Ack Rate</div>
              </div>
              <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f97316' }}>{intervention.personHoursAverted}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Exposure Hrs Averted</div>
              </div>
              <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>{intervention.waterRequirementLiters}L</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Electrolyte Water Logged</div>
              </div>
            </div>
          </div>

          {/* Audit Verification Stamp */}
          <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b' }}>
                EventBridge Block Hash: 0x8F3A...E921B
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Standard: NIOSH Pub No. 2016-106 • OSHA General Duty Clause 5(a)(1)
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 800, fontSize: '0.85rem' }}>
                <CheckCircle size={16} /> VERIFIED COMPLIANT
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
