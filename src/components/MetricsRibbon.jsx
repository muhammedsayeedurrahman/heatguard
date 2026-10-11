import React from 'react';
import { 
  Flame, 
  Droplets, 
  Sun, 
  ShieldCheck, 
  Clock, 
  Wind,
  TrendingDown,
  Activity
} from 'lucide-react';

export default function MetricsRibbon({ weatherData, activeSite, workers, avertedHours }) {
  const { wbgt, temp, humidity, windSpeed, solarRadiation, risk } = weatherData;

  const totalWorkers = workers.length;
  const acknowledgedCount = workers.filter(
    (w) => w.status === 'ACKNOWLEDGED' || w.status === 'RESTING_SHADE'
  ).length;
  const ackPercentage = totalWorkers > 0 ? Math.round((acknowledgedCount / totalWorkers) * 100) : 0;

  // Percentage on WBGT scale from 20°C to 38°C
  const wbgtGaugePercent = Math.min(100, Math.max(0, ((wbgt - 20) / 18) * 100));

  return (
    <section className="telemetry-strip" id="telemetry-status-strip">
      {/* 1. Scientific WBGT Cell */}
      <div className="telemetry-cell" id="cell-wbgt-telemetry">
        <div>
          <div className="cell-eyebrow">
            <span className="cell-label">Wet-Bulb Globe Temp</span>
            <Activity size={14} color={risk.color} />
          </div>
          <div className="cell-data-row">
            <span className="cell-metric-large" style={{ color: risk.color }}>
              {wbgt}
            </span>
            <span className="cell-metric-unit">°C WBGT</span>
          </div>
        </div>
        <div>
          <div className="micro-meter-track">
            <div 
              className="micro-meter-fill" 
              style={{ width: `${wbgtGaugePercent}%`, backgroundColor: risk.color }} 
            />
          </div>
          <div className="cell-subtext" style={{ color: risk.color, fontWeight: 700 }}>
            {risk.badgeText} ({activeSite.workIntensity} Work)
          </div>
        </div>
      </div>

      {/* 2. Dry-Bulb Air Temp & Humidity */}
      <div className="telemetry-cell" id="cell-air-temp">
        <div>
          <div className="cell-eyebrow">
            <span className="cell-label">Dry Bulb / Humidity</span>
            <Droplets size={14} color="#0284c7" />
          </div>
          <div className="cell-data-row">
            <span className="cell-metric-large" style={{ color: '#f8fafc' }}>
              {temp}°
            </span>
            <span className="cell-metric-unit">/ {humidity}% RH</span>
          </div>
        </div>
        <div className="cell-subtext">
          <span>Heat Index: <strong>{weatherData.heatIndex}°C</strong></span>
          <span style={{ color: 'var(--text-tertiary)' }}>•</span>
          <span style={{ color: 'var(--text-tertiary)' }}>Dew: {weatherData.wetBulb}°C</span>
        </div>
      </div>

      {/* 3. Solar Radiation & Wind Vector */}
      <div className="telemetry-cell" id="cell-solar-wind">
        <div>
          <div className="cell-eyebrow">
            <span className="cell-label">Solar Radiative Flux</span>
            <Sun size={14} color="#eab308" />
          </div>
          <div className="cell-data-row">
            <span className="cell-metric-large" style={{ color: '#f8fafc' }}>
              {solarRadiation}
            </span>
            <span className="cell-metric-unit">W/m²</span>
          </div>
        </div>
        <div className="cell-subtext">
          <Wind size={13} color="var(--text-tertiary)" />
          <span>Surface Wind: <strong>{windSpeed} m/s</strong></span>
        </div>
      </div>

      {/* 4. Verification Rate */}
      <div className="telemetry-cell" id="cell-verification-rate">
        <div>
          <div className="cell-eyebrow">
            <span className="cell-label">Field Verification</span>
            <ShieldCheck size={14} color={ackPercentage >= 80 ? 'var(--color-safe)' : 'var(--color-caution)'} />
          </div>
          <div className="cell-data-row">
            <span 
              className="cell-metric-large" 
              style={{ color: ackPercentage >= 80 ? 'var(--color-safe)' : 'var(--color-caution)' }}
            >
              {ackPercentage}%
            </span>
            <span className="cell-metric-unit">({acknowledgedCount}/{totalWorkers})</span>
          </div>
        </div>
        <div>
          <div className="micro-meter-track">
            <div 
              className="micro-meter-fill" 
              style={{ 
                width: `${ackPercentage}%`, 
                backgroundColor: ackPercentage >= 80 ? 'var(--color-safe)' : 'var(--color-caution)' 
              }} 
            />
          </div>
          <div className="cell-subtext">
            <span>Personnel In Shaded Rest</span>
          </div>
        </div>
      </div>

      {/* 5. Averted Heat Burden */}
      <div className="telemetry-cell" id="cell-exposure-averted">
        <div>
          <div className="cell-eyebrow">
            <span className="cell-label">Averted Heat Exposure</span>
            <TrendingDown size={14} color="var(--color-brand)" />
          </div>
          <div className="cell-data-row">
            <span className="cell-metric-large" style={{ color: 'var(--color-brand)' }}>
              {avertedHours}
            </span>
            <span className="cell-metric-unit">person-hrs</span>
          </div>
        </div>
        <div className="cell-subtext">
          <span>Hazard Window Mitigated</span>
        </div>
      </div>
    </section>
  );
}
