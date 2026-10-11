/**
 * Notification Dispatcher Lambda - target of the EventBridge BroadcastRule and SafetyAlertRule.
 *   InterventionDecided (APPROVED|MODIFIED) -> multilingual directive on the worker broadcast topic
 *   WorkerNudgeRequested                    -> reminder on the worker broadcast topic
 *   HeatEmergencyReported                   -> SOS on the supervisor safety-alerts topic
 *   InterventionDecided (REJECTED)          -> compliance exception on the safety-alerts topic
 *   HeatRiskEvaluated (HIGH|EXTREME)        -> risk escalation on the safety-alerts topic
 * Every publish is receipted in the audit ledger with its SNS MessageId.
 */

import { findSite } from '../core/sites.js';
import { EventTypes } from '../lib/events.js';
import { log } from '../lib/log.js';
import { notify, Topics } from '../lib/notify.js';
import { getStore } from '../lib/store.js';

function directiveText(pkg) {
  return ['en', 'hi', 'ta']
    .map((lang) => pkg.workerDirectives?.[lang])
    .filter(Boolean)
    .map((d) => [d.title, d.shiftAdjustment, ...d.actionSteps.map((step, i) => `${i + 1}. ${step}`)].join('\n'))
    .join('\n\n');
}

async function buildNotification(type, detail, site, store) {
  switch (type) {
    case EventTypes.INTERVENTION_DECIDED: {
      if (detail.decision === 'REJECTED') {
        const record = await store.getIntervention(site.id, detail.interventionId);
        return {
          topic: Topics.ALERTS,
          subject: `HeatGuard compliance exception - ${site.name}`,
          message: `${site.supervisorName} rejected heat intervention ${detail.interventionId} at ${site.name}.\nReason: ${record?.decision?.reason ?? 'n/a'}\nWBGT ${record?.facts?.wbgt ?? '?'}°C (${record?.facts?.riskLevel ?? '?'}). A compliance exception has been filed in the audit ledger.`,
          attributes: { siteId: site.id, kind: 'compliance-exception' },
          audit: { type: 'EXCEPTION_ALERT_DISPATCHED', actor: 'AWS SNS Safety Alerts', severity: 'danger', details: 'Compliance exception escalated to safety leadership via SNS.' },
        };
      }
      const record = await store.getIntervention(site.id, detail.interventionId);
      if (!record) return null;
      const pkg = (detail.planSource === 'bedrock' && record.package) || record.baseline;
      return {
        topic: Topics.BROADCAST,
        subject: `HeatGuard directive - ${site.name}`,
        message: `${pkg.primaryRecommendation.title}\n\n${directiveText(pkg)}`,
        attributes: { siteId: site.id, riskLevel: record.facts.riskLevel, kind: 'directive' },
        audit: {
          type: 'BROADCAST_DISPATCH',
          actor: 'AWS SNS Dispatcher',
          severity: 'info',
          details: `Multilingual directive (EN/HI/TA) published to the worker broadcast topic for ${site.workerCount} personnel (${detail.decision.toLowerCase()} plan, ${pkg.engine?.provider === 'amazon-bedrock' ? pkg.engine.modelName : 'calibrated local engine'}).`,
        },
      };
    }
    case EventTypes.WORKER_NUDGE_REQUESTED:
      return {
        topic: Topics.BROADCAST,
        subject: `HeatGuard reminder - ${site.name}`,
        message: [
          'Heat safety reminder: please move to shade, drink water and tap the confirmation link.',
          'गर्मी सुरक्षा: कृपया छाया में जाएं, पानी पिएं और पुष्टि लिंक दबाएं।',
          'வெப்ப பாதுகாப்பு: நிழலுக்குச் சென்று தண்ணீர் குடித்து உறுதிப்படுத்தும் இணைப்பை அழுத்தவும்.',
        ].join('\n'),
        attributes: { siteId: site.id, kind: 'nudge', workerIds: detail.workerIds.join(',') },
        auditId: detail.auditEventId,
        audit: {
          type: 'SMS_NUDGE_BROADCAST',
          actor: 'AWS SNS Dispatcher',
          severity: 'info',
          details: `Sent urgent SMS push reminder in Tamil/Hindi/English to ${detail.workerIds.length} unacknowledged workers.`,
        },
      };
    case EventTypes.HEAT_EMERGENCY_REPORTED:
      return {
        topic: Topics.ALERTS,
        subject: `HeatGuard SOS - ${detail.workerName} at ${site.name}`,
        message: `HEAT EMERGENCY: ${detail.workerName} (${detail.workerId}) reported dizziness / heat illness at ${detail.hub}, ${site.name}, ${site.city}.\nDispatch first aid immediately: move to shade, cool the body, give fluids if conscious, call emergency services if confused or collapsed.`,
        attributes: { siteId: site.id, kind: 'sos', workerId: detail.workerId },
        audit: { type: 'SOS_ALERT_DISPATCHED', actor: 'AWS SNS Safety Alerts', severity: 'danger', details: `SOS for ${detail.workerName} paged to supervisors and first-aid team.` },
      };
    case EventTypes.HEAT_RISK_EVALUATED:
      return {
        topic: Topics.ALERTS,
        subject: `HeatGuard risk escalation - ${site.name}`,
        message: `Live weather puts ${site.name} at ${detail.riskLevel} (WBGT ${detail.wbgt}°C, previously ${detail.previousRiskLevel ?? 'unknown'}). Open HeatGuard to review and authorize an intervention.`,
        attributes: { siteId: site.id, kind: 'risk-escalation', riskLevel: detail.riskLevel },
        audit: { type: 'RISK_ALERT_DISPATCHED', actor: 'AWS SNS Safety Alerts', severity: 'danger', details: `Risk escalation (${detail.riskLevel}, WBGT ${detail.wbgt}°C) sent to site supervisors.` },
      };
    default:
      return null;
  }
}

export async function handler(event) {
  const type = event['detail-type'];
  const detail = event.detail || {};
  const site = findSite(detail.siteId);
  if (!site) {
    log.warn('Dispatch skipped: unknown site', { type, siteId: detail.siteId });
    return;
  }

  const store = await getStore();
  const notification = await buildNotification(type, detail, site, store);
  if (!notification) return;

  // EventBridge may redeliver: the audit ID is derived from the event so a replay is a no-op.
  const auditId = notification.auditId || `DSP-${event.id}`;
  if (await store.hasAuditEvent(site.id, auditId)) return;

  const { messageId, transport } = await notify(notification.topic, notification);
  await store.appendAudit(site.id, {
    id: auditId,
    ...notification.audit,
    details: `${notification.audit.details} ${transport === 'sns' ? `SNS MessageId ${messageId}.` : '(SNS simulated locally.)'}`,
    meta: { messageId, transport, topic: notification.topic, sourceEvent: type },
  });
}
