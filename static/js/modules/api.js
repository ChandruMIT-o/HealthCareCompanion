// Fetches the last 100 data points for initial load
export async function fetchInitialData() {
	const response = await fetch("/get_historical_data");
	if (!response.ok) throw new Error("Failed to fetch initial data");
	return await response.json();
}

// Fetches the single latest data packet
export async function fetchLiveData() {
	const response = await fetch("/get_data");
	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	return await response.json();
}

// Fetches a specific historical range
export async function loadHistoricalRange(start, end) {
	const response = await fetch(
		`/get_historical_data?start=${start}&end=${end}`
	);
	if (!response.ok) throw new Error("Failed to fetch historical data");
	return await response.json();
}

// Toggles the logging state on the server
export async function toggleLogging(connectState) {
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
