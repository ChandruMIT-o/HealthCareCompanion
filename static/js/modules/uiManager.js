// --- DOM Element References ---
// Start with an empty object.
// We will populate this object *after* the page loads.
export const dom = {};

const MAX_TRANSFORMED_ENTRIES = 10;
const MAX_SCORE_LOG_ENTRIES = 50;

// This function will be called by main.js *after* the page is loaded.
export function initUIManager() {
	// 1. Populate the dom object
	dom.connectBtn = document.getElementById("connect-btn");
	dom.dataDisplayArea = document.getElementById("data-display-area");
	dom.initialMessage = document.getElementById("initial-message");
	dom.rawDataHeader = document.getElementById("raw-data-header");
	dom.rawDataContent = document.getElementById("raw-data-content");
	dom.toggleIcon = document.getElementById("toggle-icon");
	dom.rawDataLog = document.getElementById("raw-data-log");
	dom.transformedDataBody = document.getElementById("transformed-data-body");
	dom.modelsGrid = document.getElementById("models-grid");
	dom.scoreLogBody = document.getElementById("score-log-body");
	dom.plotSectionHeader = document.getElementById("plot-section-header");
	dom.plotSectionContent = document.getElementById("plot-section-content");
	dom.plotToggleIcon = document.getElementById("plot-toggle-icon");
	dom.syncStatusEl = document.getElementById("sync-status");
	dom.dateRangeSelector = document.getElementById("date-range-selector");
	dom.startTimeEl = document.getElementById("start-time");
	dom.endTimeEl = document.getElementById("end-time");
	dom.loadHistoryBtn = document.getElementById("load-history-btn");
	dom.goLiveBtn = document.getElementById("go-live-btn");
	dom.dataStreamTitle = document.getElementById("data-stream-title");
	dom.plotSectionTitle = document.getElementById("plot-section-title");

	// 2. Attach Listeners for UI toggles
	if (dom.rawDataHeader) {
		dom.rawDataHeader.addEventListener("click", () =>
			toggleSection(dom.rawDataContent, dom.toggleIcon)
		);
	}
	if (dom.plotSectionHeader) {
		dom.plotSectionHeader.addEventListener("click", () =>
			toggleSection(dom.plotSectionContent, dom.plotToggleIcon)
		);
	}
}

function toggleSection(contentEl, iconEl) {
	if (!contentEl || !iconEl) return;
	const isCollapsed =
		contentEl.style.maxHeight && contentEl.style.maxHeight !== "0px";
	contentEl.style.maxHeight = isCollapsed
		? "0px"
		: contentEl.scrollHeight + "px";
	iconEl.classList.toggle("rotate-180", !isCollapsed);
}

// --- Public Functions ---

export function populateInitialTables(records) {
	if (!dom.transformedDataBody) return;
	dom.transformedDataBody.innerHTML = "";
	// Show most recent at the top
	const last10Records = records.slice(-MAX_TRANSFORMED_ENTRIES).reverse();
	last10Records.forEach((record) => {
		addTransformedRow(record, false); // Add to end (which is top)
	});
}

export function addSingleDataToTables(data) {
	const gData = data.generatedData;
	const modelScores = data.modelScores;
	const timestampLabel = new Date(gData.timestamp).toLocaleTimeString();

	// 1. Update Raw Data Log
	if (dom.rawDataLog) {
		dom.rawDataLog.textContent = JSON.stringify(gData, null, 2);
	}

	// 2. Add to transformed table
	addTransformedRow(gData, true); // Add to top

	// 3. Update Model Scores
	updateModelsGrid(modelScores);

	// 4. Update Score Log
	addScoreLogEntry(timestampLabel, modelScores);
}

export function updateSyncStatus(text, level = "info") {
	if (!dom.syncStatusEl) return;
	dom.syncStatusEl.textContent = text;
	dom.syncStatusEl.classList.remove(
		"text-red-500",
		"text-yellow-500",
		"hidden"
	);
	if (level === "error") dom.syncStatusEl.classList.add("text-red-500");
	if (level === "warn") dom.syncStatusEl.classList.add("text-yellow-500");
}

