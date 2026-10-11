import React from 'react';
import { Activity, ShieldAlert } from 'lucide-react';

export default function HourlyTimelineChart({ timeline, nioshThresholds, activeSite }) {
  // SVG dimensions for Meteogram
  const svgWidth = 800;
  const svgHeight = 120;
  const paddingX = 40;
  const paddingY = 20;

  // Min and max for chart scale
  const minWbgt = 22;
  const maxWbgt = 36;
  const range = maxWbgt - minWbgt;

  // Calculate points for the SVG curve
  const points = timeline.map((slot, index) => {
    const x = paddingX + (index / (timeline.length - 1)) * (svgWidth - 2 * paddingX);
    const clampedWbgt = Math.min(maxWbgt, Math.max(minWbgt, slot.wbgt));
    const y = svgHeight - paddingY - ((clampedWbgt - minWbgt) / range) * (svgHeight - 2 * paddingY);
    return { x, y, slot };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPathStr = `M ${points[0].x},${svgHeight - paddingY} L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L ${points[points.length - 1].x},${svgHeight - paddingY} Z`;

  // NIOSH threshold Y coordinate
  const thresholdY = svgHeight - paddingY - ((nioshThresholds.high - minWbgt) / range) * (svgHeight - 2 * paddingY);

  return (
    <div className="panel-frame" id="meteogram-exposure-panel">
      <div className="panel-header-bar">
        <div className="panel-title-group">
          <Activity size={15} color="#38bdf8" />
          <span className="panel-heading-text">Meteogram — Shift Thermal Radiation Curve</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="panel-meta-tag" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }}>
            NIOSH Threshold: {nioshThresholds.high}°C WBGT
          </span>
          <span className="panel-meta-tag">
            Intensity: {activeSite.workIntensity}
          </span>
        </div>
      </div>

      <div className="meteogram-box">
        {/* SVG Continuous Thermal Curve */}
        <div className="meteogram-svg-container">
          <svg 
            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="wbgtCurveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ea580c" stopOpacity="0.35" />
                <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid line at threshold */}
            <line
              x1={paddingX}
              y1={thresholdY}
              x2={svgWidth - paddingX}
              y2={thresholdY}
              stroke="var(--color-danger)"
              strokeDasharray="4 4"
              strokeWidth="1.2"
              opacity="0.8"
            />
            <text
              x={svgWidth - paddingX + 6}
              y={thresholdY + 3}
              fill="var(--color-danger)"
              fontSize="9"
              fontFamily="var(--font-mono)"
              fontWeight="700"
            >
              RAL {nioshThresholds.high}°C
            </text>

            {/* Area fill under curve */}
            <path d={areaPathStr} fill="url(#wbgtCurveGradient)" />

            {/* Main curve line */}
            <polyline
              points={polylineStr}
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {points.map((p, idx) => {
              const isOver = p.slot.wbgt >= nioshThresholds.high;
              return (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={isOver ? 4 : 3}
                  fill={isOver ? 'var(--color-danger)' : p.slot.color}
                  stroke="#08090d"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        </div>

        {/* Tabular Meteogram Columns */}
        <div className="meteogram-table-strip" id="meteogram-hourly-strip">
          {timeline.map((slot) => {
            const isHazard = slot.wbgt >= nioshThresholds.high;
            return (
              <div
                key={slot.time}
                className={`meteogram-col ${isHazard ? 'hazard-col' : ''}`}
                title={`Air: ${slot.temp}°C | RH: ${slot.rh}% | Solar: ${slot.solar} W/m²`}
              >
                <div className="meteogram-hour">{slot.time}</div>
                <div 
                  className="meteogram-val" 
                  style={{ color: isHazard ? 'var(--color-danger)' : slot.color }}
                >
                  {slot.wbgt}°
                </div>
                <div 
                  className="meteogram-status-tag"
                  style={{ color: isHazard ? 'var(--color-danger)' : slot.wbgt >= nioshThresholds.caution ? 'var(--color-caution)' : 'var(--color-safe)' }}
                >
                  {isHazard ? 'Rest' : slot.wbgt >= nioshThresholds.caution ? '30m' : '100%'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
