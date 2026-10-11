/**
 * HeatMonitor Lambda - invoked on a schedule by Amazon EventBridge Scheduler.
 * Pulls live Open-Meteo conditions for every site, runs the Liljegren WBGT / NIOSH engine
 * server-side, and on a risk-level transition writes an ENVIRONMENT_TRIGGER audit entry and
 * publishes HeatRiskEvaluated (escalations are routed to the safety-alerts SNS topic).
 */

import { SITE_PRESETS } from '../core/sites.js';
import { buildConditionsSnapshot } from '../core/timeline.js';
import { EventTypes, publishEvent } from '../lib/events.js';
import { log } from '../lib/log.js';
import { getStore } from '../lib/store.js';

async function fetchConditions(site) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${site.lat}&longitude=${site.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,direct_normal_irradiance&timezone=auto`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const { current } = await res.json();
  return {
    temp: current.temperature_2m ?? site.baseTemp,
    humidity: current.relative_humidity_2m ?? site.baseHumidity,
    solar: Math.round(current.direct_normal_irradiance ?? site.baseSolar),
    wind: Math.round(Math.max(0.8, (current.wind_speed_10m ?? 8) / 3.6) * 10) / 10, // km/h -> m/s
  };
}

async function evaluateSite(site, store) {
  const conditions = await fetchConditions(site);
  const snapshot = buildConditionsSnapshot(site, conditions, { isLive: true });
  const previous = await store.getRiskState(site.id);
  const riskLevel = snapshot.risk.riskLevel;
  const evaluatedAt = new Date().toISOString();

  await store.putRiskState(site.id, { riskLevel, wbgt: snapshot.wbgt, conditions, evaluatedAt });
  if (previous?.riskLevel === riskLevel) return { siteId: site.id, riskLevel, changed: false };

  await store.appendAudit(site.id, {
    id: `ENV-${site.id}-${Date.now().toString(36)}`,
    type: 'ENVIRONMENT_TRIGGER',
    actor: 'Liljegren WBGT Engine · Lambda HeatMonitor',
    details: `Live Open-Meteo feed: ${conditions.temp}°C, ${conditions.humidity}% RH, ${conditions.solar} W/m², ${conditions.wind} m/s → WBGT ${snapshot.wbgt}°C. Risk ${previous?.riskLevel ?? 'UNSET'} → ${riskLevel} (NIOSH ${site.workIntensity} work).`,
    severity: riskLevel === 'HIGH_RISK' || riskLevel === 'EXTREME_DANGER' ? 'danger' : 'info',
    meta: { wbgt: snapshot.wbgt, riskLevel, previousRiskLevel: previous?.riskLevel ?? null },
  });
  await publishEvent(EventTypes.HEAT_RISK_EVALUATED, {
    siteId: site.id,
    wbgt: snapshot.wbgt,
    riskLevel,
    previousRiskLevel: previous?.riskLevel ?? null,
  });
  return { siteId: site.id, riskLevel, changed: true };
}

export async function handler() {
  const store = await getStore();
  const results = await Promise.allSettled(SITE_PRESETS.map((site) => evaluateSite(site, store)));
  const summary = results.map((result, i) =>
    result.status === 'fulfilled' ? result.value : { siteId: SITE_PRESETS[i].id, error: result.reason?.message }
  );
  log.info('Heat monitor sweep complete', { summary });
  return summary;
}
