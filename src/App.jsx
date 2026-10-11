import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from './components/Navbar';
import MetricsRibbon from './components/MetricsRibbon';
import HourlyTimelineChart from './components/HourlyTimelineChart';
import InterventionCard from './components/InterventionCard';
import WorkforceGrid from './components/WorkforceGrid';
import AuditLogStream from './components/AuditLogStream';
import WorkerPWA from './components/WorkerPWA';
import JudgePlayground from './components/JudgePlayground';
import ModifyInterventionModal from './components/ModifyInterventionModal';
import RejectReasonModal from './components/RejectReasonModal';
import ComplianceReportModal from './components/ComplianceReportModal';

import { SITE_PRESETS, fetchLiveWeatherData, buildConditionsSnapshot } from './services/weatherService';
import { generateInterventionPackage } from './services/interventionEngine';
import { INITIAL_WORKERS, INITIAL_AUDIT_LOGS } from './services/eventStore';
import { cloudApi, setOffline } from './services/cloudApi';
import { useCloudBackend, useSiteSync, describeBackend, mergeAuditEntries } from './hooks/useCloudBackend';
import { useAiIntervention } from './hooks/useAiIntervention';

const newEventId = () =>
  `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

const localClockTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Cloud writes are best-effort: the local UI has already updated optimistically.
const persist = (promise) =>
  promise.catch((err) => console.warn('[HeatGuard] Cloud write failed, kept locally:', err.message));

export default function App() {
  // 1. Site & Core State
  const [activeSite, setActiveSite] = useState(SITE_PRESETS[0]);
  const [viewMode, setViewMode] = useState('supervisor'); // 'supervisor' | 'worker' | 'dual'
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // 2. Weather State & Live / Custom Overrides
  const [weatherData, setWeatherData] = useState(null);
  const [customParams, setCustomParams] = useState({
    temp: SITE_PRESETS[0].baseTemp,
    humidity: SITE_PRESETS[0].baseHumidity,
    solar: SITE_PRESETS[0].baseSolar,
    wind: SITE_PRESETS[0].baseWind,
  });
  const [isCustomMode, setIsCustomMode] = useState(false);

  // 3. Workforce & Audit Trail State
  const [workersBySite, setWorkersBySite] = useState(INITIAL_WORKERS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [activeWorkerId, setActiveWorkerId] = useState(INITIAL_WORKERS['chennai-metro'][0].id);

  // 4. Intervention & Decision State
  const [interventionStatus, setInterventionStatus] = useState('PENDING_APPROVAL');
  const [selectedOption, setSelectedOption] = useState('opt-a');
  const [supervisorNote, setSupervisorNote] = useState('');

  // 5. Modals State
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // 6. AWS backend (API Gateway + Lambda, or the same handlers served locally)
  const cloud = useCloudBackend();
  const backend = describeBackend(cloud);
  const cloudOnline = cloud.connected && !isOfflineMode;

  const handleServerRoster = useCallback((siteId, workers) => {
    setWorkersBySite((prev) => ({ ...prev, [siteId]: workers }));
  }, []);
  const handleServerAudit = useCallback((entries) => {
    setAuditLogs((prev) => mergeAuditEntries(prev, entries));
  }, []);
  const { ledger, verifyLedger, syncNow } = useSiteSync({
    connected: cloudOnline,
    siteId: activeSite.id,
    onRoster: handleServerRoster,
    onAudit: handleServerAudit,
  });

  // Load weather when site changes
  useEffect(() => {
    let isMounted = true;
    fetchLiveWeatherData(activeSite).then((data) => {
      if (isMounted) {
        setWeatherData(data);
        setCustomParams({
          temp: data.temp,
          humidity: data.humidity,
          solar: data.solarRadiation,
          wind: data.windSpeed,
        });
        setIsCustomMode(!data.isLive);
      }
    });
    return () => { isMounted = false; };
  }, [activeSite]);

  // Current workforce for active site
  const currentWorkers = useMemo(() => {
    return workersBySite[activeSite.id] || [];
  }, [workersBySite, activeSite.id]);

  const activeWorker = useMemo(() => {
    return currentWorkers.find((w) => w.id === activeWorkerId) || currentWorkers[0];
  }, [currentWorkers, activeWorkerId]);

  // Derived effective weather data (incorporating slider tweaks in real time)
  const effectiveWeather = useMemo(() => {
    if (!weatherData) return null;
    if (!isCustomMode) return weatherData;
    return buildConditionsSnapshot(activeSite, customParams, {
      isLive: false,
      lastUpdated: new Date().toLocaleTimeString() + ' (Judge Playground Mode)',
    });
  }, [weatherData, isCustomMode, customParams, activeSite]);

  // Calibrated local package: instant, always available, and the fallback for everything below.
  const localIntervention = useMemo(() => {
    if (!effectiveWeather) return null;
    return generateInterventionPackage(activeSite, effectiveWeather);
  }, [activeSite, effectiveWeather]);

  const planConditions = useMemo(
    () =>
      effectiveWeather && {
        temp: effectiveWeather.temp,
        humidity: effectiveWeather.humidity,
        solar: effectiveWeather.solarRadiation,
        wind: effectiveWeather.windSpeed,
      },
    [effectiveWeather]
  );

  // Amazon Bedrock plan for the same conditions (async; replaces the local package when ready).
  const ai = useAiIntervention({
    enabled: cloudOnline,
    siteId: activeSite.id,
    conditions: planConditions,
    localIntervention,
  });
  const intervention = ai.aiPackage || localIntervention;
  const planSource = intervention?.engine?.provider === 'amazon-bedrock' ? 'bedrock' : 'local';

  // Helper to add audit event (returns its ID, which doubles as the cloud idempotency key)
  const appendAuditLog = (type, actor, details, severity = 'info') => {
    const newEntry = {
      id: newEventId(),
      ts: new Date().toISOString(),
      time: new Date().toLocaleTimeString(),
      type,
      actor,
      details,
      severity,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
    return newEntry.id;
  };

  const persistDecision = (body) => {
    if (!cloud.connected) return;
    persist(
      ai.ensureInterventionId().then((interventionId) => {
        if (!interventionId) throw new Error('no server intervention to attach the decision to');
        return cloudApi.decide(activeSite.id, interventionId, { ...body, optionId: selectedOption, planSource });
      })
    );
  };

  // Actions
  const handleSiteSelect = (site) => {
    setActiveSite(site);
    setActiveWorkerId(workersBySite[site.id]?.[0]?.id || '');
    setInterventionStatus('PENDING_APPROVAL');
    appendAuditLog(
      'SITE_TRANSFER',
      site.supervisorName,
      `Switched command scope to ${site.name} (${site.workerCount} workers).`
    );
  };

  const handleApproveIntervention = () => {
    setInterventionStatus('APPROVED');
    const clientEventId = appendAuditLog(
      'SUPERVISOR_APPROVAL',
      activeSite.supervisorName,
      `Approved ${intervention?.primaryRecommendation?.title}. Multilingual instructions broadcasted to ${activeSite.workerCount} personnel.`,
      'success'
    );
    persistDecision({ decision: 'APPROVED', clientEventId });

    // Auto-stream worker responses over the next 6 seconds to demo real-time SSE/WebSockets to judges
    simulateProgressiveWorkerAcks();
  };

  const handleModifySave = (params) => {
    setInterventionStatus('MODIFIED');
    setSupervisorNote(params.supervisorNote);
    const clientEventId = appendAuditLog(
      'SUPERVISOR_CUSTOMIZATION',
      activeSite.supervisorName,
      `Adjusted schedule: ${params.shiftStart}–${params.shiftEnd}, ${params.restDurationMins}m rest/hr, ${params.waterPerWorkerLiters}L water quota. Note: "${params.supervisorNote}"`,
      'info'
    );
    persistDecision({ decision: 'MODIFIED', params, clientEventId });
    simulateProgressiveWorkerAcks();
  };

  const handleConfirmReject = (reason) => {
    setInterventionStatus('REJECTED');
    setSupervisorNote(`EXCEPTION: ${reason}`);
    const clientEventId = appendAuditLog(
      'SAFETY_EXCEPTION_LOGGED',
      activeSite.supervisorName,
      `Intervention REJECTED with operational justification: "${reason}". Compliance exception filed.`,
      'danger'
    );
    persistDecision({ decision: 'REJECTED', reason, clientEventId });
  };

  const handleWorkerAcknowledge = (workerId) => {
    const localTime = localClockTime();
    setWorkersBySite((prev) => {
      const siteWorkers = prev[activeSite.id].map((w) => {
        if (w.id === workerId) {
          return {
            ...w,
            status: 'RESTING_SHADE',
            ackTime: localTime,
          };
        }
        return w;
      });
      return { ...prev, [activeSite.id]: siteWorkers };
    });

    const target = currentWorkers.find((w) => w.id === workerId);
    const clientEventId = appendAuditLog(
      'WORKER_1TAP_ACK',
      target?.name || `Worker #${workerId}`,
      `Acknowledged rest directive via PWA. Checked into ${target?.hub || 'Shade Canopy'}.`,
      'success'
    );
    if (cloud.connected) {
      persist(cloudApi.workerEvent(activeSite.id, workerId, { type: 'ACK', status: 'RESTING_SHADE', channel: 'pwa', localTime, clientEventId }));
    }
  };

  const handleLogWater = (workerId) => {
    setWorkersBySite((prev) => {
      const siteWorkers = prev[activeSite.id].map((w) => {
        if (w.id === workerId) {
          return {
            ...w,
            waterGlasses: (w.waterGlasses || 0) + 1,
          };
        }
        return w;
      });
      return { ...prev, [activeSite.id]: siteWorkers };
    });

    const target = currentWorkers.find((w) => w.id === workerId);
    const clientEventId = appendAuditLog(
      'HYDRATION_LOG',
      target?.name || `Worker #${workerId}`,
      `Logged +250 mL hydration intake (Total: ${(target?.waterGlasses || 0) + 1} glasses today).`,
      'info'
    );
    if (cloud.connected) {
      persist(cloudApi.workerEvent(activeSite.id, workerId, { type: 'WATER', clientEventId }));
    }
  };

  const handleReportEmergency = (workerId) => {
    setWorkersBySite((prev) => {
      const siteWorkers = prev[activeSite.id].map((w) => {
        if (w.id === workerId) {
          return { ...w, emergency: true };
        }
        return w;
      });
      return { ...prev, [activeSite.id]: siteWorkers };
    });

    const target = currentWorkers.find((w) => w.id === workerId);
    const clientEventId = appendAuditLog(
      'EMERGENCY_HEAT_SOS',
      target?.name || `Worker #${workerId}`,
      `CRITICAL ALARM: Worker reported dizziness/heat illness at ${target?.hub}! First-aid team alerted.`,
      'danger'
    );
    if (cloud.connected) {
      persist(cloudApi.workerEvent(activeSite.id, workerId, { type: 'SOS', clientEventId }));
    }
  };

  const handlePingUnacknowledged = () => {
    const unacked = currentWorkers.filter((w) => w.status === 'NOTIFIED');
    const clientEventId = appendAuditLog(
      'SMS_NUDGE_BROADCAST',
      cloud.connected ? 'AWS SNS Dispatcher' : 'Local Simulation (SNS offline)',
      `Sent urgent SMS push reminder in Tamil/Hindi to ${unacked.length} unacknowledged workers.`,
      'info'
    );
    if (cloud.connected) {
      persist(cloudApi.nudge(activeSite.id, { clientEventId }));
    }
  };

  // Progressive simulated responses
  const simulateProgressiveWorkerAcks = () => {
    const unackedWorkers = currentWorkers.filter((w) => w.status === 'NOTIFIED');
    if (unackedWorkers.length === 0) return;

    unackedWorkers.slice(0, 4).forEach((worker, index) => {
      setTimeout(() => {
        const localTime = localClockTime();
        setWorkersBySite((prev) => {
          const updated = prev[activeSite.id].map((w) => {
            if (w.id === worker.id) {
              return {
                ...w,
                status: 'ACKNOWLEDGED',
                ackTime: localTime,
              };
            }
            return w;
          });
          return { ...prev, [activeSite.id]: updated };
        });

        const clientEventId = appendAuditLog(
          'WORKER_1TAP_ACK',
          worker.name,
          `Verified directive via mobile short link (Hydrated & in shade).`,
          'success'
        );
        if (cloud.connected) {
          persist(
            cloudApi.workerEvent(activeSite.id, worker.id, { type: 'ACK', status: 'ACKNOWLEDGED', channel: 'sms-link', localTime, clientEventId })
          );
        }
      }, (index + 1) * 1200);
    });
  };

  // Judge Playground Controls
  const handleParamChange = (field, value) => {
    setIsCustomMode(true);
    setCustomParams((prev) => ({ ...prev, [field]: value }));
  };

  const handleTriggerHeatSpike = () => {
    setIsCustomMode(true);
    setCustomParams({
      temp: 42.5,
      humidity: 70,
      solar: 1020,
      wind: 1.2,
    });
    setInterventionStatus('PENDING_APPROVAL');
    const spike = buildConditionsSnapshot(activeSite, { temp: 42.5, humidity: 70, solar: 1020, wind: 1.2 });
    appendAuditLog(
      'PHYSICS_SPIKE_INJECTED',
      'Judge Playground Testbed',
      `Injected extreme heat wave parameters (Temp: 42.5°C, Solar: 1020 W/m²). WBGT spiked to ${spike.wbgt}°C (${spike.risk.badgeText}).`,
      'danger'
    );
  };

  const handleCoolDown = () => {
    setIsCustomMode(true);
    setCustomParams({
      temp: 28,
      humidity: 45,
      solar: 350,
      wind: 3.5,
    });
    setInterventionStatus('APPROVED');
    appendAuditLog(
      'PHYSICS_NORMALIZED',
      'Judge Playground Testbed',
      'Set safe environmental conditions (WBGT < 25.0°C). Normal continuous work restored.',
      'success'
    );
  };

  const handleResetLive = () => {
    setIsCustomMode(false);
    fetchLiveWeatherData(activeSite).then((data) => {
      setWeatherData(data);
      appendAuditLog(
        'LIVE_API_SYNC',
        'Open-Meteo Gateway',
        `Re-synced with live meteorological stream for ${activeSite.city}.`,
        'info'
      );
    });
  };

  // Offline simulation pauses cloud calls; reconnecting replays the queued writes.
  const handleToggleOffline = () => {
    const next = !isOfflineMode;
    setIsOfflineMode(next);
    setOffline(next).then(({ delivered }) => {
      if (!next && delivered > 0) {
        appendAuditLog('OFFLINE_QUEUE_SYNCED', 'Field Terminal Outbox', `Replayed ${delivered} queued action(s) to the cloud ledger.`, 'success');
        syncNow();
      }
    });
  };

  if (!effectiveWeather || !intervention) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#f97316' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>Loading HeatGuard Physical Engine...</div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 8 }}>Ingesting meteorological data & calculating Liljegren WBGT...</div>
        </div>
      </div>
    );
  }

  const interventionCard = (
    <InterventionCard
      intervention={intervention}
      status={interventionStatus}
      selectedOption={selectedOption}
      onSelectOption={setSelectedOption}
      onApprove={handleApproveIntervention}
      onOpenModifyModal={() => setIsModifyModalOpen(true)}
      onOpenRejectModal={() => setIsRejectModalOpen(true)}
      supervisorNote={supervisorNote}
      aiStatus={ai.status}
      aiError={ai.error}
      cloudConnected={cloudOnline}
      onRegenerate={ai.regenerate}
    />
  );

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '48px' }}>
      {/* 1. Global Navigation */}
      <Navbar
        activeSite={activeSite}
        onSelectSite={handleSiteSelect}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        isPlaygroundOpen={isPlaygroundOpen}
        onTogglePlayground={() => setIsPlaygroundOpen(!isPlaygroundOpen)}
        onOpenReportModal={() => {
          setIsReportModalOpen(true);
          if (cloudOnline) verifyLedger();
        }}
        liveWeatherStatus={{ isLive: !isCustomMode }}
        backend={backend}
      />

      <main className="console-viewport">
        {/* 2. Judge Simulation & Diagnostics Drawer */}
        {isPlaygroundOpen && (
          <JudgePlayground
            customParams={customParams}
            onChangeParam={handleParamChange}
            onTriggerHeatSpike={handleTriggerHeatSpike}
            onCoolDown={handleCoolDown}
            onSimulateWorkerResponses={simulateProgressiveWorkerAcks}
            onResetLive={handleResetLive}
            isOfflineMode={isOfflineMode}
            onToggleOffline={handleToggleOffline}
            cloudHealth={cloud.health}
            onRecheckCloud={cloud.refresh}
          />
        )}

        {/* 3. Top Telemetry Strip */}
        <MetricsRibbon
          weatherData={effectiveWeather}
          activeSite={activeSite}
          workers={currentWorkers}
          avertedHours={intervention.personHoursAverted}
        />

        {/* 4. Main Body: Switch based on ViewMode */}
        {viewMode === 'supervisor' && (
          <div className="operations-grid">
            <div>
              <HourlyTimelineChart
                timeline={effectiveWeather.timeline}
                nioshThresholds={effectiveWeather.risk.thresholds}
                activeSite={activeSite}
              />
              {interventionCard}
            </div>
            <div>
              <WorkforceGrid
                workers={currentWorkers}
                onPingUnacknowledged={handlePingUnacknowledged}
                onSelectWorkerForPreview={(w) => {
                  setActiveWorkerId(w.id);
                  setViewMode('worker');
                }}
              />
              <AuditLogStream auditLogs={auditLogs} ledger={ledger} onVerifyLedger={verifyLedger} />
            </div>
          </div>
        )}

        {viewMode === 'worker' && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
            <WorkerPWA
              activeWorker={activeWorker}
              workers={currentWorkers}
              onSelectWorker={(w) => setActiveWorkerId(w.id)}
              intervention={intervention}
              onAcknowledge={handleWorkerAcknowledge}
              onLogWater={handleLogWater}
              onReportEmergency={handleReportEmergency}
              weatherData={effectiveWeather}
              isOfflineMode={isOfflineMode}
            />
          </div>
        )}

        {viewMode === 'dual' && (
          <div className="dual-split-viewport">
            <div>
              <HourlyTimelineChart
                timeline={effectiveWeather.timeline}
                nioshThresholds={effectiveWeather.risk.thresholds}
                activeSite={activeSite}
              />
              {interventionCard}
              <WorkforceGrid
                workers={currentWorkers}
                onPingUnacknowledged={handlePingUnacknowledged}
                onSelectWorkerForPreview={(w) => setActiveWorkerId(w.id)}
              />
              <AuditLogStream auditLogs={auditLogs} ledger={ledger} onVerifyLedger={verifyLedger} />
            </div>

            <div>
              <div style={{ position: 'sticky', top: '76px' }}>
                <WorkerPWA
                  activeWorker={activeWorker}
                  workers={currentWorkers}
                  onSelectWorker={(w) => setActiveWorkerId(w.id)}
                  intervention={intervention}
                  onAcknowledge={handleWorkerAcknowledge}
                  onLogWater={handleLogWater}
                  onReportEmergency={handleReportEmergency}
                  weatherData={effectiveWeather}
                  isOfflineMode={isOfflineMode}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 5. Modals */}
      <ModifyInterventionModal
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        onSave={handleModifySave}
        intervention={intervention}
        activeSite={activeSite}
      />

      <RejectReasonModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirmReject={handleConfirmReject}
        activeSite={activeSite}
      />

      <ComplianceReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        site={activeSite}
        weatherData={effectiveWeather}
        intervention={intervention}
        workers={currentWorkers}
        auditLogs={auditLogs}
        ledger={ledger}
      />
    </div>
  );
}
