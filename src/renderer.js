import "./index.css";
import "animate.css";
import Chart from "chart.js/auto";

// Imports des vues
import homeHtml from "./views/home.html?raw";
import chartHtml from "./views/chart.html?raw";
import transactionsHtml from "./views/transactions.html?raw";

const appContainer = document.getElementById("app");
let currentChart = null;

// Router
document
	.getElementById("btn-home")
	.addEventListener("click", () => navigate(homeHtml, "home"));
document
	.getElementById("btn-transactions")
	.addEventListener("click", () => navigate(transactionsHtml, "transactions"));
document
	.getElementById("btn-chart")
	.addEventListener("click", () => navigate(chartHtml, "chart"));

// Charger l'accueil par défaut au lancement
navigate(homeHtml, "home");

/**
 * Fonction de navigation améliorée
 */
function navigate(content, viewName) {
	appContainer.innerHTML = `<div class="animate__animated animate__fadeIn">${content}</div>`;

	if (viewName === "home") {
		initHomeLogic();
	} else if (viewName === "transactions") {
		initTransactionsLogic();
	} else if (viewName === "chart") {
		initCharts();
	}
}

/**
 * Logique de la page d'accueil (Formulaire + Historique)
 */
function initHomeLogic() {
	const form = document.getElementById("finance-form");
	const dateInput = document.getElementById("date-transaction");
	if (!form) return;

	// --- Initialiser l'input date sur "Aujourd'hui" ---
	const now = new Date();
	// Format YYYY-MM-DD requis pour l'input date
	dateInput.value = now.toISOString().split("T")[0];

	updateTotal();
	updateHistory();

	const dateElement = document.getElementById("date-du-jour");
	if (dateElement) {
		const today = new Date();
		const jour = String(today.getDate()).padStart(2, "0");
		const mois = String(today.getMonth() + 1).padStart(2, "0");
		const annee = today.getFullYear();
		dateElement.innerText = `${jour}/${mois}/${annee}`;
	}

	form.addEventListener("submit", async (e) => {
		e.preventDefault();

		const montantInput = document.getElementById("montant").value;
		const type = document.querySelector(
			'input[name="type_transaction"]:checked',
		).value;
		const selectedDate = document.getElementById("date-transaction").value;

		let montant = parseFloat(montantInput);
		if (type === "depense") {
			montant = -Math.abs(montant);
		}

		// On crée la date à partir de l'input
		// On ajoute l'heure actuelle pour garder un tri chronologique précis
		const finalDate = new Date(selectedDate);
		const currentTime = new Date();
		finalDate.setHours(currentTime.getHours(), currentTime.getMinutes());

		const nouvelleTransaction = {
			id: Date.now(),
			date: finalDate.toISOString(),
			montant: montant,
			type: type,
		};

		try {
			const transactionsExistantes =
				(await window.db.get("transactions")) || [];
			transactionsExistantes.push(nouvelleTransaction);
			// On trie par date avant de sauvegarder pour que les stats soient toujours justes
			transactionsExistantes.sort(
				(a, b) => new Date(a.date) - new Date(b.date),
			);

			await window.db.save("transactions", transactionsExistantes);

			// ... (le reste de ton code de succès : message, reset, etc.)
			form.reset();
			dateInput.value = new Date().toISOString().split("T")[0]; // Reset la date aussi
			updateHistory();
			updateTotal();
		} catch (error) {
			console.error(error);
		}
	});
}

/**
 * Fonction pour charger et afficher les dernières transactions
 */
