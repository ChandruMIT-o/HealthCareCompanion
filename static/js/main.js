document.addEventListener("DOMContentLoaded", () => {
	// --- DOM Element References ---
	const connectBtn = document.getElementById("connect-btn");
	const dataDisplayArea = document.getElementById("data-display-area");
	const initialMessage = document.getElementById("initial-message");
	const rawDataHeader = document.getElementById("raw-data-header");
	const rawDataContent = document.getElementById("raw-data-content");
	const toggleIcon = document.getElementById("toggle-icon");
	const rawDataLog = document.getElementById("raw-data-log");
	const transformedDataBody = document.getElementById(
		"transformed-data-body"
	);
	const modelsGrid = document.getElementById("models-grid");
	const scoreLogBody = document.getElementById("score-log-body");

	let isConnected = false;
	let dataInterval;
	const MAX_TRANSFORMED_ENTRIES = 10;
	const MAX_SCORE_LOG_ENTRIES = 50;

	// --- Event Listeners ---
	connectBtn.addEventListener("click", handleConnectionToggle);
	rawDataHeader.addEventListener("click", toggleRawDataSection);

	// --- Functions ---
	/**
	 * Toggles the connection state and starts/stops data fetching and logging.
	 */
	function handleConnectionToggle() {
		if (isConnected) {
			disconnect();
		} else {
			connect();
		}
	}

	/**
	 * Sends a request to the backend to start/stop logging.
	 * @param {boolean} connectState - True to start logging, false to stop.
	 */
	async function toggleLogging(connectState) {
		try {
			await fetch("/toggle_logging", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ connect: connectState }),
			});
		} catch (error) {
			console.error("Failed to toggle logging state:", error);
		}
	}

	/**
	 * Simulates connecting to the device.
	 */
	function connect() {
		connectBtn.disabled = true;
		connectBtn.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>Connecting...</span>`;

		setTimeout(() => {
			isConnected = true;
			toggleLogging(true);
			connectBtn.disabled = false;
			connectBtn.innerHTML = `
                <i class="fas fa-check-circle text-green-500"></i>
                <span>Connected</span>`;
			connectBtn.classList.add("bg-green-100");

			initialMessage.classList.add("hidden");
			dataDisplayArea.classList.remove("hidden");

			fetchData();
			dataInterval = setInterval(fetchData, 1000);
		}, 2000);
	}

	/**
	 * Disconnects from the device.
	 */
	function disconnect() {
		isConnected = false;
		clearInterval(dataInterval);
		toggleLogging(false);

		connectBtn.innerHTML = `
             <i class="fas fa-satellite-dish text-blue-500"></i>
             <span>Connect to Fitbit</span>`;
		connectBtn.classList.remove("bg-green-100");

		dataDisplayArea.classList.add("hidden");
		initialMessage.classList.remove("hidden");
	}

	/**
	 * Toggles the visibility of the raw data section.
	 */
	function toggleRawDataSection() {
		const isCollapsed =
			rawDataContent.style.maxHeight &&
			rawDataContent.style.maxHeight !== "0px";
		if (isCollapsed) {
			rawDataContent.style.maxHeight = "0px";
			toggleIcon.classList.remove("rotate-180");
		} else {
			rawDataContent.style.maxHeight = rawDataContent.scrollHeight + "px";
			toggleIcon.classList.add("rotate-180");
		}
	}

	/**
	 * Fetches data from the backend and updates the UI.
	 */
	async function fetchData() {
		if (!isConnected) return;
		try {
			const response = await fetch("/get_data");
			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			updateUIs(data);
		} catch (error) {
			console.error("Could not fetch data:", error);
			disconnect();
		}
	}

	/**
	 * Main function to call all UI update functions.
	 */
	function updateUIs(data) {
		const timestamp = new Date().toLocaleTimeString();
		updateRawDataLog(data.generatedData);
		updateTransformedDataTable(timestamp, data.generatedData);
		updateModelsGrid(data.modelScores);
		updateScoreLogTable(timestamp, data.modelScores);
	}

	function updateRawDataLog(gData) {
		rawDataLog.textContent = JSON.stringify(gData, null, 2);
	}

	function updateTransformedDataTable(timestamp, gData) {
		const newRow = document.createElement("tr");
		newRow.className = "border-b hover:bg-slate-50";
		// Dynamically create all table cells based on the feature list
		newRow.innerHTML = `
            <td class="p-2 text-sm whitespace-nowrap sticky left-0 bg-white hover:bg-slate-50">${timestamp}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.ECG.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.EDA.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.Temp.toFixed(
				2
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.Resp.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.EMG.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.ACC_x.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.ACC_y.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.ACC_z.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.ACC_mag.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.BVP.toFixed(
				4
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.HR.toFixed(
				1
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.IBI.toFixed(
				3
			)}</td>
            <td class="p-2 text-sm whitespace-nowrap">${gData.Resp_rate.toFixed(
				2
			)}</td>
        `;
		transformedDataBody.prepend(newRow);
		if (transformedDataBody.rows.length > MAX_TRANSFORMED_ENTRIES) {
			transformedDataBody.deleteRow(-1);
		}
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
                    <div class="bg-blue-100 text-blue-600 p-3 rounded-lg text-xl">
                        <i class="fas ${config.icon}"></i>
                    </div>
                    <div>
                        <h3 class="font-semibold text-slate-600">${
							config.name
						}</h3>
                        <p class="text-3xl font-bold ${colorClass}">${score.toFixed(
				2
			)}</p>
                    </div>
                </div>
            `;
		}
		modelsGrid.innerHTML = gridHTML;
	}

	function updateScoreLogTable(timestamp, scores) {
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
		scoreLogBody.prepend(newRow);
		if (scoreLogBody.rows.length > MAX_SCORE_LOG_ENTRIES) {
			scoreLogBody.deleteRow(-1);
		}
	}
});
