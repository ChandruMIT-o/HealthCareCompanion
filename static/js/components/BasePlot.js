
import { createBaseChartConfig } from '../modules/chartFactory.js';

const MAX_CHART_POINTS = 100;

export class BasePlot {
    constructor(featureId) {
        const canvas = document.getElementById(`${featureId}-chart`);
        // This stops the script from crashing if the canvas is missing
        if (!canvas) {
            console.error(`Canvas element with ID '${featureId}-chart' not found.`);
            // Set a flag so other methods know this plot is invalid
            this.chart = null; 
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const config = createBaseChartConfig();
        this.chart = new Chart(ctx, config);
        this.featureId = featureId;
    }

    // Adds a single {x, y} point
    addPoint(point) {
        if (!this.chart) return; // Don't do anything if chart failed to init
        this.chart.data.datasets[0].data.push(point);
        if (this.chart.data.datasets[0].data.length > MAX_CHART_POINTS) {
            this.chart.data.datasets[0].data.shift();
        }
        this.chart.update('none');
    }

    // Loads a full array of {x, y} points
    loadHistory(data) {
        if (!this.chart) return; // Don't do anything if chart failed to init
        this.chart.data.datasets[0].data = data;
        this.chart.update('none');
    }

    // Clears the chart
    reset() {
        if (!this.chart) return; // Don't do anything if chart failed to init
        this.chart.data.datasets[0].data = [];
        this.chart.update('none');
    }
}
