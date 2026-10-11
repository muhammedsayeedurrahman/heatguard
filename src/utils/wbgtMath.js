/**
 * HeatGuard - Scientific Heat Stress & WBGT Calculation Engine
 * Based on Liljegren physical formulation, Stull's Wet-Bulb approximation,
 * and NIOSH / OSHA Occupational Heat Exposure criteria.
 */

/**
 * Calculates Wet-Bulb Temperature (Tnw) using Stull's formula
 * Accurate to within 0.1°C across typical environmental ranges.
 * @param {number} tempC - Dry-bulb temperature in °C
 * @param {number} rh - Relative humidity in % (0 - 100)
 * @returns {number} Wet-bulb temperature in °C
 */
export function calculateWetBulb(tempC, rh) {
  const T = tempC;
  const RH = Math.min(100, Math.max(0, rh));

  const tw =
    T * Math.atan(0.151977 * Math.pow(RH + 8.313659, 0.5)) +
    Math.atan(T + RH) -
    Math.atan(RH - 1.676331) +
    0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) -
    4.686035;

  return Math.round(tw * 10) / 10;
}

/**
 * Calculates Black Globe Temperature (Tg) in direct sunlight
 * @param {number} tempC - Dry-bulb temperature in °C
 * @param {number} solarRadiation - Direct normal solar radiation in W/m² (0 - 1100)
 * @param {number} windSpeed - Wind speed in m/s
 * @returns {number} Globe temperature in °C
 */
export function calculateGlobeTemperature(tempC, solarRadiation = 700, windSpeed = 2.0) {
  const u = Math.max(0.4, windSpeed);
  // Empirical approximation derived from Liljegren outdoor physical equilibrium
  const deltaT = (0.01498 * solarRadiation) / Math.pow(u, 0.58);
  return Math.round((tempC + deltaT) * 10) / 10;
}

/**
 * Calculates outdoor Wet-Bulb Globe Temperature (WBGT)
 * Standard formula: WBGT_out = 0.7*Tnw + 0.2*Tg + 0.1*Ta
 * @param {number} tempC - Dry-bulb temperature in °C
 * @param {number} rh - Relative humidity %
 * @param {number} solarRadiation - Solar radiation in W/m²
 * @param {number} windSpeed - Wind speed in m/s
 * @param {boolean} inShade - Whether measuring shaded/indoor conditions
 * @returns {object} Full WBGT breakdown
 */
export function calculateWBGT(tempC, rh, solarRadiation = 700, windSpeed = 2.0, inShade = false) {
  const tWet = calculateWetBulb(tempC, rh);
  const tGlobe = inShade ? tempC : calculateGlobeTemperature(tempC, solarRadiation, windSpeed);

  let wbgt;
  if (inShade) {
    // Indoor/Shaded WBGT = 0.7*Tnw + 0.3*Tg (where Tg approx Ta in shade)
    wbgt = 0.7 * tWet + 0.3 * tempC;
  } else {
    // Outdoor WBGT = 0.7*Tnw + 0.2*Tg + 0.1*Ta
    wbgt = 0.7 * tWet + 0.2 * tGlobe + 0.1 * tempC;
  }

  wbgt = Math.round(wbgt * 10) / 10;

  // Heat Index approximation for comparison
  const heatIndex = calculateHeatIndex(tempC, rh);

  return {
    wbgt,
    dryBulb: tempC,
    wetBulb: tWet,
    globeTemp: tGlobe,
    heatIndex,
    inShade,
    solarRadiation,
    windSpeed,
    humidity: rh,
  };
}

/**
 * Standard Rothfusz Heat Index calculation for reference
 */
export function calculateHeatIndex(T, RH) {
  if (T < 27) return T;
  const c1 = -8.78469475556;
  const c2 = 1.61139411;
  const c3 = 2.33854883889;
  const c4 = -0.14611605;
  const c5 = -0.012308094;
  const c6 = -0.0164248277778;
  const c7 = 0.002211732;
  const c8 = 0.00072546;
  const c9 = -0.000003582;

  const hi =
    c1 +
    c2 * T +
    c3 * RH +
    c4 * T * RH +
    c5 * T * T +
    c6 * RH * RH +
    c7 * T * T * RH +
    c8 * T * RH * RH +
    c9 * T * T * RH * RH;

  return Math.round(hi * 10) / 10;
}