// --- Private Helper Functions ---

function addTransformedRow(gData, prepend = true) {
	if (!dom.transformedDataBody) return;
	const newRow = document.createElement("tr");
	newRow.className = "border-b hover:bg-slate-50";
	newRow.innerHTML = createTableRowHTML(gData);

	if (prepend) {
		dom.transformedDataBody.prepend(newRow);
		if (dom.transformedDataBody.rows.length > MAX_TRANSFORMED_ENTRIES) {
			dom.transformedDataBody.deleteRow(-1);
		}
	} else {
		dom.transformedDataBody.appendChild(newRow);
	}
}

function createTableRowHTML(gData) {
	const timestamp = new Date(gData.timestamp).toLocaleTimeString();
	// Helper to safely format numbers, defaulting to 'N/A'
	const f = (val, digits) =>
		val === undefined || val === null ? "N/A" : val.toFixed(digits);

	return `
        <td class="p-2 text-sm whitespace-nowrap sticky left-0 bg-white hover:bg-slate-50">${timestamp}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.hr, 1)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.ibi, 0)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.spo2, 2)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.skinTemp, 2)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.eda, 4)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.ecg, 4)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.bvp, 4)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.ppgGreen, 0)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.ppgRed, 0)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.ppgIr, 0)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(
			gData.respirationRate,
			2
		)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.accX, 4)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.accY, 4)}</td>
        <td class="p-2 text-sm whitespace-nowrap">${f(gData.accZ, 4)}</td>
    `;
}

function updateModelsGrid(scores) {
	const scoreConfig = {
		SleepQualityIndex: { name: "Sleep Quality Index", icon: "fa-bed" },
		PsychosomaticStressIndex: {
			name: "Psychosomatic Stress",
			icon: "fa-brain",
		},
		CognitiveLoadScore: {
			name: "Cognitive Load",
			icon: "fa-head-side-virus",
		},
		CardiovascularHealthIndex: {
			name: "Cardiovascular Health",
			icon: "fa-heart-pulse",
		},
		EmotionalVitalityScore: {
			name: "Emotional Vitality",
			icon: "fa-smile-beam",
		},
	};

	let gridHTML = "";
	if (scores) {
		for (const key in scores) {
			const score = scores[key];
			const config = scoreConfig[key] || {
				name: key,
				icon: "fa-question-circle",
			};
			const colorClass =
				score > 70
					? "text-green-500"
					: score > 50
					? "text-yellow-500"
					: "text-red-500";
			gridHTML += `
                <div class="bg-white p-5 rounded-xl shadow-lg flex items-start gap-4">
                    <div class="bg-blue-100 text-blue-600 p-3 rounded-lg text-xl"><i class="fas ${
						config.icon
					}"></i></div>
                    <div>
                        <h3 class="font-semibold text-slate-600">${
							config.name
						}</h3>
                        <p class="text-3xl font-bold ${colorClass}">${score.toFixed(
				2
			)}</p>
                    </div>
                </div>`;
		}
	}
	if (dom.modelsGrid) {
		dom.modelsGrid.innerHTML = gridHTML;
	}
}

function addScoreLogEntry(timestamp, scores) {
	if (!dom.scoreLogBody || !scores) return;
	const newRow = document.createElement("tr");
	newRow.className = "border-b hover:bg-slate-50";
	newRow.innerHTML = `
        <td class="p-3 text-sm">${timestamp}</td>
        <td class="p-3">${scores.SleepQualityIndex.toFixed(2)}</td>
        <td class="p-3">${scores.PsychosomaticStressIndex.toFixed(2)}</td>
        <td class="p-3">${scores.CognitiveLoadScore.toFixed(2)}</td>
        <td class="p-3">${scores.CardiovascularHealthIndex.toFixed(2)}</td>
        <td class="p-3">${scores.EmotionalVitalityScore.toFixed(2)}</td>
    `;
	dom.scoreLogBody.prepend(newRow);
	if (dom.scoreLogBody.rows.length > MAX_SCORE_LOG_ENTRIES) {
		dom.scoreLogBody.deleteRow(-1);
	}
}