async function updateHistory() {
	const list = document.getElementById("history-list");
	if (!list) return;

	const transactions = (await window.db.get("transactions")) || [];

	if (transactions.length === 0) {
		list.innerHTML =
			'<li style="text-align: center; color: var(--text-dim);">Aucune transaction pour le moment.</li>';
		return;
	}

	const recentTransactions = transactions.slice(-10).reverse();

	list.innerHTML = recentTransactions
		.map((t) => {
			const isGain = t.type === "gain";
			const sign = isGain ? "+" : "";
			const colorClass = isGain ? "gain" : "depense";

			const dateObj = new Date(t.date);
			const jour = String(dateObj.getDate()).padStart(2, "0");
			const mois = String(dateObj.getMonth() + 1).padStart(2, "0");
			const annee = dateObj.getFullYear();
			const heures = String(dateObj.getHours()).padStart(2, "0");
			const minutes = String(dateObj.getMinutes()).padStart(2, "0");

			const dateStr = `${jour}/${mois}/${annee} - ${heures}:${minutes}`;

			// NOUVEAU : On ajoute le bouton avec l'ID de la transaction caché dans 'data-id'
			return `
            <li class="history-item ${colorClass}">
                <span class="history-date">${dateStr}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="history-amount" style="color: ${isGain ? "#2ecc71" : "#e74c3c"}">
                        ${sign}${t.montant} FCFA
                    </span>
                    <button class="btn-delete" data-id="${t.id}" title="Supprimer">✖</button>
                </div>
            </li>
        `;
		})
		.join("");

	// --- LOGIQUE DE SUPPRESSION ---
	// On récupère tous les nouveaux boutons poubelle qu'on vient de créer
	const deleteButtons = list.querySelectorAll(".btn-delete");

	deleteButtons.forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			// On récupère l'ID (qui est un nombre)
			const idToDelete = parseInt(e.target.getAttribute("data-id"));

			// On demande confirmation avant de supprimer
			if (confirm("Es-tu sûr de vouloir supprimer cette transaction ?")) {
				const allTransactions = (await window.db.get("transactions")) || [];

				// On garde toutes les transactions SAUF celle qui a cet ID
				const filteredTransactions = allTransactions.filter(
					(t) => t.id !== idToDelete,
				);

				// On sauvegarde la nouvelle liste
				await window.db.save("transactions", filteredTransactions);

				// On rafraîchit l'interface
				updateHistory();
				updateTotal();
			}
		});
	});
}

async function updateTotal() {
	const totalDisplay = document.getElementById("total-balance");
	if (!totalDisplay) return;

	const transactions = (await window.db.get("transactions")) || [];
	const total = transactions.reduce((acc, t) => acc + t.montant, 0);

	// Changement de couleur dynamique : rouge si négatif, bleu/vert si positif
	totalDisplay.style.color = total < 0 ? "#e74c3c" : "var(--accent-color)";
	totalDisplay.innerText = `${total.toLocaleString("fr-FR")} FCFA`;
}

function datetoday() {
	const today = new Date();
	const jour = String(today.getDate()).padStart(2, "0");
	const mois = String(today.getMonth() + 1).padStart(2, "0");
	const annee = today.getFullYear();
	return `${jour}/${mois}/${annee}`;
}

async function initTransactionsLogic() {
	const list = document.getElementById("all-transactions-list");
	const filterType = document.getElementById("filter-type");
	const filterStartDate = document.getElementById("filter-start-date");
	const filterEndDate = document.getElementById("filter-end-date");
	if (!list) return;

	const renderFilteredTransactions = async () => {
		const transactions = (await window.db.get("transactions")) || [];
		let filtered = [...transactions].reverse();

		// Filtre Type
		if (filterType && filterType.value !== "all") {
			filtered = filtered.filter((t) => t.type === filterType.value);
		}

		// Filtre Date de Début
		if (filterStartDate && filterStartDate.value) {
			const start = new Date(filterStartDate.value);
			start.setHours(0, 0, 0, 0); // On commence au début de la journée
			filtered = filtered.filter((t) => new Date(t.date) >= start);
		}

		// Filtre Date de Fin
		if (filterEndDate && filterEndDate.value) {
			const end = new Date(filterEndDate.value);
			end.setHours(23, 59, 59, 999); // On inclut toute la fin de la journée
			filtered = filtered.filter((t) => new Date(t.date) <= end);
		}

		if (filtered.length === 0) {
			list.innerHTML =
				'<li style="text-align: center; color: var(--text-dim);">Aucune transaction dans cette période.</li>';
			return;
		}

		list.innerHTML = filtered
			.map((t) => {
				const isGain = t.type === "gain";
				const colorClass = isGain ? "gain" : "depense";
				const sign = isGain ? "+" : "";
				const d = new Date(t.date);
				const jour = String(d.getDate()).padStart(2, "0");
				const mois = String(d.getMonth() + 1).padStart(2, "0");
				const annee = d.getFullYear();
				const heures = String(d.getHours()).padStart(2, "0");
				const minutes = String(d.getMinutes()).padStart(2, "0");

				return `
                <li class="history-item ${colorClass}">
                    <span class="history-date">${jour}/${mois}/${annee} - ${heures}:${minutes}</span>
                    <span class="history-amount" style="color: ${isGain ? "#2ecc71" : "#e74c3c"}">
                        ${sign}${t.montant} FCFA
                    </span>
                </li>
            `;
			})
			.join("");
	};

	if (filterType)
		filterType.addEventListener("change", renderFilteredTransactions);
	if (filterStartDate)
		filterStartDate.addEventListener("change", renderFilteredTransactions);
	if (filterEndDate)
		filterEndDate.addEventListener("change", renderFilteredTransactions);

	renderFilteredTransactions();
}

