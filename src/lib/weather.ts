import axios from 'axios';
import { WeatherStamp, WeatherAdvice, TmdHourlyResponse } from '../types/weather';

export class WeatherService {
  private apiKey: string;
  private host: string;

  constructor() {
    this.apiKey = process.env.TMD_API_KEY || '';
    this.host = process.env.TMD_API_HOST || 'https://data.tmd.go.th/nwpapi/v1';
  }

  /**
   * Fetch hourly forecast (Next 24-48h depends on API)
   * Note: This usually returns FORECAST from current time onwards.
   */
  async getHourlyForecast(lat: number, lon: number): Promise<WeatherStamp[]> {
    if (!this.apiKey) {
      console.warn('⚠️ TMD_API_KEY is missing. Returning empty weather data.');
      return [];
    }

    try {
      const endpoint = `${this.host}/forecast/location/hourly/at`;
      const duration = 24; // Fetch 24 hours

      const response = await axios.get<TmdHourlyResponse>(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'accept': 'application/json'
        },
        params: {
          lat: lat,
          lon: lon,
          duration: duration,
          fields: 'tc,rh,rain,ws10m' 
        },
        timeout: 10000 // 10s timeout
      });

      const rawData = response.data;

      if (!rawData.WeatherForecasts || rawData.WeatherForecasts.length === 0) {
        throw new Error('TMD API returned empty WeatherForecasts');
      }

      const forecasts = rawData.WeatherForecasts[0].forecasts;

