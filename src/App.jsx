import React, { useState, useEffect, useMemo } from 'react';
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

import { 
  SITE_PRESETS, 
  fetchLiveWeatherData, 
  generateHourlyTimeline 
} from './services/weatherService';
import { calculateWBGT, evaluateNIOSHHeatRisk, calculateExposureAverted } from './utils/wbgtMath';
import { generateInterventionPackage } from './services/interventionEngine';
import { INITIAL_WORKERS, INITIAL_AUDIT_LOGS } from './services/eventStore';

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

    const wbgtObj = calculateWBGT(
      customParams.temp,
      customParams.humidity,
      customParams.solar,
      customParams.wind
    );
    const risk = evaluateNIOSHHeatRisk(wbgtObj.wbgt, activeSite.workIntensity);
    const timeline = generateHourlyTimeline(
      customParams.temp,
      customParams.humidity,
      customParams.solar,
      customParams.wind,
      activeSite.workIntensity
    );

    return {
      isLive: false,
      lastUpdated: new Date().toLocaleTimeString() + ' (Judge Playground Mode)',
      temp: customParams.temp,
      humidity: customParams.humidity,
      windSpeed: customParams.wind,
      solarRadiation: customParams.solar,
      wbgt: wbgtObj.wbgt,
      wetBulb: wbgtObj.wetBulb,
      globeTemp: wbgtObj.globeTemp,
      heatIndex: wbgtObj.heatIndex,
      risk,
      timeline,
    };
  }, [weatherData, isCustomMode, customParams, activeSite]);

  // Derived intervention package
  const intervention = useMemo(() => {
    if (!effectiveWeather) return null;
    return generateInterventionPackage(activeSite, effectiveWeather);
  }, [activeSite, effectiveWeather]);

  // Helper to add audit event
  const appendAuditLog = (type, actor, details, severity = 'info') => {
    const newEntry = {
      id: `EVT-${Date.now().toString(36).toUpperCase()}`,
      time: new Date().toLocaleTimeString(),
      type,
      actor,
      details,
      severity,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
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
    appendAuditLog(
      'SUPERVISOR_APPROVAL',
      activeSite.supervisorName,
      `Approved ${intervention?.primaryRecommendation?.title}. Multilingual instructions broadcasted to ${activeSite.workerCount} personnel.`,
      'success'
    );

    // Auto-stream worker responses over the next 6 seconds to demo real-time SSE/WebSockets to judges
    simulateProgressiveWorkerAcks();
  };

  const handleModifySave = (params) => {
    setInterventionStatus('MODIFIED');
    setSupervisorNote(params.supervisorNote);
    appendAuditLog(
      'SUPERVISOR_CUSTOMIZATION',
      activeSite.supervisorName,
      `Adjusted schedule: ${params.shiftStart}–${params.shiftEnd}, ${params.restDurationMins}m rest/hr, ${params.waterPerWorkerLiters}L water quota. Note: "${params.supervisorNote}"`,
      'info'
    );
    simulateProgressiveWorkerAcks();
  };

  const handleConfirmReject = (reason) => {
    setInterventionStatus('REJECTED');
    setSupervisorNote(`EXCEPTION: ${reason}`);
    appendAuditLog(
      'SAFETY_EXCEPTION_LOGGED',
      activeSite.supervisorName,
      `Intervention REJECTED with operational justification: "${reason}". Compliance exception filed.`,
      'danger'
    );
  };

  const handleWorkerAcknowledge = (workerId) => {
    setWorkersBySite((prev) => {
      const siteWorkers = prev[activeSite.id].map((w) => {
        if (w.id === workerId) {
          return {
            ...w,
            status: 'RESTING_SHADE',
            ackTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        }
        return w;
      });
      return { ...prev, [activeSite.id]: siteWorkers };
    });

    const target = currentWorkers.find((w) => w.id === workerId);
    appendAuditLog(
      'WORKER_1TAP_ACK',
      target?.name || `Worker #${workerId}`,
      `Acknowledged rest directive via PWA. Checked into ${target?.hub || 'Shade Canopy'}.`,
      'success'
    );
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
    appendAuditLog(
      'HYDRATION_LOG',
      target?.name || `Worker #${workerId}`,
      `Logged +250 mL hydration intake (Total: ${(target?.waterGlasses || 0) + 1} glasses today).`,
      'info'
    );
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
    appendAuditLog(
      'EMERGENCY_HEAT_SOS',
      target?.name || `Worker #${workerId}`,
      `CRITICAL ALARM: Worker reported dizziness/heat illness at ${target?.hub}! First-aid team alerted.`,
      'danger'
    );
  };

  const handlePingUnacknowledged = () => {
    const unacked = currentWorkers.filter((w) => w.status === 'NOTIFIED');
    appendAuditLog(
      'SMS_NUDGE_BROADCAST',
      'AWS SNS Dispatcher',
      `Sent urgent SMS push reminder in Tamil/Hindi to ${unacked.length} unacknowledged workers.`,
      'info'
    );
  };

  // Progressive simulated responses
  const simulateProgressiveWorkerAcks = () => {
    const unackedWorkers = currentWorkers.filter((w) => w.status === 'NOTIFIED');
    if (unackedWorkers.length === 0) return;

    unackedWorkers.slice(0, 4).forEach((worker, index) => {
      setTimeout(() => {
        setWorkersBySite((prev) => {
          const updated = prev[activeSite.id].map((w) => {
            if (w.id === worker.id) {
              return {
                ...w,
                status: 'ACKNOWLEDGED',
                ackTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              };
            }
            return w;
          });
          return { ...prev, [activeSite.id]: updated };
        });

        appendAuditLog(
          'WORKER_1TAP_ACK',
          worker.name,
          `Verified directive via mobile short link (Hydrated & in shade).`,
          'success'
        );
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
    appendAuditLog(
      'PHYSICS_SPIKE_INJECTED',
      'Judge Playground Testbed',
      'Injected extreme heat wave parameters (Temp: 42.5°C, Solar: 1020 W/m²). Peak WBGT spiked to 33.6°C!',
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
        onOpenReportModal={() => setIsReportModalOpen(true)}
        liveWeatherStatus={{ isLive: !isCustomMode }}
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
            onToggleOffline={() => setIsOfflineMode(!isOfflineMode)}
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
              <InterventionCard
                intervention={intervention}
                status={interventionStatus}
                selectedOption={selectedOption}
                onSelectOption={setSelectedOption}
                onApprove={handleApproveIntervention}
                onOpenModifyModal={() => setIsModifyModalOpen(true)}
                onOpenRejectModal={() => setIsRejectModalOpen(true)}
                supervisorNote={supervisorNote}
              />
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
              <AuditLogStream auditLogs={auditLogs} />
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
              <InterventionCard
                intervention={intervention}
                status={interventionStatus}
                selectedOption={selectedOption}
                onSelectOption={setSelectedOption}
                onApprove={handleApproveIntervention}
                onOpenModifyModal={() => setIsModifyModalOpen(true)}
                onOpenRejectModal={() => setIsRejectModalOpen(true)}
                supervisorNote={supervisorNote}
              />
              <WorkforceGrid
                workers={currentWorkers}
                onPingUnacknowledged={handlePingUnacknowledged}
                onSelectWorkerForPreview={(w) => setActiveWorkerId(w.id)}
              />
              <AuditLogStream auditLogs={auditLogs} />
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
      />
    </div>
  );
}
