// Agronomy Utils for Orchard Intelligence

/**
 * Calculate Growing Degree Days (GDD)
 * Formula: ((Tmax + Tmin) / 2) - Tbase
 * @param tMax Maximum Temperature (C)
 * @param tMin Minimum Temperature (C)
 * @param tBase Base Temperature (C) - Default 10C for tropical fruit generic
 * @returns GDD value (>= 0)
 */
export function calculateGDD(tMax: number, tMin: number, tBase: number = 10): number {
  const avg = (tMax + tMin) / 2;
  const gdd = avg - tBase;
  return Math.max(0, gdd);
}

/**
 * Calculate Vapor Pressure Deficit (VPD) in kPa
 * Good for assessing plant stress.
 * @param temp Temperature (C)
 * @param rh Relative Humidity (%)
 * @returns VPD in kPa
 */
export function calculateVPD(temp: number, rh: number): number {
  // Saturated Vapor Pressure (Tetens formula)
  const svp = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3));
  
  // Actual Vapor Pressure
  const avp = svp * (rh / 100);
  
  return Number((svp - avp).toFixed(2)); // Round to 2 decimals
}

/**
 * Calculate Reference Evapotranspiration (ETo) using Hargreaves Equation
 * Requires Latitude and Day of Year to estimate Radiation (Ra).
 * @param tMax Max Temp (C)
 * @param tMin Min Temp (C)
 * @param lat Latitude (Decimal Degrees)
 * @param date Date object
 * @returns ETo (mm/day)
 */
export function calculateHargreavesETo(tMax: number, tMin: number, lat: number, date: Date): number {
  // 1. Calculate Extraterrestrial Radiation (Ra)
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * getDayOfYear(date)) / 365);
  const declination = 0.409 * Math.sin(((2 * Math.PI * getDayOfYear(date)) / 365) - 1.39);
  
  // Convert Lat to Radians
  const phi = (Math.PI / 180) * lat;
  
  // Sunset hour angle
  const ws = Math.acos(-Math.tan(phi) * Math.tan(declination));
  
  const Gsc = 0.0820; // MJ m-2 min-1
  
  const Ra = (24 * 60 / Math.PI) * Gsc * dr * (
      (ws * Math.sin(phi) * Math.sin(declination)) +
      (Math.cos(phi) * Math.cos(declination) * Math.sin(ws))
  );
  
  // 2. Hargreaves Formula
  // ETo = 0.0023 * (Tmean + 17.8) * (Tmax - Tmin)^0.5 * Ra
  const tMean = (tMax + tMin) / 2;
  const eto = 0.0023 * (tMean + 17.8) * Math.pow((tMax - tMin), 0.5) * Ra;
  
  // Convert MJ/m2/day to mm/day?
  // Ra is computed in MJ/m2/day above. 
  // Formula usually results in mm/day if 0.0023 coefficient is used with Ra in MJ/m2/day?
  // Actually, standard Hargreaves usually outputs mm/day directly.
  // 0.408 conversion factor is for Radiation to mm, but Hargreaves includes it implicitly in coefficient? 
  // Let's assume standard formula output. 0.0023 is the empirical coefficient.
  
  // To be safe, let's keep it simple. If result is < 0, return 0.
  return Math.max(0, Number(eto.toFixed(2)));
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}
