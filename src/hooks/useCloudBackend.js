import { useCallback, useEffect, useState } from 'react';
import { cloudApi } from '../services/cloudApi';

const HEALTH_INTERVAL_MS = 60000;
const SITE_SYNC_INTERVAL_MS = 5000;

/**
 * Detects the HeatGuard API. `connected` is false when no backend answers (static hosting,
 * offline review), in which case the app runs entirely on the Calibrated Local Engine.
 */
export function useCloudBackend() {
  const [state, setState] = useState({ status: 'probing', health: null });

  const refresh = useCallback(async () => {
    try {
      const health = await cloudApi.health();
      setState({ status: 'connected', health });
    } catch {
      setState({ status: 'unreachable', health: null });
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, HEALTH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { ...state, connected: state.status === 'connected', refresh };
}

/** Badge text + tone for the overall backend state. */
export function describeBackend({ status, health }) {
  if (status === 'probing') return { label: 'Connecting…', tone: 'neutral', detail: 'Probing HeatGuard API' };
  if (status !== 'connected') {
    return { label: 'Calibrated Local Engine', tone: 'local', detail: 'No backend reachable: physics, plans and audit run in this browser.' };
  }
  const s = health.services;
  const detail = [
    `Bedrock: ${s.bedrock.mode === 'live' ? s.bedrock.modelName : 'local engine'}`,
    `DynamoDB: ${s.dynamodb.mode === 'live' ? s.dynamodb.table : 'in-memory'}`,
    `EventBridge: ${s.eventbridge.mode === 'live' ? s.eventbridge.bus : 'in-process'}`,
    `SNS: ${s.sns.mode}`,
  ].join(' · ');
  if (health.mode === 'aws-live') return { label: 'AWS Cloud Live', tone: 'cloud', detail };
  if (health.mode === 'hybrid') return { label: s.bedrock.mode === 'live' ? 'Hybrid · Bedrock Live' : 'Hybrid · AWS Partial', tone: 'hybrid', detail };
  return { label: 'Local API · AWS Simulated', tone: 'local', detail };
}

/** Maps a DynamoDB ledger entry to the audit stream's shape. */
export function toUiAuditEntry(entry) {
  return {
    id: entry.id,
    ts: entry.ts,
    time: new Date(entry.ts).toLocaleTimeString(),
    type: entry.type,
    actor: entry.actor,
    details: entry.details,
    severity: entry.severity,
    persisted: true,
    seq: entry.seq,
    hash: entry.hash,
  };
}

/**
 * Server entries are authoritative; entries only this browser has seen (not yet persisted, or
 * client-only simulation events) are kept and interleaved by timestamp.
 */
export function mergeAuditEntries(previous, serverEntries) {
  const server = serverEntries.map(toUiAuditEntry);
  const serverIds = new Set(server.map((entry) => entry.id));
  const localOnly = previous.filter((entry) => !entry.persisted && entry.ts && !serverIds.has(entry.id));
  return [...server, ...localOnly].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 150);
}

/**
 * Keeps the active site's roster and audit ledger in sync with the backend, so acknowledgements
 * from other devices (a worker's phone) and server-side events (SNS dispatch receipts, scheduled
 * heat sweeps) appear on the supervisor console. onRoster / onAudit must be stable callbacks.
 */
export function useSiteSync({ connected, siteId, onRoster, onAudit }) {
  const [ledger, setLedger] = useState({ siteId: null, head: null, verification: null, kind: null });

  const sync = useCallback(
    async ({ verify = false } = {}) => {
      if (!connected) return;
      try {
        const [roster, audit] = await Promise.all([cloudApi.getRoster(siteId), cloudApi.getAudit(siteId, { verify })]);
        onRoster(siteId, roster.workers);
        onAudit(audit.entries);
        setLedger((prev) => ({
          siteId,
          head: audit.head,
          kind: audit.ledger,
          // Keep the last verification result while the chain head has not moved.
          verification:
            audit.verification ?? (prev.siteId === siteId && prev.head?.seq === audit.head?.seq ? prev.verification : null),
        }));
      } catch (err) {
        console.warn('[HeatGuard] Site sync failed:', err.message);
      }
    },
    [connected, siteId, onRoster, onAudit]
  );

  useEffect(() => {
    if (!connected) return undefined;
    sync({ verify: true });
    const timer = setInterval(() => sync(), SITE_SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [connected, sync]);

  return {
    ledger: connected && ledger.siteId === siteId ? ledger : null,
    verifyLedger: () => sync({ verify: true }),
    syncNow: () => sync(),
  };
}
