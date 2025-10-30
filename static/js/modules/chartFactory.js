// Creates the standard, reusable options for all time-series charts
export function createBaseChartConfig() {
	const GAP_THRESHOLD_MS = 5000;

	return {
		type: "line",
		data: {
			datasets: [
				{
					data: [], // Data will be {x: timestamp, y: value}
					borderColor: "rgb(59, 130, 246)",
					borderWidth: 2,
					pointRadius: 0,
					tension: 0.1,
					segment: {
						borderColor: (ctx) => {
							// p0 is the previous point, p1 is the current point
							if (!ctx.p0 || !ctx.p1) return undefined;
							const timeDiff = ctx.p1.x - ctx.p0.x;
							// If gap > 5 seconds, draw in red
							if (timeDiff > GAP_THRESHOLD_MS) {
								return "rgb(239, 68, 68)"; // Tailwind red-500
							}
							return undefined; // 'undefined' uses default blue
						},
					},
				},
			],
		},
		options: {
			animation: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					mode: "index",
					intersect: false,
				},
			},
			scales: {
				x: {
					type: "time",
					time: {
						unit: "second",
						tooltipFormat: "HH:mm:ss",
						displayFormats: {
							second: "HH:mm:ss",
						},
					},
					ticks: {
						autoSkip: true,
						maxTicksLimit: 7, // Show ~7 timestamps
						maxRotation: 0,
					},
				},
				y: {
					beginAtZero: false,
					ticks: { maxTicksLimit: 5 },
				},
			},
			maintainAspectRatio: false,
			responsive: true,
		},
	};
}