/**
 * Evaluates occupational heat strain risk against NIOSH/OSHA standards
 * @param {number} wbgt - Calculated WBGT in °C
 * @param {string} workIntensity - 'LIGHT' (200W), 'MODERATE' (300W), 'HEAVY' (400W+)
 * @param {boolean} acclimatized - Whether the workforce is heat-acclimatized
 */
export function evaluateNIOSHHeatRisk(wbgt, workIntensity = 'HEAVY', acclimatized = true) {
  // Threshold matrices based on NIOSH Publication No. 2016-106
  const thresholds = {
    LIGHT: { caution: 30.0, high: 31.5, extreme: 32.5, watts: 200 },
    MODERATE: { caution: 28.0, high: 30.0, extreme: 31.5, watts: 300 },
    HEAVY: { caution: 26.0, high: 28.5, extreme: 30.5, watts: 450 },
  };

  const limit = thresholds[workIntensity] || thresholds.HEAVY;
  // If unacclimatized, threshold drops by 2.0°C
  const adjustment = acclimatized ? 0 : 2.0;
  const cautionThresh = limit.caution - adjustment;
  const highThresh = limit.high - adjustment;
  const extremeThresh = limit.extreme - adjustment;

  let riskLevel = 'SAFE';
  let workRestRatio = '100% Work / Continuous';
  let workMinutesPerHour = 60;
  let restMinutesPerHour = 0;
  let color = '#10B981'; // Green
  let badgeText = 'Safe Exposure';
  let actionSummary = 'Normal work activities permitted. Maintain standard water access.';

  if (wbgt >= extremeThresh) {
    riskLevel = 'EXTREME_DANGER';
    workRestRatio = 'Cease Outdoor Heavy Work / Night Shift Only';
    workMinutesPerHour = 0;
    restMinutesPerHour = 60;
    color = '#EF4444'; // Red
    badgeText = 'Severe Heat Danger';
    actionSummary = 'Cease strenuous outdoor work immediately. Transfer workers to climate-controlled or shaded rest zones.';
  } else if (wbgt >= highThresh) {
    riskLevel = 'HIGH_RISK';
    workRestRatio = '25% Work / 75% Rest (15m work / 45m rest)';
    workMinutesPerHour = 15;
    restMinutesPerHour = 45;
    color = '#F97316'; // Orange
    badgeText = 'High Heat Hazard';
    actionSummary = 'Enforce mandatory 45-min shaded rest per hour. Move heavy tasks to cooler hours.';
  } else if (wbgt >= cautionThresh) {
    riskLevel = 'CAUTION';
    workRestRatio = '50% Work / 50% Rest (30m work / 30m rest)';
    workMinutesPerHour = 30;
    restMinutesPerHour = 30;
    color = '#F59E0B'; // Amber
    badgeText = 'Elevated Heat Risk';
    actionSummary = 'Implement 30-min work/rest cycles under shade. Enforce hydration logging.';
  }

  // Hydration calculation: 500mL base + sweat loss adjustment
  const hourlyHydrationMl = Math.min(
    1400,
    Math.max(500, Math.round(500 + 150 * Math.max(0, wbgt - 25) * (limit.watts / 300)))
  );

  return {
    wbgt,
    workIntensity,
    riskLevel,
    color,
    badgeText,
    actionSummary,
    workRestRatio,
    workMinutesPerHour,
    restMinutesPerHour,
    hourlyHydrationMl,
    glassesPerHour: Math.ceil(hourlyHydrationMl / 250),
    thresholds: {
      caution: cautionThresh,
      high: highThresh,
      extreme: extremeThresh,
    },
  };
}

/**
 * Calculates Person-Hours of Dangerous Heat Exposure Averted
 */
export function calculateExposureAverted(workerCount, hoursInSpike, baselineWorkRatio, optimizedWorkRatio) {
  // Baseline exposure vs protected exposure
  const baselineExposure = workerCount * hoursInSpike * (baselineWorkRatio / 60);
  const protectedExposure = workerCount * hoursInSpike * (optimizedWorkRatio / 60);
  const avertedHours = Math.max(0, Math.round((baselineExposure - protectedExposure) * 10) / 10);
  return avertedHours;
}
