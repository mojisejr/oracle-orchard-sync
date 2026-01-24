// ============================================================================
// 🧠 ORCHARD CONDITION LOGIC (Phase 1 Logic - Complete)
// Mapped directly from: ψ/memory/learnings/orchard/synthesis/condition-tables.md
// ============================================================================

import { DailyForecast, WeatherInsight } from '../types/weather';

/**
 * 💧 Analyzer: Irrigation Strategy (Zone 1)
 */
export function analyzeIrrigation(day: DailyForecast): WeatherInsight | null {
  const { rh_percent: rh, tc_max: temp, swdown, rain_mm: rain, forecast_date, location_id } = day;
  
  // Note: 'wind' and 'cloud' are not yet in DailyForecast schema.
  // Using RH and SWDOWN as proxies.

  // Condition 1: High Transpiration (Dry/Windy)
  // Threshold: RH < 50%
  if (rh < 50) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'irrigation',
      status_level: 'critical',
      message: `💧 **เพิ่มน้ำ 20-30%** (RH ${rh}%) อากาศแห้งมาก ระวังใบไหม้ ต้องให้น้ำเสร็จก่อน 09:00 น.`,
      trigger_data: { rh, condition: 'High Transpiration' }
    };
  }

  // Condition 2: Extreme Heat (Heat Stress)
  // Threshold: Temp > 35°C AND SWDOWN > 600
  if (temp > 35 && swdown > 600) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'irrigation',
      status_level: 'warning',
      message: `☀️ **ให้น้ำลดอุณหภูมิ** (T_max ${temp}°C) แดดเปรี้ยงมาก พ่นฝอยช่วงบ่ายสั้นๆ ลดเครียด (ห้ามทำถ้าความชื้นสูง)`,
      trigger_data: { temp, swdown, condition: 'Heat Stress' }
    };
  }

  // Condition 3: Low Light (Cloudy)
  // Threshold: SWDOWN < 300 (Proxy for Cloud > 80%)
  if (swdown < 300) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'irrigation',
      status_level: 'optimal', // "Optimal" here means "Action required but condition is 'safe' from heat"
      message: `☁️ **ลดปริมาณน้ำลง 20%** (แสงน้อย ${swdown} W/m²) พืชกินน้ำน้อย ระวังรากแฉะ`,
      trigger_data: { swdown, condition: 'Low Light' }
    };
  }

  return null;
}

/**
 * 🟡 Analyzer: Physiology (Zone 2)
 */
export function analyzePhysiology(day: DailyForecast): WeatherInsight | null {
  const { swdown, rh_percent: rh, rain_mm: rain, tc_max: temp, forecast_date, location_id } = day;

  // Condition 1: Nutrient Lock (Ca/B)
  // Threshold: SWDOWN > 600 (High) AND RH < 50%
  if (swdown > 600 && rh < 50) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'physiology',
      status_level: 'warning',
      message: `🔒 **ธาตุอาหารไม่เคลื่อนที่** (แดดแรง/ชื้นต่ำ) แคลเซียมไปไม่ถึงลูก พ่นทางใบช่วยด่วน`,
      trigger_data: { swdown, rh, condition: 'Nutrient Lock' }
    };
  }

  // Condition 2: Drought Break (Rain Alert for Flowering)
  // Threshold: Rain > 5mm (Potential Stress Reset)
  if (rain > 5) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'physiology',
      status_level: 'critical',
      message: `🌧️ **เตือนภัยดอกฝัด!** (ฝน ${rain}mm) ความเครียดสะสมจะหายไป รีบพ่น 'สะสมอาหาร + Ca-B' ดักหน้าทันที`,
      trigger_data: { rain, condition: 'Drought Break' }
    };
  }

  // Condition 3: Ideal Induction (Good Stress)
  // Threshold: Rain = 0 AND Temp > 32
  if (rain === 0 && temp > 32) {
      return {
        location_id,
        target_date: forecast_date,
        category: 'physiology',
        status_level: 'optimal',
        message: `🌵 **สภาพอากาศเป็นใจเปิดตาดอก** (แล้ง/ร้อน) เอทิลีนทำงานดี เตรียมวางแผน 'โชยน้ำ'`,
        trigger_data: { rain, temp, condition: 'Ideal Induction' }
      };
  }

  return null;
}

/**
 * 🔴 Analyzer: Disease & Pest Watch (Zone 3)
 */
export function analyzeDisease(day: DailyForecast): WeatherInsight | null {
  const { rh_percent: rh, rain_mm: rain, forecast_date, location_id } = day;

  // Condition 1: Phytophthora Warning
  // Threshold: Rain > 10mm (Proxy for accumulated > 30mm) AND RH > 80%
  if (rain > 10 && rh > 80) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'disease',
      status_level: 'critical',
      message: `🍄 **ความเสี่ยงราสูง (วิกฤต)** (ฝน ${rain}mm / ชื้น ${rh}%) ตรวจโคนต้น/กิ่ง ถ้ามีกลิ่นเหม็นเปรี้ยวใช้ยา Tier S (Cymoxanil)`,
      trigger_data: { rain, rh, condition: 'Phytophthora Risk' }
    };
  }

  // Condition 2: High Humidity Night (Downy Mildew/Leaf Blight)
  // Threshold: RH > 90% (Proxy for RH_Night)
  if (rh > 90) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'disease', // Corrected category mismatch in previous thought
      status_level: 'warning',
      message: `🌫️ **ระวังโรคใบติด/ราน้ำค้าง** (ชื้น ${rh}%) พ่นยากลุ่มสัมผัส (Group M) ป้องกันไว้`,
      trigger_data: { rh, condition: 'High Humidity' }
    };
  }

  return null;
}

export function analyzePest(day: DailyForecast): WeatherInsight | null {
    const { rh_percent: rh, tc_max: temp, rain_mm: rain, forecast_date, location_id } = day;

    // Condition 1: Red Mite Boom
    // Threshold: Temp > 33 AND RH < 50 (Dry Heat)
    if (temp > 33 && rh < 50) {
        return {
            location_id,
            target_date: forecast_date,
            category: 'disease', // Pests fall under disease category in our schema ('disease' covers all biological threats)
            status_level: 'warning',
            message: `🕷️ **ระวังไรแดงระบาดหนัก** (ร้อน ${temp}°C / แห้ง ${rh}%) ห้ามใช้ยาฆ่าแมลงทั่วไป ให้ใช้ Acaricides และเปิดน้ำช่วยความชื้น`,
            trigger_data: { temp, rh, condition: 'Red Mite Boom' }
        };
    }

    // Condition 2: Thrips High Alert
    // Threshold: Rain = 0 (Dry)
    if (rain === 0) {
        return {
            location_id,
            target_date: forecast_date,
            category: 'disease',
            status_level: 'info',
            message: `🦟 **เพลี้ยไฟ** ระวังช่วงดอกบาน/ยอดอ่อน (ฝน 0mm) ให้สลับกลุ่มยาถี่ๆ ห้ามซ้ำเดิม`,
            trigger_data: { rain, condition: 'Thrips Alert' }
        };
    }

    return null;
}
