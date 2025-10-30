// Import all modules and components
import * as api from "./modules/api.js";
import * as ui from "./modules/uiManager.js";

// Import all your plot classes
import { HrPlot } from "./components/HrPlot.js";
import { IbiPlot } from "./components/IbiPlot.js";
import { Spo2Plot } from "./components/Spo2Plot.js";
import { SkinTempPlot } from "./components/SkinTempPlot.js";
import { EdaPlot } from "./components/EdaPlot.js";
import { EcgPlot } from "./components/EcgPlot.js";
import { BvpPlot } from "./components/BvpPlot.js";
import { PpgGreenPlot } from "./components/PpgGreenPlot.js";
import { PpgRedPlot } from "./components/PpgRedPlot.js";
import { PpgIrPlot } from "./components/PpgIrPlot.js";
import { AccXPlot } from "./components/AccXPlot.js";
import { AccYPlot } from "./components/AccYPlot.js";
import { AccZPlot } from "./components/AccZPlot.js";
import { RespirationRatePlot } from "./components/RespirationRatePlot.js";

// --- Global State ---
let isConnected = false;
let dataInterval = null;
let allPlots = {};
const CHART_FEATURES = [
	"hr",
	"ibi",
	"spo2",
	"skinTemp",
	"eda",
	"ecg",
	"bvp",
	"ppgGreen",
	"ppgRed",
	"ppgIr",
	"accX",
	"accY",
	"accZ",
	"respirationRate",
];

// --- Initialization ---
window.addEventListener("load", () => {
	// Call the init function *first* to populate ui.dom
	ui.initUIManager();

	// 1. Initialize all plot objects
	try {
		allPlots = {
			hr: new HrPlot(),
			ibi: new IbiPlot(),
			spo2: new Spo2Plot(),
			skinTemp: new SkinTempPlot(),
			eda: new EdaPlot(),
			ecg: new EcgPlot(),
			bvp: new BvpPlot(),
			ppgGreen: new PpgGreenPlot(),
			ppgRed: new PpgRedPlot(),
			ppgIr: new PpgIrPlot(),
			accX: new AccXPlot(),
			accY: new AccYPlot(),
			accZ: new AccZPlot(),
			respirationRate: new RespirationRatePlot(),
		};
	} catch (error) {
		console.error(
			"Fatal Error: Could not initialize charts. Is Chart.js loaded?",
			error
		);
		if (ui && ui.updateSyncStatus) {
			ui.updateSyncStatus("Error: Failed to load charts.", "error");
		}
		return; // Stop if charts can't be made
	}

	// 2. Attach main event listeners
	if (ui.dom.connectBtn) {
		ui.dom.connectBtn.addEventListener("click", handleConnectionToggle);
	} else {
		console.error("Fatal Error: connectBtn not found in DOM.");
		return;
	}

	if (ui.dom.loadHistoryBtn) {
		ui.dom.loadHistoryBtn.addEventListener("click", loadHistoricalData);
	}

	if (ui.dom.goLiveBtn) {
		ui.dom.goLiveBtn.addEventListener("click", startLiveMode);
	}
});

// --- Connection Management ---

function handleConnectionToggle() {
	if (isConnected) {
		stopLiveMode();
	} else {
		startLiveMode();
	}
}

