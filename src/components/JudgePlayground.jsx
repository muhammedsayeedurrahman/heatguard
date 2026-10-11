import React from 'react';
import { 
  Flame, 
  CloudSun, 
  RefreshCw, 
  Play, 
  WifiOff, 
  SlidersHorizontal,
  Server,
} from 'lucide-react';

const SERVICE_LABELS = [
  ['bedrock', 'Bedrock'],
  ['dynamodb', 'DynamoDB'],
  ['eventbridge', 'EventBridge'],
  ['sns', 'SNS'],
];

function CloudServicesRow({ health, onRecheck }) {
  return (
    <div className="service-chip-row" id="cloud-services-row" style={{ width: '100%' }}>
      <Server size={12} color="var(--text-tertiary)" />
      <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
        AWS Services:
      </span>
      {health ? (
        SERVICE_LABELS.map(([key, label]) => {
          const service = health.services[key];
          const live = service.mode === 'live';
          return (
            <span key={key} className={`service-chip ${live ? 'live' : ''}`} title={JSON.stringify(service)}>
              ● {label}: {live ? (key === 'bedrock' ? service.modelName : 'live') : service.mode}
            </span>
          );
        })
      ) : (
        <span className="service-chip">API unreachable · browser-only Calibrated Local Engine</span>
      )}
      {health?.services.bedrock.lastCall && (
        <span className="service-chip" title={health.services.bedrock.lastCall.error || ''}>
          last Bedrock call: {health.services.bedrock.lastCall.ok ? `ok (${(health.services.bedrock.lastCall.latencyMs / 1000).toFixed(1)}s)` : 'failed'}
        </span>
      )}
      <button
        id="btn-recheck-cloud"
        className="btn-outline-neutral"
        style={{ padding: '2px 8px', fontSize: '0.66rem' }}
        onClick={onRecheck}
      >
        <RefreshCw size={10} />
        Recheck
      </button>
    </div>
  );
}

export default function JudgePlayground({
  customParams,
  onChangeParam,
  onTriggerHeatSpike,
  onCoolDown,
  onSimulateWorkerResponses,
  onResetLive,
  isOfflineMode,
  onToggleOffline,
  cloudHealth,
  onRecheckCloud,
}) {
  return (
    <div className="simulation-drawer" id="judge-simulation-drawer">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <SlidersHorizontal size={16} color="#38bdf8" />
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            Diagnostics & Simulation Testbed
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
            Physical parameter injection & real-time closed loop evaluation
          </div>
        </div>
      </div>

      <div className="slider-group">
        {/* Temp Slider */}
        <div className="slider-unit">
          <div className="slider-label">
            Dry Bulb: <span style={{ color: '#fff' }}>{customParams.temp}°C</span>
          </div>
          <input
            id="slider-temp"
            type="range"
            min="25"
            max="48"
            step="0.5"
            className="range-input-tactical"
            value={customParams.temp}
            onChange={(e) => onChangeParam('temp', parseFloat(e.target.value))}
          />
        </div>

        {/* Humidity Slider */}
        <div className="slider-unit">
          <div className="slider-label">
            Humidity: <span style={{ color: '#fff' }}>{customParams.humidity}%</span>
          </div>
          <input
            id="slider-humidity"
            type="range"
            min="15"
            max="95"
            step="1"
            className="range-input-tactical"
            value={customParams.humidity}
            onChange={(e) => onChangeParam('humidity', parseInt(e.target.value, 10))}
          />
        </div>

        {/* Solar Radiation Slider */}
        <div className="slider-unit">
          <div className="slider-label">
            Solar Flux: <span style={{ color: '#fff' }}>{customParams.solar} W/m²</span>
          </div>
          <input
            id="slider-solar"
            type="range"
            min="200"
            max="1100"
            step="25"
            className="range-input-tactical"
            value={customParams.solar}
            onChange={(e) => onChangeParam('solar', parseInt(e.target.value, 10))}
          />
        </div>

        {/* Wind Speed Slider */}
        <div className="slider-unit">
          <div className="slider-label">
            Wind: <span style={{ color: '#fff' }}>{customParams.wind} m/s</span>
          </div>
          <input
            id="slider-wind"
            type="range"
            min="0.5"
            max="6.0"
            step="0.1"
            className="range-input-tactical"
            value={customParams.wind}
            onChange={(e) => onChangeParam('wind', parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* Action Simulation Triggers */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          id="btn-trigger-heat-spike"
          className="btn-outline-danger"
          style={{ padding: '5px 10px', fontSize: '0.72rem' }}
          onClick={onTriggerHeatSpike}
          title="Inject severe 42.5°C heat spike with 1020 W/m² solar flux"
        >
          <Flame size={12} />
          Inject Heat Spike
        </button>

        <button
          id="btn-cool-down"
          className="btn-outline-neutral"
          style={{ padding: '5px 10px', fontSize: '0.72rem' }}
          onClick={onCoolDown}
        >
          <CloudSun size={12} />
          Normal Baseline
        </button>

        <button
          id="btn-simulate-worker-acks"
          className="btn-outline-neutral"
          style={{ padding: '5px 10px', fontSize: '0.72rem', borderColor: 'var(--color-safe-border)', color: 'var(--color-safe)' }}
          onClick={onSimulateWorkerResponses}
        >
          <Play size={11} />
          Stream Acks
        </button>

        <button
          id="btn-toggle-offline-mode"
          className="btn-outline-neutral"
          style={{
            padding: '5px 10px',
            fontSize: '0.72rem',
            borderColor: isOfflineMode ? 'var(--color-caution)' : undefined,
            color: isOfflineMode ? 'var(--color-caution)' : undefined,
          }}
          onClick={onToggleOffline}
        >
          <WifiOff size={11} />
          {isOfflineMode ? 'Online Mode' : 'Simulate Offline'}
        </button>

        <button
          id="btn-reset-live-weather"
          className="btn-outline-neutral"
          style={{ padding: '5px 10px', fontSize: '0.72rem' }}
          onClick={onResetLive}
        >
          <RefreshCw size={11} />
          Live Weather Sync
        </button>
      </div>

      <CloudServicesRow health={cloudHealth} onRecheck={onRecheckCloud} />
    </div>
  );
}
