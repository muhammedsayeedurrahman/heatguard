import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudApi } from '../services/cloudApi';

const DEBOUNCE_MS = 1200;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 150000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Plans are reused while the site, NIOSH risk level and WBGT (to 0.5°C) are unchanged. */
export function planSignature(siteId, intervention) {
  if (!intervention) return null;
  return `${siteId}|${intervention.riskLevel}|${(Math.round(intervention.wbgtTrigger * 2) / 2).toFixed(1)}`;
}

function fromRecord(record) {
  return {
    status: record.status === 'READY' ? 'ready' : 'synthesizing',
    interventionId: record.interventionId,
    package: record.package,
    engine: record.engine,
    cached: Boolean(record.cached),
    error: null,
  };
}

/**
 * Requests an Amazon Bedrock plan for the current conditions (debounced, so slider drags do not
 * trigger model calls), then polls until the Synthesis Lambda has stored it. The local package
 * stays on screen until then, and remains if Bedrock is unavailable.
 */
export function useAiIntervention({ enabled, siteId, conditions, localIntervention }) {
  const [plans, setPlans] = useState({});
  const requests = useRef(new Map());
  const latestId = useRef(new Map()); // signature -> intervention ID a poller may still write
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((signature, patch) => {
    if (!mounted.current) return;
    setPlans((prev) => ({ ...prev, [signature]: { ...prev[signature], ...patch } }));
  }, []);

  const pollUntilReady = useCallback(
    async (signature, planSiteId, interventionId) => {
      const started = Date.now();
      while (mounted.current && Date.now() - started < POLL_TIMEOUT_MS) {
        await sleep(POLL_INTERVAL_MS);
        if (latestId.current.get(signature) !== interventionId) return; // superseded by a re-synthesis
        try {
          const record = await cloudApi.getIntervention(planSiteId, interventionId);
          update(signature, fromRecord(record));
          if (record.status === 'READY') return;
        } catch (err) {
          if (err.status && err.status !== 0) {
            update(signature, { status: 'error', error: err.message });
            return;
          }
        }
      }
      update(signature, { status: 'error', error: 'Bedrock synthesis did not finish in time' });
    },
    [update]
  );

  /** Starts (or reuses) the request for a signature; resolves with the first server record. */
  const startSynthesis = useCallback(
    (signature, planSiteId, planConditions, { forceRefresh = false } = {}) => {
      const existing = requests.current.get(signature);
      if (existing && !forceRefresh) return existing;

      update(signature, { status: 'synthesizing', error: null });
      const promise = cloudApi.requestIntervention(planSiteId, planConditions, { forceRefresh }).then((record) => {
        latestId.current.set(signature, record.interventionId);
        update(signature, fromRecord(record));
        if (record.status !== 'READY') pollUntilReady(signature, planSiteId, record.interventionId);
        return record;
      });
      promise.catch((err) => {
        requests.current.delete(signature);
        update(signature, { status: 'error', error: err.message });
      });
      requests.current.set(signature, promise);
      return promise;
    },
    [update, pollUntilReady]
  );

  const signature = planSignature(siteId, localIntervention);

  useEffect(() => {
    if (!enabled || !signature || requests.current.has(signature)) return undefined;
    const timer = setTimeout(() => startSynthesis(signature, siteId, conditions).catch(() => {}), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, signature, siteId, conditions, startSynthesis]);

  const current = signature ? plans[signature] : null;

  // A plan fetched earlier stays usable offline (cached per signature).
  return {
    status: current?.status === 'ready' ? 'ready' : !enabled ? 'disabled' : current?.status ?? 'pending',
    plan: current,
    aiPackage: current?.status === 'ready' ? current.package : null,
    error: current?.error ?? null,
    regenerate: () =>
      enabled && signature && startSynthesis(signature, siteId, conditions, { forceRefresh: true }).catch(() => {}),
    /** Server intervention ID for the plan on screen, requesting one immediately if needed. */
    ensureInterventionId: async () => {
      if (current?.interventionId) return current.interventionId;
      if (!enabled || !signature) return null;
      const record = await startSynthesis(signature, siteId, conditions).catch(() => null);
      return record?.interventionId ?? null;
    },
  };
}
