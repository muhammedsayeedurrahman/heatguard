/**
 * Workforce API (Lambda, HTTP API routes)
 *   GET  /api/sites/{siteId}/roster                        roster from DynamoDB (seeded on first read)
 *   POST /api/sites/{siteId}/workers/{workerId}/events     1-tap ACK, hydration log, heat SOS
 *   POST /api/sites/{siteId}/nudge                         SMS reminder to unacknowledged workers
 */

import { EventTypes, publishEvent } from '../lib/events.js';
import { createApiHandler, eventIdFrom, oneOf, optionalString, requireSite } from '../lib/http.js';
import { getStore } from '../lib/store.js';

async function getRoster({ params }) {
  const site = requireSite(params.siteId);
  const store = await getStore();
  return { siteId: site.id, workers: await store.getRoster(site.id) };
}

async function recordWorkerEvent({ params, body }) {
  const site = requireSite(params.siteId);
  const type = oneOf(body.type, ['ACK', 'WATER', 'SOS'], 'type');
  const store = await getStore();
  const roster = await store.getRoster(site.id);
  const current = roster.find((w) => w.id === params.workerId);
  const eventId = eventIdFrom(body.clientEventId);

  // Idempotent retries (e.g. offline outbox replays) must not double-count hydration.
  if (current && (await store.hasAuditEvent(site.id, eventId))) {
    return { worker: current, duplicate: true };
  }

  let worker;
  let audit;
  let detailType;
  if (type === 'ACK') {
    const status = oneOf(body.status ?? 'RESTING_SHADE', ['ACKNOWLEDGED', 'RESTING_SHADE'], 'status');
    const channel = oneOf(body.channel ?? 'pwa', ['pwa', 'sms-link'], 'channel');
    worker = await store.updateWorker(site.id, params.workerId, {
      set: {
        status,
        ackAt: new Date().toISOString(),
        ackTime: optionalString(body.localTime, 'localTime', 16) ?? new Date().toISOString().slice(11, 16) + ' UTC',
      },
    });
    audit = {
      type: 'WORKER_1TAP_ACK',
      details:
        channel === 'pwa'
          ? `Acknowledged rest directive via PWA. Checked into ${worker.hub}.`
          : 'Verified directive via mobile short link (Hydrated & in shade).',
      severity: 'success',
    };
    detailType = EventTypes.WORKER_ACKNOWLEDGED;
  } else if (type === 'WATER') {
    worker = await store.updateWorker(site.id, params.workerId, { increment: { waterGlasses: 1 } });
    audit = {
      type: 'HYDRATION_LOG',
      details: `Logged +250 mL hydration intake (Total: ${worker.waterGlasses} glasses today).`,
      severity: 'info',
    };
    detailType = EventTypes.HYDRATION_LOGGED;
  } else {
    worker = await store.updateWorker(site.id, params.workerId, { set: { emergency: true, sosAt: new Date().toISOString() } });
    audit = {
      type: 'EMERGENCY_HEAT_SOS',
      details: `CRITICAL ALARM: Worker reported dizziness/heat illness at ${worker.hub}! First-aid team alerted.`,
      severity: 'danger',
    };
    detailType = EventTypes.HEAT_EMERGENCY_REPORTED;
  }

  const { entry, duplicate } = await store.appendAudit(site.id, {
    id: eventId,
    actor: worker.name,
    ...audit,
    meta: { workerId: worker.id },
  });
  const event = duplicate
    ? null
    : await publishEvent(detailType, {
        siteId: site.id,
        workerId: worker.id,
        workerName: worker.name,
        hub: worker.hub,
        status: worker.status,
        waterGlasses: worker.waterGlasses,
      });
  return { worker, auditEntry: entry, duplicate, event };
}

async function nudgePending({ params, body }) {
  const site = requireSite(params.siteId);
  const store = await getStore();
  const pending = (await store.getRoster(site.id)).filter((w) => w.status === 'NOTIFIED');
  if (!pending.length) return { notified: 0, event: null };

  // The dispatcher records the audit entry once SNS has accepted the message.
  const event = await publishEvent(EventTypes.WORKER_NUDGE_REQUESTED, {
    siteId: site.id,
    workerIds: pending.map((w) => w.id),
    auditEventId: eventIdFrom(body.clientEventId),
  });
  return { notified: pending.length, event };
}

export const handler = createApiHandler({
  'GET /api/sites/{siteId}/roster': getRoster,
  'POST /api/sites/{siteId}/workers/{workerId}/events': recordWorkerEvent,
  'POST /api/sites/{siteId}/nudge': nudgePending,
});
