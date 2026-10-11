/**
 * Amazon EventBridge publisher. When the bus is not deployed (local runs), events are
 * delivered in-process to the same handlers, using matchers that mirror the rules in
 * template.yaml so local behavior tracks the cloud wiring.
 */

import { randomUUID } from 'node:crypto';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { getConfig, resolveServiceModes } from './config.js';
import { log } from './log.js';

export const EVENT_SOURCE = 'heatguard.safety';

export const EventTypes = Object.freeze({
  INTERVENTION_REQUESTED: 'InterventionRequested',
  INTERVENTION_SYNTHESIZED: 'InterventionSynthesized',
  INTERVENTION_DECIDED: 'InterventionDecided',
  WORKER_ACKNOWLEDGED: 'WorkerAcknowledged',
  HYDRATION_LOGGED: 'HydrationLogged',
  HEAT_EMERGENCY_REPORTED: 'HeatEmergencyReported',
  WORKER_NUDGE_REQUESTED: 'WorkerNudgeRequested',
  HEAT_RISK_EVALUATED: 'HeatRiskEvaluated',
});

// Mirrors SynthesisRule / BroadcastRule / SafetyAlertRule in template.yaml.
const LOCAL_RULES = [
  {
    name: 'SynthesisRule',
    target: () => import('../handlers/synthesis.js'),
    matches: (type) => type === EventTypes.INTERVENTION_REQUESTED,
  },
  {
    name: 'BroadcastRule',
    target: () => import('../handlers/dispatch.js'),
    matches: (type, detail) =>
      (type === EventTypes.INTERVENTION_DECIDED && ['APPROVED', 'MODIFIED'].includes(detail.decision)) ||
      type === EventTypes.WORKER_NUDGE_REQUESTED,
  },
  {
    name: 'SafetyAlertRule',
    target: () => import('../handlers/dispatch.js'),
    matches: (type, detail) =>
      type === EventTypes.HEAT_EMERGENCY_REPORTED ||
      (type === EventTypes.INTERVENTION_DECIDED && detail.decision === 'REJECTED') ||
      (type === EventTypes.HEAT_RISK_EVALUATED && ['HIGH_RISK', 'EXTREME_DANGER'].includes(detail.riskLevel)),
  },
];

let client = null;

export async function publishEvent(detailType, detail) {
  const modes = await resolveServiceModes();
  const config = getConfig();

  if (modes.eventbridge === 'live') {
    client ??= new EventBridgeClient({ region: config.region });
    const result = await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: config.eventBusName,
            Source: EVENT_SOURCE,
            DetailType: detailType,
            Detail: JSON.stringify(detail),
          },
        ],
      })
    );
    if (result.FailedEntryCount) {
      const failed = result.Entries?.[0];
      throw new Error(`EventBridge rejected ${detailType}: ${failed?.ErrorCode} ${failed?.ErrorMessage}`);
    }
    return { eventId: result.Entries?.[0]?.EventId, transport: 'eventbridge', bus: config.eventBusName };
  }

  const event = {
    version: '0',
    id: randomUUID(),
    'detail-type': detailType,
    source: EVENT_SOURCE,
    time: new Date().toISOString(),
    region: config.region,
    resources: [],
    detail,
  };
  for (const rule of LOCAL_RULES.filter((r) => r.matches(detailType, detail))) {
    // Asynchronous delivery, like EventBridge -> Lambda.
    setImmediate(async () => {
      try {
        const { handler } = await rule.target();
        await handler(event);
      } catch (err) {
        log.error('In-process rule target failed', { rule: rule.name, detailType, error: err?.message });
      }
    });
  }
  return { eventId: event.id, transport: 'in-process' };
}
