// ============================================================================
// 🧠 ORCHARD CONDITION LOGIC (Phase 2 Logic - Context Aware)
// Adapted for Snapshot: 2026-01-26_07-03_orchard-sage-physical-truth-integration-plan.md
// ============================================================================

import { DailyForecast, WeatherInsight } from '../types/weather';
import { PlotProfile } from './plot-mapper';

/**
 * 💧 Analyzer: Irrigation Strategy (Zone 1)
 */
export function analyzeIrrigation(day: DailyForecast, context?: PlotProfile): WeatherInsight | null {
  const { rh_percent: rh, tc_max: temp, swdown, rain_mm: rain, forecast_date, location_id } = day;
  
  // -- AWARENESS: Soil Weighting --
  // If Sandy, we are more sensitive to dry air.
  const isSandy = context?.soil === 'sandy';
  const rhThreshold = isSandy ? 60 : 50; // Critical RH threshold bumps up for Sandy soil
  
  // Condition 1: High Transpiration (Dry/Windy)
  if (rh < rhThreshold) {
    const severity = (isSandy && rh < 50) ? 'critical' : 'warning';
    const sandyNote = isSandy ? ' (ดินทรายแห้งไวมาก!)' : '';

    return {
      location_id,
      target_date: forecast_date,
      category: 'irrigation',
      status_level: severity, 
      message: `💧 **เพิ่มน้ำด่วน!** (RH ${rh}% < ${rhThreshold}%)${sandyNote} อากาศแห้ง${isSandy ? 'และดินไม่อุ้มน้ำ' : ''} ระวังใบไหม้/ดอกฝ่อ`,
      trigger_data: { rh, condition: 'High Transpiration', soil: context?.soil }
    };
  }

  // Condition 2: Extreme Heat (Heat Stress)
  if (temp > 35 && swdown > 600) {
    // -- AWARENESS: Stage Check --
    // If Bloom, we cannot let the flower burn
    const isBloom = context?.stage === 'bloom';
    const bloomWarning = isBloom ? ' [ระยะดอกบาน: ห้ามปล่อยให้ขาดน้ำ]' : '';

    return {
      location_id,
      target_date: forecast_date,
      category: 'irrigation',
      status_level: isBloom ? 'critical' : 'warning',
      message: `☀️ **ให้น้ำลดอุณหภูมิ** (T_max ${temp}°C) แดดเปรี้ยงมาก${bloomWarning} พ่นฝอยช่วงบ่ายสั้นๆ ลดเครียด`,
      trigger_data: { temp, swdown, condition: 'Heat Stress', stage: context?.stage }
    };
  }

  // Condition 3: Low Light (Cloudy)
  if (swdown < 300) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'irrigation',
      status_level: 'optimal',
      message: `☁️ **ลดปริมาณน้ำลง 20%** (แสงน้อย ${swdown} W/m²) พืชกินน้ำน้อย ระวังรากแฉะ`,
      trigger_data: { swdown, condition: 'Low Light' }
    };
  }

  return null;
}

/**
 * 🟡 Analyzer: Physiology (Zone 2)
 */
