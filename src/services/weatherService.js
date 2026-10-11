/**
 * HeatGuard - Weather & Environmental Data Ingestion Service
 * Connects to Open-Meteo API with fallback simulation and parameter override support.
 */

import { calculateWBGT, evaluateNIOSHHeatRisk } from '../utils/wbgtMath';

export const SITE_PRESETS = [
  {
    id: 'chennai-metro',
    name: 'Chennai Metro Phase II Viaduct',
    city: 'Chennai, Tamil Nadu',
    lat: 13.0827,
    lon: 80.2707,
    industry: 'Infrastructure & Construction',
    workIntensity: 'HEAVY',
    workerCount: 42,
    shift: '08:00 - 16:30',
    primaryTask: 'Steel Rebar Tying & Elevated Concrete Pouring',
    surfaceType: 'Concrete & Steel (Albedo: 0.30)',
    shadeHubs: 2,
    supervisorName: 'Rajesh Murugan (Site Safety Lead)',
    defaultLanguage: 'ta',
    baseTemp: 37,
    baseHumidity: 68,
    baseSolar: 850,
    baseWind: 2.1,
  },
  {
    id: 'delhi-logistics',
    name: 'Delhi NCR Last-Mile Delivery Fleet',
    city: 'Delhi NCR',
    lat: 28.6139,
    lon: 77.2090,
    industry: 'Gig Logistics & Couriers',
    workIntensity: 'MODERATE',
    workerCount: 85,
    shift: '10:00 - 18:00',
    primaryTask: 'Motorcycle & E-bike Urban Route Dispatches',
    surfaceType: 'Asphalt Roadway (Albedo: 0.12)',
    shadeHubs: 4,
    supervisorName: 'Vikram Sharma (Fleet Operations Manager)',
    defaultLanguage: 'hi',
    baseTemp: 41,
    baseHumidity: 32,
    baseSolar: 920,
    baseWind: 1.8,
  },
  {
    id: 'ahmedabad-sanitation',
    name: 'Ahmedabad East Municipal Sector',
    city: 'Ahmedabad, Gujarat',
    lat: 23.0225,
    lon: 72.5714,
    industry: 'Municipal Sanitation & Waste',
    workIntensity: 'MODERATE',
    workerCount: 30,
    shift: '07:30 - 15:30',
    primaryTask: 'Continuous Street Sweeping & Waste Collection',
    surfaceType: 'Pavement & Bare Soil (Albedo: 0.22)',
    shadeHubs: 3,
    supervisorName: 'Kishore Patel (Ward Supervisor)',
    defaultLanguage: 'hi',
    baseTemp: 39,
    baseHumidity: 45,
    baseSolar: 880,
    baseWind: 2.4,
  },
];

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

    const wbgt = calculateWBGT(temp, rh, solar, wind);
    const risk = evaluateNIOSHHeatRisk(wbgt.wbgt, site.workIntensity);
    const timeline = generateHourlyTimeline(temp, rh, solar, wind, site.workIntensity);

    return {
      isLive: true,
      lastUpdated: new Date().toLocaleTimeString(),
      temp,
      humidity: rh,
      windSpeed: Math.round(wind * 10) / 10,
      solarRadiation: Math.round(solar),
      wbgt: wbgt.wbgt,
      wetBulb: wbgt.wetBulb,
      globeTemp: wbgt.globeTemp,
      heatIndex: wbgt.heatIndex,
      risk,
      timeline,
    };
  } catch (err) {
    console.warn(`[HeatGuard] Live weather fetch fallback for ${site.name}:`, err.message);
    // Return high-fidelity deterministic simulated weather
    const wbgt = calculateWBGT(site.baseTemp, site.baseHumidity, site.baseSolar, site.baseWind);
    const risk = evaluateNIOSHHeatRisk(wbgt.wbgt, site.workIntensity);
    const timeline = generateHourlyTimeline(
      site.baseTemp,
      site.baseHumidity,
      site.baseSolar,
      site.baseWind,
      site.workIntensity
    );

    return {
      isLive: false,
      lastUpdated: new Date().toLocaleTimeString() + ' (Calibrated Model)',
      temp: site.baseTemp,
      humidity: site.baseHumidity,
      windSpeed: site.baseWind,
      solarRadiation: site.baseSolar,
      wbgt: wbgt.wbgt,
      wetBulb: wbgt.wetBulb,
      globeTemp: wbgt.globeTemp,
      heatIndex: wbgt.heatIndex,
      risk,
      timeline,
    };
  }
}