async function startLiveMode() {
	if (isConnected) return;

	ui.dom.connectBtn.disabled = true;
	ui.dom.connectBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Connecting...</span>`;
	ui.updateSyncStatus("Fetching initial data (last 100 points)...");

	try {
		const initialData = await api.fetchInitialData();

		loadDataIntoUI(initialData, "Live Data (Last 100 Points)");

		isConnected = true;
		api.toggleLogging(true);

		// Update UI to "Connected" state
		ui.dom.connectBtn.disabled = false;
		ui.dom.connectBtn.innerHTML = `<i class="fas fa-check-circle text-green-500"></i> <span>Connected</span>`;
		ui.dom.connectBtn.classList.add("bg-green-100");
		ui.dom.initialMessage.classList.add("hidden");
		ui.dom.dataDisplayArea.classList.remove("hidden");
		ui.dom.dateRangeSelector.classList.remove("hidden");
		ui.dom.goLiveBtn.classList.add("hidden");
		ui.updateSyncStatus("Connection established. Starting live poll...");

		if (dataInterval) clearInterval(dataInterval);
		// Set to 5 seconds
		dataInterval = setInterval(pollLiveData, 5000);
	} catch (error) {
		console.error("Failed to connect:", error);
		ui.updateSyncStatus(`Connection failed: ${error.message}`, "error");
		ui.dom.connectBtn.disabled = false;
		ui.dom.connectBtn.innerHTML = `<i class="fas fa-satellite-dish text-blue-500"></i> <span>Connect to Device</span>`;
	}
}

function stopLiveMode() {
	if (!isConnected) return;
	isConnected = false;
	if (dataInterval) clearInterval(dataInterval);
	dataInterval = null;
	api.toggleLogging(false);

	// Reset UI to "Disconnected" state
	ui.dom.connectBtn.innerHTML = `<i class="fas fa-satellite-dish text-blue-500"></i> <span>Connect to Device</span>`;
	ui.dom.connectBtn.classList.remove("bg-green-100");
	ui.dom.dataDisplayArea.classList.add("hidden");
	ui.dom.dateRangeSelector.classList.add("hidden");
	ui.dom.initialMessage.classList.remove("hidden");
	if (ui.dom.syncStatusEl) {
		ui.dom.syncStatusEl.classList.add("hidden");
	}

	// Reset all plots
	for (const key of CHART_FEATURES) {
		if (allPlots[key]) {
			allPlots[key].reset();
		}
	}
}

// --- Data Fetching and UI Updating ---

async function pollLiveData() {
	if (!isConnected) return;
	try {
		const data = await api.fetchLiveData();
		if (data.error) {
			ui.updateSyncStatus(data.error, "error");
			return;
		}

		if (data.synced === false) {
			ui.updateSyncStatus(
				`Waiting for new data. Last check: ${new Date(
					data.lastPollTime
				).toLocaleTimeString()}`,
				"warn"
			);
		} else {
			ui.updateSyncStatus(
				`Data synced. Last update: ${new Date(
					data.lastPollTime
				).toLocaleTimeString()}`,
				"info"
			);

			// Send new data to all UI components
			const gData = data.generatedData;
			for (const key of CHART_FEATURES) {
				if (allPlots[key] && gData[key] !== undefined) {
					allPlots[key].addPoint({
						x: gData.timestamp,
						y: gData[key],
					});
				}
			}
			ui.addSingleDataToTables(data);
		}
	} catch (error) {
		console.error("Could not fetch live data:", error);
		ui.updateSyncStatus("Live data poll failed.", "error");
	}
}

async function loadHistoricalData() {
	const start = ui.dom.startTimeEl.value
		? new Date(ui.dom.startTimeEl.value).getTime()
		: null;
	const end = ui.dom.endTimeEl.value
		? new Date(ui.dom.endTimeEl.value).getTime()
		: null;

	if (!start || !end) {
		ui.updateSyncStatus("Please select both a start and end time.", "warn");
		return;
	}

	if (dataInterval) clearInterval(dataInterval);
	dataInterval = null;
	ui.updateSyncStatus(`Loading historical data...`);

	try {
		const historicalData = await api.loadHistoricalRange(start, end);

		loadDataIntoUI(
			historicalData,
			`Historical Data (${historicalData.length} records)`
		);

		ui.updateSyncStatus(
			`Loaded ${historicalData.length} historical records.`
		);
		ui.dom.goLiveBtn.classList.remove("hidden");
	} catch (error) {
		console.error("Failed to load history:", error);
		ui.updateSyncStatus(
			`Failed to load history: ${error.message}`,
			"error"
		);
	}
}

// --- Helper function to load a batch of data ---
function loadDataIntoUI(records, title) {
	// 1. Update titles
	if (ui.dom.dataStreamTitle) {
		ui.dom.dataStreamTitle.textContent = `${title} (Last 10 shown)`;
	}
	if (ui.dom.plotSectionTitle) {
		ui.dom.plotSectionTitle.textContent = title;
	}

	// 2. Load data into all plots
	for (const key of CHART_FEATURES) {
		if (allPlots[key]) {
			// Ensure data exists, default to 0 if not present for a given record
			const plotData = records.map((r) => ({
				x: r.timestamp,
				y: r[key] !== undefined ? r[key] : 0,
			}));
			allPlots[key].loadHistory(plotData);
		}
	}

	// 3. Populate tables
	if (records.length > 0) {
		ui.populateInitialTables(records);
	}
}