export function analyzePhysiology(day: DailyForecast, context?: PlotProfile): WeatherInsight | null {
  const { swdown, rh_percent: rh, rain_mm: rain, tc_max: temp, forecast_date, location_id } = day;

  // -- AWARENESS: Growth Stage --
  const stage = context?.stage || 'preparing_leaf';

  // Condition 1: Nutrient Lock (Ca/B)
  if (swdown > 600 && rh < 50) {
    // Critical for reproductive stages
    const isCriticalStage = stage === 'bloom' || stage === 'fruit_set';
    
    return {
      location_id,
      target_date: forecast_date,
      category: 'physiology',
      status_level: isCriticalStage ? 'critical' : 'warning',
      message: `🔒 **ธาตุอาหารไม่เคลื่อนที่** (แดดแรง/ชื้นต่ำ)${isCriticalStage ? ' [ระยะวิกฤต]' : ''} แคลเซียมไปไม่ถึงลูก พ่นทางใบช่วยด่วน`,
      trigger_data: { swdown, rh, condition: 'Nutrient Lock', stage }
    };
  }

  // Condition 2: Drought Break (Rain Alert)
  if (rain > 5) {
     const isBloom = stage === 'bloom';
     // If Bloom, rain is BAD for pollination
     if (isBloom) {
        return {
          location_id,
          target_date: forecast_date,
          category: 'physiology',
          status_level: 'critical',
          message: `🌧️ **เตือนภัยฝนชะดอก!** (ฝน ${rain}mm) ระวังเชื้อราเข้าดอกและเกสรฉ่ำน้ำ เน้นพ่นกันรา+Ca-B หลังฝนหยุด`,
          trigger_data: { rain, condition: 'Raun on Bloom', stage }
        };
     }
     
     // Normal Drought Break logic
     return {
      location_id,
      target_date: forecast_date,
      category: 'physiology',
      status_level: 'critical',
      message: `🌧️ **เตือนภัยใบอ่อน/ดอกฝัด!** (ฝน ${rain}mm) ความเครียดสะสมจะหายไป รีบพ่น 'สะสมอาหาร + Ca-B' ดักหน้าทันที`,
      trigger_data: { rain, condition: 'Drought Break' }
    };
  }

  // Condition 3: Induction vs Bloom
  // "Ideal Induction" logic should ONLY trigger if we are in 'induction' or 'preparing_leaf' stage.
  // If we are already in Bloom, dry/hot is risky, not "Optimal".
  
  if (rain === 0 && temp > 32) {
      if (stage === 'induction' || stage === 'preparing_leaf') {
        return {
            location_id,
            target_date: forecast_date,
            category: 'physiology',
            status_level: 'optimal',
            message: `🌵 **สภาพอากาศเป็นใจเปิดตาดอก** (แล้ง/ร้อน) เอทิลีนทำงานดี เตรียมวางแผน 'โชยน้ำ'`,
            trigger_data: { rain, temp, condition: 'Ideal Induction' }
        };
      } else if (stage === 'bloom') {
        // In bloom, hot/dry is dangerous for pollen
        return {
            location_id,
            target_date: forecast_date,
            category: 'physiology',
            status_level: 'warning',
            message: `🌡️ **ระวังดอกฝ่อ** (ร้อน ${temp}°C / ฝน 0) อากาศแห้งเกินไปสำหรับระยะดอกบาน ให้เลี้ยงน้ำสม่ำเสมอ`,
            trigger_data: { rain, temp, condition: 'Bloom Stress', stage }
        };
      }
  }

  return null;
}

/**
 * 🧪 Analyzer: Water Compatibility (Zone New)
 */
export function analyzeWaterCompatibility(context?: PlotProfile): WeatherInsight | null {
    if (!context) return null;

    if (context.water === 'high_manganese_iron') {
        // Simple advisory if needed
        return null; 
    }
    return null;
}

/**
 * 🐛 Analyzer: Pest & Disease (Zone 3 & 4)
 */
export function analyzeDisease(day: DailyForecast, context?: PlotProfile): WeatherInsight | null {
  const { rh_percent: rh, rain_mm: rain, forecast_date, location_id } = day;

  // Condition 1: Phytophthora Warning
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
  if (rh > 90) {
    return {
      location_id,
      target_date: forecast_date,
      category: 'disease', 
      status_level: 'warning',
      message: `🌫️ **ระวังโรคใบติด/ราน้ำค้าง** (ชื้น ${rh}%) พ่นยากลุ่มสัมผัส (Group M) ป้องกันไว้`,
      trigger_data: { rh, condition: 'High Humidity' }
    };
  }

  return null;
}

export function analyzePest(day: DailyForecast, context?: PlotProfile): WeatherInsight | null {
    const { rh_percent: rh, tc_max: temp, rain_mm: rain, forecast_date, location_id } = day;
    const stage = context?.stage;

    // Condition 1: Red Mite Boom
    if (temp > 33 && rh < 50) {
        return {
            location_id,
            target_date: forecast_date,
            category: 'disease', 
            status_level: 'warning',
            message: `🕷️ **ระวังไรแดงระบาดหนัก** (ร้อน ${temp}°C / แห้ง ${rh}%) ห้ามใช้ยาฆ่าแมลงทั่วไป ให้ใช้ Acaricides และเปิดน้ำช่วยความชื้น`,
            trigger_data: { temp, rh, condition: 'Red Mite Boom' }
        };
    }

    // Condition 2: Thrips High Alert
    if (rain === 0) {
        const sensitiveStage = stage === 'bloom' || stage === 'preparing_leaf';
        const msg = sensitiveStage 
            ? `🦟 **เพลี้ยไฟระบาดแน่** (แห้ง/แล้ง) [ระยะสำคัญ: ${stage}] ต้องคุมให้อยู่หมัด สลับยากลุ่ม 1/2/4/60`
            : `🦟 **เพลี้ยไฟ** ระวังช่วงดอกบาน/ยอดอ่อน (ฝน 0mm) ให้สลับกลุ่มยาถี่ๆ ห้ามซ้ำเดิม`;

        return {
            location_id,
            target_date: forecast_date,
            category: 'disease',
            status_level: sensitiveStage ? 'critical' : 'info',
            message: msg,
            trigger_data: { rain, condition: 'Thrips Alert', stage }
        };
    }

    return null;
}
