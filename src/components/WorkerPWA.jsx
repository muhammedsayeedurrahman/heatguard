import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Volume2, 
  Droplets, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  Wifi,
  WifiOff,
  UserCheck
} from 'lucide-react';
import { speakDirective } from '../services/interventionEngine';

export default function WorkerPWA({
  activeWorker,
  workers,
  onSelectWorker,
  intervention,
  onAcknowledge,
  onLogWater,
  onReportEmergency,
  weatherData,
  isOfflineMode,
}) {
  const [lang, setLang] = useState('ta'); // Default to Tamil for Chennai Metro
  const [sunlightMode, setSunlightMode] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(900); // 15 mins default
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [justLoggedWater, setJustLoggedWater] = useState(false);

  const directive = intervention?.workerDirectives?.[lang] || intervention?.workerDirectives?.en;
  const isAcknowledged = activeWorker?.status === 'ACKNOWLEDGED' || activeWorker?.status === 'RESTING_SHADE';

  // Timer countdown
  useEffect(() => {
    let timer;
    if (isTimerRunning && restSecondsLeft > 0) {
      timer = setInterval(() => {
        setRestSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, restSecondsLeft]);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAudioSpeak = () => {
    if (directive?.audioText) {
      speakDirective(directive.audioText, lang);
    }
  };

  const handleWaterClick = () => {
    onLogWater(activeWorker.id);
    setJustLoggedWater(true);
    setTimeout(() => setJustLoggedWater(false), 1200);
  };

  const handleStartRestTimer = () => {
    setIsTimerRunning(true);
    setRestSecondsLeft(900);
  };

  return (
    <div className={`tactical-terminal-frame ${sunlightMode ? 'sunlight-mode' : ''}`} id="worker-field-terminal">
      {/* Tactical Top Bar */}
      <div className="terminal-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOfflineMode ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--color-caution)', fontFamily: 'var(--font-mono)' }}>
              <WifiOff size={13} /> OFFLINE QUEUE
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--color-safe)', fontFamily: 'var(--font-mono)' }}>
              <Wifi size={13} /> SYNCED
            </span>
          )}
        </div>

        {/* Sunlight High Contrast Mode Toggle */}
        <button
          id="btn-sunlight-toggle"
          onClick={() => setSunlightMode(!sunlightMode)}
          style={{
            background: sunlightMode ? '#090a0f' : '#f8fafc',
            color: sunlightMode ? '#ffffff' : '#090a0f',
            border: 'none',
            borderRadius: 'var(--radius-xs)',
            padding: '3px 8px',
            fontSize: '0.68rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Toggle high-contrast sunlight readability"
        >
          <Sun size={12} />
          {sunlightMode ? 'Dark Terminal' : 'Sunlight Contrast'}
        </button>

        {/* Language Selector */}
        <div className="segmented-control" style={{ background: sunlightMode ? '#e2e8f0' : undefined }}>
          <button
            className={`segmented-tab ${lang === 'en' ? 'active' : ''}`}
            style={{ padding: '3px 8px', fontSize: '0.68rem' }}
            onClick={() => setLang('en')}
          >
            EN
          </button>
          <button
            className={`segmented-tab ${lang === 'hi' ? 'active' : ''}`}
            style={{ padding: '3px 8px', fontSize: '0.68rem' }}
            onClick={() => setLang('hi')}
          >
            हिंदी
          </button>
          <button
            className={`segmented-tab ${lang === 'ta' ? 'active' : ''}`}
            style={{ padding: '3px 8px', fontSize: '0.68rem' }}
            onClick={() => setLang('ta')}
          >
            தமிழ்
          </button>
        </div>
      </div>

      {/* Personnel Identification */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: sunlightMode ? '#f8fafc' : 'rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={16} color="var(--color-brand)" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>
              {activeWorker?.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: sunlightMode ? '#475569' : 'var(--text-tertiary)' }}>
              {activeWorker?.role} • <span style={{ color: '#0284c7' }}>{activeWorker?.hub}</span>
            </div>
          </div>
        </div>

        <select
          value={activeWorker?.id}
          onChange={(e) => {
            const w = workers.find((item) => item.id === e.target.value);
            if (w) onSelectWorker(w);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '0.72rem',
            color: 'var(--color-brand)',
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {workers.map((w) => (
            <option key={w.id} value={w.id} style={{ background: '#090a0f', color: '#fff' }}>
              ID: {w.id} ({w.name.split(' ')[0]})
            </option>
          ))}
        </select>
      </div>

      {/* Hazard Status Strip */}
      <div 
        style={{ 
          padding: '14px 16px', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderBottom: '1px solid var(--color-danger-border)',
          borderLeft: '4px solid var(--color-danger)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} />
            {directive?.title}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--color-danger)', fontWeight: 700 }}>
            {weatherData.wbgt}°C WBGT
          </span>
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: sunlightMode ? '#991b1b' : '#fca5a5' }}>
          {directive?.shiftAdjustment}
        </div>
      </div>

      {/* Directives Checklist */}
      <div className="terminal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
            Protocol Directives:
          </span>
          <button
            id="btn-listen-audio"
            onClick={handleAudioSpeak}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              color: sunlightMode ? '#090a0f' : '#f8fafc',
              padding: '3px 8px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Volume2 size={13} color="var(--color-brand)" />
            Voice Readout
          </button>
        </div>

        <ul style={{ paddingLeft: '18px', fontSize: '0.84rem', lineHeight: 1.5 }}>
          {directive?.actionSteps?.map((step, idx) => (
            <li key={idx} style={{ marginBottom: '6px' }}>
              {step}
            </li>
          ))}
        </ul>
      </div>

      {/* Rest Interval Timer */}
      <div 
        className="terminal-card" 
        style={{ 
          textAlign: 'center',
          borderColor: isTimerRunning ? 'var(--color-safe)' : undefined,
          background: isTimerRunning ? 'rgba(16, 185, 129, 0.05)' : undefined
        }}
      >
        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
          <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
          MANDATORY SHADED REST INTERVAL
        </div>
        <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: isTimerRunning ? 'var(--color-safe)' : undefined }}>
          {formatTimer(restSecondsLeft)}
        </div>
        <div style={{ marginTop: '4px' }}>
          {!isTimerRunning ? (
            <button
              onClick={handleStartRestTimer}
              className="btn-outline-neutral"
              style={{ padding: '4px 12px', fontSize: '0.74rem' }}
            >
              Start 15m Canopy Rest
            </button>
          ) : (
            <span style={{ fontSize: '0.72rem', color: 'var(--color-safe)', fontWeight: 700 }}>
              ● Canopy Rest Cycle in Progress
            </span>
          )}
        </div>
      </div>

      {/* Tactical Action Buttons */}
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* 1-Tap Acknowledge */}
        <button
          id="btn-worker-ack"
          className={`tactical-btn-ack ${isAcknowledged ? 'verified-state' : ''}`}
          onClick={() => onAcknowledge(activeWorker.id)}
          disabled={isAcknowledged}
        >
          {isAcknowledged ? (
            <>
              <CheckCircle2 size={18} />
              VERIFIED IN SHADE
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              {directive?.oneTapMessage}
            </>
          )}
        </button>

        {/* Hydration Log */}
        <button
          id="btn-worker-log-water"
          onClick={handleWaterClick}
          style={{
            width: '100%',
            background: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.35)',
            color: '#38bdf8',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Droplets size={16} />
          {justLoggedWater ? '✓ Hydration Intake Logged' : `Log Water Intake (${activeWorker?.waterGlasses || 0}/8 Glasses)`}
        </button>

        {/* SOS Alarm */}
        <button
          id="btn-worker-sos"
          onClick={() => onReportEmergency(activeWorker.id)}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <AlertTriangle size={14} />
          {activeWorker?.emergency ? 'EMERGENCY TRANSMITTED' : 'Signal Heat Cramps / Dizziness'}
        </button>
      </div>
    </div>
  );
}
