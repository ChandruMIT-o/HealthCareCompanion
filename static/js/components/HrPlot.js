import { BasePlot } from "./BasePlot.js";

export class HrPlot extends BasePlot {
	constructor() {
		super("hr"); // 'hr' is the canvas ID suffix

		// Find the new stat elements
		this.statCurrent = document.getElementById("hr-stat-current");
		this.statMean = document.getElementById("hr-stat-mean");
		this.statMin = document.getElementById("hr-stat-min");
		this.statMax = document.getElementById("hr-stat-max");

		// --- NEW: Configuration for status bands ---
		// We'll define "Normal" as +/- 15% of the running average
		this.NORMAL_BAND_PERCENT = 0.15;

		// Define the colors we'll use
		this.colors = {
			default: "text-blue-600",
			normal: "text-green-600",
			high: "text-red-600",
			low: "text-yellow-600",
		};
		this.colorClasses = Object.values(this.colors);

		// Initialize local state for calculations
		this.allData = [];
	}

	/**
	 * Calculates statistics from the current data array
	 */
	calculateStats() {
		if (!this.allData.length) {
			return { mean: 0, min: 0, max: 0, current: 0, status: "---" };
		}

		const validData = this.allData.filter((val) => val > 0); // Ignore 0 values
		if (!validData.length) {
			return { mean: 0, min: 0, max: 0, current: 0, status: "---" };
		}

		const sum = validData.reduce((a, b) => a + b, 0);
		const mean = sum / validData.length;
		const min = Math.min(...validData);
		const max = Math.max(...validData);
		const current = this.allData[this.allData.length - 1];

		// --- NEW: Status Calculation ---
		let status = "---";
		if (mean > 0 && current > 0) {
			const upperBand = mean * (1 + this.NORMAL_BAND_PERCENT);
			const lowerBand = mean * (1 - this.NORMAL_BAND_PERCENT);

			if (current > upperBand) {
				status = "High";
			} else if (current < lowerBand) {
				status = "Low";
			} else {
				status = "Normal";
			}
		}

		return { mean, min, max, current, status };
	}

	/**
	 * Updates the stat elements in the DOM
	 */
	updateStatsUI() {
		const { mean, min, max, current, status } = this.calculateStats();

		// Check if elements exist before updating
		if (this.statCurrent) {
			// --- UPDATED: Set text content to include status ---
			this.statCurrent.textContent = `${current.toFixed(1)} [${status}]`;

			// --- NEW: Set color based on status ---
			this.statCurrent.classList.remove(...this.colorClasses);
			switch (status) {
				case "Normal":
					this.statCurrent.classList.add(this.colors.normal);
					break;
				case "High":
					this.statCurrent.classList.add(this.colors.high);
					break;
				case "Low":
					this.statCurrent.classList.add(this.colors.low);
					break;
				default:
					this.statCurrent.classList.add(this.colors.default);
			}
		}

		if (this.statMean) this.statMean.textContent = mean.toFixed(1);
		if (this.statMin) this.statMin.textContent = min.toFixed(1);
		if (this.statMax) this.statMax.textContent = max.toFixed(1);
	}

	/**
	 * Resets the UI to '---'
	 */
	resetStatsUI() {
		if (this.statCurrent) {
			this.statCurrent.textContent = "---";
			// Reset to default color
			this.statCurrent.classList.remove(...this.colorClasses);
			this.statCurrent.classList.add(this.colors.default);
		}
		if (this.statMean) this.statMean.textContent = "---";
		if (this.statMin) this.statMin.textContent = "---";
		if (this.statMax) this.statMax.textContent = "---";
	}

	// ----- OVERRIDE BASEPLOT METHODS -----

	/**
	 * Add a single new point.
	 * @param {{x: number, y: number}} point - The {x: timestamp, y: value} object
	 */
	addPoint(point) {
		// Call parent method to update the chart
		super.addPoint(point);

		// Update local state
		this.allData.push(point.y);

		// Keep local state in sync with chart data
		if (this.allData.length > 100) {
			// 100 matches MAX_CHART_POINTS
			this.allData.shift();
		}

		// Recalculate and update stats
		this.updateStatsUI();
	}

	/**
	 * Load a full array of historical data.
	 * @param {Array<{x: number, y: number}>} data - An array of {x, y} points
	 */
	loadHistory(data) {
		// Call parent method to update the chart
		super.loadHistory(data);

		// Reset and populate local state
		this.allData = data.map((point) => point.y);

		// Recalculate and update stats
		this.updateStatsUI();
	}

	/**
	 * Reset the chart and stats.
	 */
	reset() {
		// Call parent method to clear the chart
		super.reset();

		// Clear local state
		this.allData = [];

		// Reset stats UI
		this.resetStatsUI();
	}
}
