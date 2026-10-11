/**
 * HeatGuard - Shift timeline & environmental snapshot builder (isomorphic: Lambda + browser).
 */

import { calculateWBGT, evaluateNIOSHHeatRisk } from './wbgtMath.js';

/**
 * Generates an 8-hour timeline with solar curves and calculated WBGT
 */
export function generateHourlyTimeline(baseTemp, baseHumidity, baseSolar, baseWind, workIntensity) {
  const hours = [
    { hour: '08:00', tempMod: -6, rhMod: +15, solarMod: 0.3 },
    { hour: '09:00', tempMod: -4, rhMod: +10, solarMod: 0.5 },
    { hour: '10:00', tempMod: -2, rhMod: +5, solarMod: 0.75 },
    { hour: '11:00', tempMod: 0, rhMod: 0, solarMod: 0.9 },
    { hour: '12:00', tempMod: +2, rhMod: -4, solarMod: 1.0 },
    { hour: '13:00', tempMod: +3, rhMod: -8, solarMod: 1.05 },
    { hour: '14:00', tempMod: +3.5, rhMod: -10, solarMod: 1.0 },
    { hour: '15:00', tempMod: +2.5, rhMod: -6, solarMod: 0.85 },
    { hour: '16:00', tempMod: +1, rhMod: -2, solarMod: 0.65 },
    { hour: '17:00', tempMod: -1, rhMod: +4, solarMod: 0.35 },
  ];

  return hours.map((slot) => {
    const temp = Math.round((baseTemp + slot.tempMod) * 10) / 10;
    const rh = Math.min(95, Math.max(15, Math.round(baseHumidity + slot.rhMod)));
    const solar = Math.round(baseSolar * slot.solarMod);
    const wind = Math.max(0.5, baseWind);

    const wbgtData = calculateWBGT(temp, rh, solar, wind, false);
    const risk = evaluateNIOSHHeatRisk(wbgtData.wbgt, workIntensity);

    return {
      time: slot.hour,
      temp,
      rh,
      solar,
      wind,
      wbgt: wbgtData.wbgt,
      riskLevel: risk.riskLevel,
      color: risk.color,
      workRestRatio: risk.workRestRatio,
      isDangerSpike: risk.riskLevel === 'HIGH_RISK' || risk.riskLevel === 'EXTREME_DANGER',
    };
  });
}

/**
 * Builds the full environmental snapshot (WBGT breakdown, NIOSH risk, shift timeline)
 * from raw meteorological conditions. Same shape the dashboard renders.
 */
export function buildConditionsSnapshot(site, { temp, humidity, solar, wind }, meta = {}) {
  const wbgt = calculateWBGT(temp, humidity, solar, wind);
  const risk = evaluateNIOSHHeatRisk(wbgt.wbgt, site.workIntensity);
  const timeline = generateHourlyTimeline(temp, humidity, solar, wind, site.workIntensity);

  return {
    isLive: meta.isLive ?? false,
    lastUpdated: meta.lastUpdated ?? new Date().toLocaleTimeString(),
    temp,
    humidity,
    windSpeed: wind,
    solarRadiation: solar,
    wbgt: wbgt.wbgt,
    wetBulb: wbgt.wetBulb,
    globeTemp: wbgt.globeTemp,
    heatIndex: wbgt.heatIndex,
    risk,
    timeline,
  };
}
