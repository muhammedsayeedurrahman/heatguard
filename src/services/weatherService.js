/**
 * HeatGuard - Weather & Environmental Data Ingestion Service
 * Connects to Open-Meteo API with fallback simulation and parameter override support.
 * Site profiles, timeline and snapshot math are shared with the AWS Lambda backend.
 */

import { SITE_PRESETS } from '../../backend/src/core/sites.js';
import { buildConditionsSnapshot, generateHourlyTimeline } from '../../backend/src/core/timeline.js';

export { SITE_PRESETS, buildConditionsSnapshot, generateHourlyTimeline };

/**
 * Fetches real weather data from Open-Meteo with fallback
 */
export async function fetchLiveWeatherData(site) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${site.lat}&longitude=${site.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,direct_normal_irradiance&timezone=auto`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const current = data.current;

    const temp = current.temperature_2m ?? site.baseTemp;
    const rh = current.relative_humidity_2m ?? site.baseHumidity;
    const wind = Math.max(0.8, (current.wind_speed_10m ?? 8) / 3.6); // km/h to m/s
    const solar = current.direct_normal_irradiance ?? site.baseSolar;

    return buildConditionsSnapshot(
      site,
      { temp, humidity: rh, solar: Math.round(solar), wind: Math.round(wind * 10) / 10 },
      { isLive: true, lastUpdated: new Date().toLocaleTimeString() }
    );
  } catch (err) {
    console.warn(`[HeatGuard] Live weather fetch fallback for ${site.name}:`, err.message);
    // Return high-fidelity deterministic simulated weather
    return buildConditionsSnapshot(
      site,
      { temp: site.baseTemp, humidity: site.baseHumidity, solar: site.baseSolar, wind: site.baseWind },
      { isLive: false, lastUpdated: new Date().toLocaleTimeString() + ' (Calibrated Model)' }
    );
  }
}
