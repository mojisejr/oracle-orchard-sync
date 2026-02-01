import { HeadlessManifest } from '../types/visual-manifest';

const testManifest: HeadlessManifest = {
    summary: "Flood Warning",
    theme: "emergency-red",
    layout: "minimal-alert",
    meta: {
        generated_at: new Date().toISOString(),
        horizon_days: 3,
        version: "1.0"
    },
    visual_manifest: [
        {
            type: "METRIC_CARD",
            id: "rain_main",
            props: {
                label: "Rainfall",
                value: "120",
                unit: "mm",
                status: "danger"
            }
        },
        {
            type: "CHART",
            id: "rain_chart",
            colSpan: 2,
            props: {
                title: "Precipitation Trend",
                chartType: "bar",
                data: {
                    labels: ["Mon", "Tue", "Wed"],
                    datasets: [
                        {
                            label: "Rain (mm)",
                            data: [10, 50, 120],
                            color: "#ef4444"
                        }
                    ]
                }
            }
        }
    ]
};

console.log("Manifest Type Check Passed:", JSON.stringify(testManifest, null, 2));