      return forecasts.map(f => ({
        timestamp: f.time,
        temp_c: f.data.tc,
        humidity_percent: f.data.rh,
        rain_mm: f.data.rain,
        wind_speed_kmh: parseFloat((f.data.ws10m * 3.6).toFixed(1))
      }));

    } catch (error: any) {
      console.error(`❌ WeatherService Error: ${error.message}`);
      return [];
    }
  }

  /**
   * Find the weather stamp closest to the target time
   */
  findClosestStamp(stamps: WeatherStamp[], targetTime: Date): { stamp: WeatherStamp, index: number } | null {
    if (stamps.length === 0) return null;

    let closest = stamps[0];
    let minDiff = Infinity;
    let closestIndex = 0;

    const targetTs = targetTime.getTime();

    stamps.forEach((s, i) => {
      const stampTs = new Date(s.timestamp).getTime();
      const diff = Math.abs(stampTs - targetTs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = s;
        closestIndex = i;
      }
    });

    // Valid only if within 90 minutes drift (To avoid using very wrong time)
    if (minDiff > 90 * 60 * 1000) {
      return null;
    }

    return { stamp: closest, index: closestIndex };
  }

  /**
   * Generate advice based on weather context
   */
  generateAdvice(stamps: WeatherStamp[], startIndex: number): WeatherAdvice[] {
    const upcoming = stamps.slice(startIndex, startIndex + 4);
    if (upcoming.length === 0) return [];

    const advices: WeatherAdvice[] = [];

    // 1. Analyze Spraying (Everywhere)
    const sprayAdvice = this.analyzeSpraying(upcoming);
    // Only add if there is a warning or just always? 
    // Lab output showed everything. Let's show everything for now or filter "safe"?
    // User likes "Oracle Advice" which usually implies "Guidance". Safe is also guidance.
    advices.push(sprayAdvice);

    // 2. Analyze Pollination (Specific conditions)
    const pollAdvice = this.analyzePollination(upcoming);
    advices.push(pollAdvice);

    // 3. Analyze Fungal Risk (Biological Logic)
    // Use the first stamp (Current) for risk assessment
    if (upcoming.length > 0) {
      const current = upcoming[0];
      const fungusAdvice = this.analyzeFungalRisk(current);
      if (fungusAdvice) advices.push(fungusAdvice);

      const stressAdvice = this.analyzeStress(current);
      if (stressAdvice) advices.push(stressAdvice);
    }

    return advices;
  }

  /**
   * Calculate Dew Point using Magnus Formula
   * Td = (b * alpha) / (a - alpha)
   * alpha = (a * T) / (b + T) + ln(RH/100)
   * a = 17.27, b = 237.7
   */
  public calculateDewPoint(temp: number, humidity: number): number {
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100.0);
    const Td = (b * alpha) / (a - alpha);
    return parseFloat(Td.toFixed(1));
  }

  private analyzeFungalRisk(stamp: WeatherStamp): WeatherAdvice | null {
    const rh = stamp.humidity_percent;
    const dewPoint = this.calculateDewPoint(stamp.temp_c, stamp.humidity_percent);
    
    // Condition: High RH (>85%) or Dew Point close to Temp (< 1.5 diff) + Warm enough or Cool?
    // High Dew Point means a lot of moisture in air.
    // Spec: High RH (>85%) + High Dew Point -> Risk
    
    if (rh > 85) {
      // High humidity is the main driver
      return { 
        condition: '🍄 ความเสี่ยงเชื้อรา', 
        status: 'danger', 
        message: `⛔ ความเสี่ยงสูง: RH ${rh}%, Dew Point ${dewPoint}°C (งดน้ำ/ระวังรา)` 
      };
    }
    
    // Check for "Num Kang" (Heavy Dew) potential: High RH + Temp dropping near Dew Point
    if (rh > 80 && (stamp.temp_c - dewPoint) < 2) {
      return {
        condition: '🍄 ความเสี่ยงเชื้อรา',
        status: 'warning',
        message: `⚠️ น้ำค้างแรง: Temp ${stamp.temp_c}°C ใกล้ Dew Point ${dewPoint}°C`
      };
    }

    return null; // No advice if safe
  }

  private analyzeStress(stamp: WeatherStamp): WeatherAdvice | null {
    // Cold Stress for Durian < 22°C (Generic rule from experiences)
    if (stamp.temp_c < 22) {
      return {
        condition: '❄️ ความเครียดพืช',
        status: 'warning',
        message: `⚠️ อากาศเย็น (${stamp.temp_c}°C): เสริม Zinc/Seaweed กระตุ้นเอนไซม์`
      };
    }
    return null;
  }

  private analyzeSpraying(window: WeatherStamp[]): WeatherAdvice {
    const rainSum = window.reduce((sum, h) => sum + h.rain_mm, 0);
    const maxWind = Math.max(...window.map(h => h.wind_speed_kmh));

    if (rainSum > 0) return { condition: '🚜 การพ่นยา', status: 'danger', message: `⛔ ห้ามพ่น: ฝน ${rainSum.toFixed(1)} มม. ใน 4 ชม.` };
    if (maxWind > 15) return { condition: '🚜 การพ่นยา', status: 'warning', message: `⚠️ ระวัง: ลมแรง ${maxWind} km/h` };
    return { condition: '🚜 การพ่นยา', status: 'safe', message: '✅ เหมาะสม: ฟ้าเปิด ลมสงบ' };
  }

  private analyzePollination(window: WeatherStamp[]): WeatherAdvice {
    const rainSum = window.reduce((sum, h) => sum + h.rain_mm, 0);
    const avgHumid = window.reduce((sum, h) => sum + h.humidity_percent, 0) / window.length;

    if (rainSum > 0) return { condition: '🌸 การปัดดอก', status: 'danger', message: '⛔ ไม่ควรปัด: ฝนตก' };
    if (avgHumid > 90) return { condition: '🌸 การปัดดอก', status: 'warning', message: `⚠️ ความชื้นสูง (${avgHumid.toFixed(1)}%): ระวังเชื้อรา` };
    if (avgHumid < 45) return { condition: '🌸 การปัดดอก', status: 'warning', message: `⚠️ อากาศแห้ง (${avgHumid.toFixed(1)}%): ควรพรมน้ำ` };
    return { condition: '🌸 การปัดดอก', status: 'safe', message: `✅ เหมาะสม: ความชื้นพอดี (${avgHumid.toFixed(1)}%)` };
  }

  /**
   * Formatter for Markdown Output
   */
  formatMarkdown(location: string, stamp: WeatherStamp, advices: WeatherAdvice[], rainNext4h: number): string {
    return `
---
### 🌦️ Weather Stamp (Auto-Generated)
**Location**: ${location}
**Time**: ${stamp.timestamp}

| Temp | Humidity | Wind | Rain (4h) |
| :---: | :---: | :---: | :---: |
| **${stamp.temp_c}°C** | **${stamp.humidity_percent}%** | **${stamp.wind_speed_kmh} km/h** | **${rainNext4h.toFixed(1)} mm** |

**💡 Oracle Advice**:
${advices.map(a => `- ${a.message}`).join('\n')}
`;
  }
}
