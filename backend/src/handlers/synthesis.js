/**
 * Synthesis Lambda - target of the EventBridge `InterventionRequested` rule.
 * Calls Claude on Amazon Bedrock, validates the plan, persists it to DynamoDB and records
 * the outcome in the site's audit ledger. Any Bedrock failure degrades to the calibrated
 * local plan rather than leaving the supervisor without one.
 */

import { composeInterventionPackage, LOCAL_ENGINE } from '../core/interventionEngine.js';
import { findSite } from '../core/sites.js';
import { buildConditionsSnapshot } from '../core/timeline.js';
import { describeBedrockFailure, synthesizePlan } from '../lib/bedrock.js';
import { EventTypes, publishEvent } from '../lib/events.js';
import { log } from '../lib/log.js';
import { getStore } from '../lib/store.js';

export async function handler(event) {
  const { siteId, interventionId } = event.detail || {};
  const site = findSite(siteId);
  const store = await getStore();
  const record = site ? await store.getIntervention(siteId, interventionId) : null;

  // EventBridge delivers at least once: only the first delivery does the work.
  if (!record || record.status !== 'SYNTHESIZING') {
    log.warn('Synthesis skipped', { siteId, interventionId, status: record?.status ?? 'missing' });
    return;
  }

  const weather = buildConditionsSnapshot(site, record.conditions);
  let pkg;
  let auditEntry;

  try {
    const { plan, engine } = await synthesizePlan({ site, weather, facts: record.facts });
    pkg = composeInterventionPackage(record.baseline, plan, engine);
    const seconds = (engine.latencyMs / 1000).toFixed(1);
    ({ entry: auditEntry } = await store.appendAudit(siteId, {
      id: `SYN-${interventionId}`,
      type: 'INTERVENTION_SYNTHESIS',
      actor: `Amazon Bedrock · ${engine.modelName}`,
      details: `Generated 3 constraint-checked strategies + EN/HI/TA worker directives for WBGT ${record.facts.wbgt}°C (${record.facts.riskLevel}) in ${seconds}s · ${engine.usage.inputTokens} in / ${engine.usage.outputTokens} out tokens.`,
      severity: 'info',
      meta: { interventionId, modelId: engine.modelId, latencyMs: engine.latencyMs, ...engine.usage },
    }));
    await store.putStatus('bedrock', { ok: true, at: new Date().toISOString(), modelId: engine.modelId, latencyMs: engine.latencyMs });
  } catch (err) {
    const reason = describeBedrockFailure(err);
    log.error('Bedrock synthesis failed; issuing calibrated local plan', { siteId, interventionId, reason, error: err?.message });
    pkg = { ...record.baseline, engine: { ...LOCAL_ENGINE, fallbackReason: reason } };
    ({ entry: auditEntry } = await store.appendAudit(siteId, {
      id: `SYN-${interventionId}`,
      type: 'INTERVENTION_SYNTHESIS',
      actor: 'Calibrated Local Engine (Bedrock fallback)',
      details: `Amazon Bedrock unavailable (${reason}). Deterministic NIOSH plan issued for WBGT ${record.facts.wbgt}°C.`,
      severity: 'info',
      meta: { interventionId, fallbackReason: reason },
    }));
    await store.putStatus('bedrock', { ok: false, at: new Date().toISOString(), error: reason });
    // Do not pin the fallback plan in the cache: the next request should retry Bedrock.
    await store.releasePlanCache(siteId, record.signature);
  }

  await store.updateIntervention(siteId, interventionId, {
    status: 'READY',
    package: pkg,
    engine: pkg.engine,
    synthesisAudit: auditEntry,
  });
  await publishEvent(EventTypes.INTERVENTION_SYNTHESIZED, {
    siteId,
    interventionId,
    provider: pkg.engine.provider,
    modelId: pkg.engine.modelId ?? null,
  });
}
