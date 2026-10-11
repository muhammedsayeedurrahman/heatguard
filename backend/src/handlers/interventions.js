/**
 * Interventions API (Lambda, HTTP API routes)
 *   POST /api/sites/{siteId}/interventions                          request a plan for current conditions
 *   GET  /api/sites/{siteId}/interventions/{interventionId}         poll plan status
 *   POST /api/sites/{siteId}/interventions/{interventionId}/decision supervisor approve / modify / reject
 *
 * Bedrock synthesis runs asynchronously (EventBridge -> Synthesis Lambda) because a trilingual
 * plan can take longer than API Gateway's 30-second integration limit.
 */

import { randomUUID } from 'node:crypto';
import { derivePlanningFacts, generateInterventionPackage, LOCAL_ENGINE } from '../core/interventionEngine.js';
import { buildConditionsSnapshot } from '../core/timeline.js';
import { getConfig, resolveServiceModes } from '../lib/config.js';
import { EventTypes, publishEvent } from '../lib/events.js';
import {
  clampNumber,
  createApiHandler,
  eventIdFrom,
  HttpError,
  oneOf,
  optionalString,
  requireSite,
} from '../lib/http.js';
import { getStore } from '../lib/store.js';

function present(record, extra = {}) {
  return {
    interventionId: record.id,
    status: record.status,
    signature: record.signature,
    engine: record.engine ?? null,
    package: record.package ?? null,
    synthesisAudit: record.synthesisAudit ?? null,
    decision: record.decision ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...extra,
  };
}

async function requestIntervention({ params, body }) {
  const site = requireSite(params.siteId);
  const c = body.conditions || {};
  const conditions = {
    temp: clampNumber(c.temp, -10, 60, 'conditions.temp'),
    humidity: clampNumber(c.humidity, 0, 100, 'conditions.humidity'),
    solar: clampNumber(c.solar, 0, 1400, 'conditions.solar'),
    wind: clampNumber(c.wind, 0, 40, 'conditions.wind'),
  };

  const weather = buildConditionsSnapshot(site, conditions);
  const facts = derivePlanningFacts(site, weather);
  const signature = `${facts.riskLevel}:${(Math.round(facts.wbgt * 2) / 2).toFixed(1)}`;
  const id = `INT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
  const baseline = generateInterventionPackage(site, weather, { id });
  const now = new Date().toISOString();

  const store = await getStore();
  const modes = await resolveServiceModes();

  if (modes.bedrock !== 'live') {
    // No AWS credentials: answer synchronously with the calibrated engine.
    const engine = { ...LOCAL_ENGINE, fallbackReason: 'Amazon Bedrock not configured (no AWS credentials)' };
    const record = { id, siteId: site.id, status: 'READY', signature, conditions, facts, baseline, package: { ...baseline, engine }, engine, createdAt: now, updatedAt: now };
    await store.putIntervention(site.id, record);
    return { statusCode: 200, body: present(record) };
  }

  const config = getConfig();
  const claim = await store.claimPlanCache(site.id, signature, id, config.planCacheTtlSeconds, {
    force: body.forceRefresh === true,
  });
  if (!claim.claimed && claim.interventionId) {
    const existing = await store.getIntervention(site.id, claim.interventionId);
    if (existing) return { statusCode: 200, body: present(existing, { cached: true }) };
  }

  const record = { id, siteId: site.id, status: 'SYNTHESIZING', signature, conditions, facts, baseline, createdAt: now, updatedAt: now };
  await store.putIntervention(site.id, record);
  const event = await publishEvent(EventTypes.INTERVENTION_REQUESTED, { siteId: site.id, interventionId: id });
  return { statusCode: 202, body: present(record, { event }) };
}

async function getIntervention({ params }) {
  const site = requireSite(params.siteId);
  const store = await getStore();
  const record = await store.getIntervention(site.id, params.interventionId);
  if (!record) throw new HttpError(404, `Unknown intervention "${params.interventionId}"`);
  return present(record);
}

const DECISION_AUDIT_TYPES = {
  APPROVED: 'SUPERVISOR_APPROVAL',
  MODIFIED: 'SUPERVISOR_CUSTOMIZATION',
  REJECTED: 'SAFETY_EXCEPTION_LOGGED',
};

async function decide({ params, body }) {
  const site = requireSite(params.siteId);
  const decision = oneOf(body.decision, Object.keys(DECISION_AUDIT_TYPES), 'decision');
  const optionId = oneOf(body.optionId ?? 'opt-a', ['opt-a', 'opt-b', 'opt-c'], 'optionId');
  const planSource = oneOf(body.planSource ?? 'local', ['bedrock', 'local'], 'planSource');
  const reason = optionalString(body.reason, 'reason', 500);
  if (decision === 'REJECTED' && (!reason || reason.trim().length < 5)) {
    throw new HttpError(400, 'A rejection requires an operational reason (min 5 characters)');
  }

  const store = await getStore();
  const record = await store.getIntervention(site.id, params.interventionId);
  if (!record) throw new HttpError(404, `Unknown intervention "${params.interventionId}"`);

  const p = body.params || {};
  const modification =
    decision === 'MODIFIED'
      ? {
          shiftStart: optionalString(p.shiftStart, 'params.shiftStart', 5),
          shiftEnd: optionalString(p.shiftEnd, 'params.shiftEnd', 5),
          restDurationMins: clampNumber(p.restDurationMins ?? 30, 0, 60, 'params.restDurationMins'),
          waterPerWorkerLiters: clampNumber(p.waterPerWorkerLiters ?? 3.5, 0, 12, 'params.waterPerWorkerLiters'),
          activeMistingFans: clampNumber(p.activeMistingFans ?? 0, 0, 100, 'params.activeMistingFans'),
          supervisorNote: optionalString(p.supervisorNote, 'params.supervisorNote', 500),
        }
      : undefined;

  const plan = (planSource === 'bedrock' && record.package) || record.baseline;
  const details = {
    APPROVED: `Approved ${plan.primaryRecommendation.title} (${optionId}). Multilingual instructions queued for broadcast to ${site.workerCount} personnel.`,
    MODIFIED: modification
      ? `Adjusted schedule: ${modification.shiftStart}–${modification.shiftEnd}, ${modification.restDurationMins}m rest/hr, ${modification.waterPerWorkerLiters}L water quota. Note: "${modification.supervisorNote ?? ''}"`
      : '',
    REJECTED: `Intervention REJECTED with operational justification: "${reason}". Compliance exception filed.`,
  }[decision];

  const decisionRecord = { decision, optionId, planSource, reason, modification, decidedAt: new Date().toISOString() };
  await store.updateIntervention(site.id, record.id, { decision: decisionRecord });

  const { entry, duplicate } = await store.appendAudit(site.id, {
    id: eventIdFrom(body.clientEventId),
    type: DECISION_AUDIT_TYPES[decision],
    actor: site.supervisorName,
    details,
    severity: decision === 'REJECTED' ? 'danger' : decision === 'APPROVED' ? 'success' : 'info',
    meta: { interventionId: record.id, optionId, planSource },
  });
  const event = duplicate
    ? null
    : await publishEvent(EventTypes.INTERVENTION_DECIDED, {
        siteId: site.id,
        interventionId: record.id,
        decision,
        optionId,
        planSource,
      });
  return { auditEntry: entry, duplicate, event };
}

export const handler = createApiHandler({
  'POST /api/sites/{siteId}/interventions': requestIntervention,
  'GET /api/sites/{siteId}/interventions/{interventionId}': getIntervention,
  'POST /api/sites/{siteId}/interventions/{interventionId}/decision': decide,
});
