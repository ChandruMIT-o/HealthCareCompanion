// --- Module-level variables ---
let rawDataLogEl;
let modelsGridEl;
let scoreLogBodyEl;

const MAX_SCORE_LOG_ENTRIES = 50;

/**
 * Finds and stores the DOM elements this module controls.
 */
export function initInfoWidgets() {
	rawDataLogEl = document.getElementById("raw-data-log");
	modelsGridEl = document.getElementById("models-grid");
	scoreLogBodyEl = document.getElementById("score-log-body");
}

/**
 * Resets all widgets to their default "empty" state.
 */
export function resetAllWidgets() {
	if (rawDataLogEl) rawDataLogEl.textContent = "";
	if (modelsGridEl) modelsGridEl.innerHTML = "";
	if (scoreLogBodyEl) scoreLogBodyEl.innerHTML = "";
}

/**
 * Updates the raw data <pre> block.
 * @param {object} gData - The generatedData object
 */
export function updateRawDataLog(gData) {
	if (rawDataLogEl) {
		rawDataLogEl.textContent = JSON.stringify(gData, null, 2);
	}
}

/**
 * Re-draws the 5 model score cards.
 * @param {object} scores - The modelScores object
 */
export function updateModelsGrid(scores) {
	if (!modelsGridEl) return;

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
	for (const key in scores) {
		const score = scores[key];
		const config = scoreConfig[key];
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
                    <h3 class="font-semibold text-slate-600">${config.name}</h3>
                    <p class="text-3xl font-bold ${colorClass}">${score.toFixed(
			2
		)}</p>
                </div>
            </div>`;
	}
	modelsGridEl.innerHTML = gridHTML;
}

/**
 * Adds a new row to the score log table.
 * @param {number} timestamp - The timestamp of the data point
 * @param {object} scores - The modelScores object
 */
export function addScoreLogEntry(timestamp, scores) {
	if (!scoreLogBodyEl) return;

	const timeLabel = new Date(timestamp).toLocaleTimeString();
	const newRow = document.createElement("tr");
	newRow.className = "border-b hover:bg-slate-50";
	newRow.innerHTML = `
        <td class="p-3 text-sm">${timeLabel}</td>
        <td class="p-3">${scores.SleepQualityIndex.toFixed(2)}</td>
        <td class="p-3">${scores.PsychosomaticStressIndex.toFixed(2)}</td>
        <td class="p-3">${scores.CognitiveLoadScore.toFixed(2)}</td>
        <td class="p-3">${scores.CardiovascularHealthIndex.toFixed(2)}</td>
        <td class="p-3">${scores.EmotionalVitalityScore.toFixed(2)}</td>
    `;
	scoreLogBodyEl.prepend(newRow);
	if (scoreLogBodyEl.rows.length > MAX_SCORE_LOG_ENTRIES) {
		scoreLogBodyEl.deleteRow(-1);
	}
}