// LA NOUVELLE FONCTION (à remplacer en bas) :
async function initCharts() {
	const ctx = document.getElementById("myChart");
	const typeSelector = document.getElementById("chart-type");
	const dataSelector = document.getElementById("chart-data");
	const chartStartDate = document.getElementById("chart-start-date");
	const chartEndDate = document.getElementById("chart-end-date");
	if (!ctx) return;

	const renderChart = async () => {
		let transactions = (await window.db.get("transactions")) || [];
		const chartType = typeSelector.value;
		const dataType = dataSelector.value;

		// --- FILTRAGE PAR DATE POUR LE GRAPHIQUE ---
		if (chartStartDate && chartStartDate.value) {
			const start = new Date(chartStartDate.value);
			start.setHours(0, 0, 0, 0);
			transactions = transactions.filter((t) => new Date(t.date) >= start);
		}
		if (chartEndDate && chartEndDate.value) {
			const end = new Date(chartEndDate.value);
			end.setHours(23, 59, 59, 999);
			transactions = transactions.filter((t) => new Date(t.date) <= end);
		}

		if (currentChart) currentChart.destroy();

		let labels = [];
		let datasets = [];

		if (dataType === "monthly") {
			const monthlyData = {};
			transactions.forEach((t) => {
				const d = new Date(t.date);
				const month = d.toLocaleDateString("fr-FR", {
					month: "short",
					year: "numeric",
				});
				if (!monthlyData[month]) monthlyData[month] = { gains: 0, depenses: 0 };

				if (t.type === "gain") monthlyData[month].gains += t.montant;
				else monthlyData[month].depenses += Math.abs(t.montant);
			});

			labels = Object.keys(monthlyData);
			datasets = [
				{
					label: "Gains",
					data: labels.map((m) => monthlyData[m].gains),
					backgroundColor: "#2ecc71",
					borderRadius: 5,
				},
				{
					label: "Dépenses",
					data: labels.map((m) => monthlyData[m].depenses),
					backgroundColor: "#e74c3c",
					borderRadius: 5,
				},
			];
		} else if (dataType === "balance") {
			const sorted = [...transactions].sort((a, b) =>
				a.date.localeCompare(b.date),
			);
			let soldeCumulative = 0;
			const dataPoints = [];

			sorted.forEach((t) => {
				soldeCumulative += t.montant;
				const d = new Date(t.date);
				labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
				dataPoints.push(soldeCumulative);
			});

			datasets = [
				{
					label: "Solde cumulé (FCFA)",
					data: dataPoints,
					borderColor: "#00d2ff",
					backgroundColor: "rgba(0, 210, 255, 0.2)",
					fill: true,
					tension: 0.3,
					borderWidth: 2,
				},
			];
		} else if (dataType === "compare") {
			let totalGains = 0;
			let totalDepenses = 0;

			transactions.forEach((t) => {
				if (t.type === "gain") totalGains += t.montant;
				else totalDepenses += Math.abs(t.montant);
			});

			labels = ["Gains Totaux", "Dépenses Totales"];
			datasets = [
				{
					label: "Montant (FCFA)",
					data: [totalGains, totalDepenses],
					backgroundColor: [
						"rgba(46, 204, 113, 0.7)",
						"rgba(231, 76, 60, 0.7)",
					],
					borderColor: ["#2ecc71", "#e74c3c"],
					borderWidth: 1,
				},
			];
		}

		currentChart = new Chart(ctx, {
			type: chartType,
			data: { labels, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { labels: { color: "white", font: { weight: "bold" } } },
				},
				scales:
					chartType === "doughnut"
						? {}
						: {
								x: {
									ticks: { color: "rgba(255,255,255,0.7)" },
									grid: { display: false },
								},
								y: {
									ticks: { color: "rgba(255,255,255,0.7)" },
									grid: { color: "rgba(255,255,255,0.1)" },
									beginAtZero: true,
								},
							},
			},
		});
	};

	if (typeSelector) typeSelector.addEventListener("change", renderChart);
	if (dataSelector) dataSelector.addEventListener("change", renderChart);
	if (chartStartDate) chartStartDate.addEventListener("change", renderChart);
	if (chartEndDate) chartEndDate.addEventListener("change", renderChart);

	renderChart();
}
