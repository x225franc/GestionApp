import "./index.css";
import "animate.css";
import Chart from "chart.js/auto";
import zoomPlugin from 'chartjs-plugin-zoom';

// Imports des vues
import homeHtml from "./views/home.html?raw";
import chartHtml from "./views/chart.html?raw";
import transactionsHtml from "./views/transactions.html?raw";

const appContainer = document.getElementById("app");
let currentChart = null;

Chart.register(zoomPlugin);

function getLocalTodayString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return (new Date(now - offset)).toISOString().split("T")[0];
}

// Router
document.getElementById("btn-home").addEventListener("click", () => navigate(homeHtml, "home"));
document.getElementById("btn-transactions").addEventListener("click", () => navigate(transactionsHtml, "transactions"));
document.getElementById("btn-chart").addEventListener("click", () => navigate(chartHtml, "chart"));

navigate(homeHtml, "home");

function navigate(content, viewName) {
    appContainer.innerHTML = `<div class="animate__animated animate__fadeIn">${content}</div>`;
    if (viewName === "home") initHomeLogic();
    else if (viewName === "transactions") initTransactionsLogic();
    else if (viewName === "chart") initCharts();
}

/** * LOGIQUE HOME 
 */
function initHomeLogic() {
    const form = document.getElementById("finance-form");
    const dateInput = document.getElementById("date-transaction");
    if (!form) return;

    const todayString = getLocalTodayString();
    dateInput.value = todayString;
    dateInput.max = todayString;

    updateTotal();
    updateHistory();

    const dateElement = document.getElementById("date-du-jour");
    if (dateElement) {
        const today = new Date();
        dateElement.innerText = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const montantInput = document.getElementById("montant").value;
        const type = document.querySelector('input[name="type_transaction"]:checked').value;
        const selectedDate = document.getElementById("date-transaction").value;

        let montant = parseFloat(montantInput);
        if (type === "depense") montant = -Math.abs(montant);

        const finalDate = new Date(selectedDate);
        const currentTime = new Date();
        finalDate.setHours(currentTime.getHours(), currentTime.getMinutes());

        const nouvelleTransaction = {
            id: Date.now(),
            date: finalDate.toISOString(),
            montant: montant,
            type: type,
        };

        const transactionsExistantes = (await window.db.get("transactions")) || [];
        transactionsExistantes.push(nouvelleTransaction);
        transactionsExistantes.sort((a, b) => new Date(a.date) - new Date(b.date));
        await window.db.save("transactions", transactionsExistantes);

        form.reset();
        dateInput.value = todayString; 
        updateHistory();
        updateTotal();
    });
}

async function updateHistory() {
    const list = document.getElementById("history-list");
    if (!list) return;
    const transactions = (await window.db.get("transactions")) || [];
    if (transactions.length === 0) {
        list.innerHTML = '<li style="text-align: center; color: var(--text-dim);">Aucune transaction.</li>';
        return;
    }
    const recent = transactions.slice(-10).reverse();
    list.innerHTML = recent.map((t) => {
        const isGain = t.type === "gain";
        const d = new Date(t.date);
        return `
            <li class="history-item ${isGain ? 'gain' : 'depense'}">
                <span class="history-date">${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} - ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="history-amount" style="color: ${isGain ? "#2ecc71" : "#e74c3c"}">${isGain ? '+' : ''}${t.montant} FCFA</span>
                    <button class="btn-delete" data-id="${t.id}">✖</button>
                </div>
            </li>
        `;
    }).join("");
    attachDeleteListeners(list, () => { updateHistory(); updateTotal(); });
}

function attachDeleteListeners(listElement, callback) {
    listElement.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            const idToDelete = parseInt(e.target.getAttribute("data-id"));
            if (confirm("Supprimer cette transaction ?")) {
                const all = (await window.db.get("transactions")) || [];
                await window.db.save("transactions", all.filter((t) => t.id !== idToDelete));
                if(callback) callback();
            }
        });
    });
}

async function updateTotal() {
    const totalDisplay = document.getElementById("total-balance");
    if (!totalDisplay) return;
    const transactions = (await window.db.get("transactions")) || [];
    const total = transactions.reduce((acc, t) => acc + t.montant, 0);
    totalDisplay.style.color = total < 0 ? "#e74c3c" : "var(--accent-color)";
    totalDisplay.innerText = `${total.toLocaleString("fr-FR")} FCFA`;
}

/** * LOGIQUE TRANSACTIONS 
 */
async function initTransactionsLogic() {
    const list = document.getElementById("all-transactions-list");
    const filterType = document.getElementById("filter-type");
    const filterStartDate = document.getElementById("filter-start-date");
    const filterEndDate = document.getElementById("filter-end-date");
    const totalValueDisplay = document.getElementById("filter-total-value");
    if (!list) return;

    const todayString = getLocalTodayString();
    if (filterStartDate) filterStartDate.max = todayString;
    if (filterEndDate) { filterEndDate.max = todayString; filterEndDate.value = todayString; }

    const render = async () => {
        let transactions = (await window.db.get("transactions")) || [];
        if (filterType && filterType.value !== "all") transactions = transactions.filter((t) => t.type === filterType.value);
        if (filterStartDate && filterStartDate.value) {
            const s = new Date(filterStartDate.value); s.setHours(0,0,0,0);
            transactions = transactions.filter((t) => new Date(t.date) >= s);
        }
        if (filterEndDate && filterEndDate.value) {
            const e = new Date(filterEndDate.value); e.setHours(23,59,59,999);
            transactions = transactions.filter((t) => new Date(t.date) <= e);
        }

        // MAJ DU COMPTEUR DE SOLDE
        const sum = transactions.reduce((acc, t) => acc + t.montant, 0);
        if (totalValueDisplay) {
            totalValueDisplay.innerText = `${sum.toLocaleString("fr-FR")} FCFA`;
            totalValueDisplay.style.color = sum < 0 ? "#ff3366" : "#00ff88";
        }

        if (transactions.length === 0) { list.innerHTML = '<li style="text-align: center; color: var(--text-dim);">Vide.</li>'; return; }
        
        list.innerHTML = [...transactions].reverse().map((t) => {
            const d = new Date(t.date);
            const isG = t.type === "gain";
            return `
                <li class="history-item ${isG ? 'gain' : 'depense'}">
                    <span class="history-date">${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} - ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}</span>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span class="history-amount" style="color: ${isG ? "#2ecc71" : "#e74c3c"}">${isG ? '+' : ''}${t.montant} FCFA</span>
                        <button class="btn-delete" data-id="${t.id}">✖</button>
                    </div>
                </li>`;
        }).join("");
        attachDeleteListeners(list, () => { render(); updateTotal(); });
    };

    [filterType, filterStartDate, filterEndDate].forEach(el => el && el.addEventListener("change", render));
    render();
}

/** * LOGIQUE STATS (TRADING VIEW) 
 */
async function initCharts() {
    const canvas = document.getElementById("myChart");
    const typeSelector = document.getElementById("chart-type");
    const dataSelector = document.getElementById("chart-data");
    const chartStartDate = document.getElementById("chart-start-date");
    const chartEndDate = document.getElementById("chart-end-date");
    const chartTotalValue = document.getElementById("chart-total-value");
    
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const todayString = getLocalTodayString();
    if (chartStartDate) chartStartDate.max = todayString;
    if (chartEndDate) { chartEndDate.max = todayString; chartEndDate.value = todayString; }

    const render = async () => {
        let transactions = (await window.db.get("transactions")) || [];
        if (chartStartDate && chartStartDate.value) {
            const s = new Date(chartStartDate.value); s.setHours(0,0,0,0);
            transactions = transactions.filter((t) => new Date(t.date) >= s);
        }
        if (chartEndDate && chartEndDate.value) {
            const e = new Date(chartEndDate.value); e.setHours(23,59,59,999);
            transactions = transactions.filter((t) => new Date(t.date) <= e);
        }

        // MAJ DU COMPTEUR DE SOLDE
        const sum = transactions.reduce((acc, t) => acc + t.montant, 0);
        if (chartTotalValue) {
            chartTotalValue.innerText = `${sum.toLocaleString("fr-FR")} FCFA`;
            chartTotalValue.style.color = sum < 0 ? "#ff3366" : "#00ff88";
        }

        if (currentChart) currentChart.destroy();
        let labels = []; let datasets = [];
        let gB = ctx.createLinearGradient(0, 0, 0, 600); gB.addColorStop(0, 'rgba(0, 210, 255, 0.4)'); gB.addColorStop(1, 'rgba(0, 210, 255, 0)');
        let gG = ctx.createLinearGradient(0, 0, 0, 600); gG.addColorStop(0, 'rgba(46, 204, 113, 0.4)'); gG.addColorStop(1, 'rgba(46, 204, 113, 0)');
        let gR = ctx.createLinearGradient(0, 0, 0, 600); gR.addColorStop(0, 'rgba(231, 76, 60, 0.4)'); gR.addColorStop(1, 'rgba(231, 76, 60, 0)');

        const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

        if (dataSelector.value === "only-gains" || dataSelector.value === "only-depenses") {
            const isG = dataSelector.value === "only-gains";
            const daily = {};
            sorted.forEach(t => {
                if (t.type === (isG ? "gain" : "depense")) {
                    const k = new Date(t.date).toLocaleDateString("fr-FR", {day:'2-digit', month:'2-digit'});
                    daily[k] = (daily[k] || 0) + Math.abs(t.montant);
                }
            });
            labels = Object.keys(daily);
            datasets = [{ label: isG ? "Gains (+)" : "Dépenses (-)", data: Object.values(daily), borderColor: isG ? "#00ff88" : "#ff3366", backgroundColor: isG ? gG : gR, fill: true, tension: 0.2, borderWidth: 3 }];
        } else if (dataSelector.value === "separated") {
            const daily = {};
            sorted.forEach(t => {
                const k = new Date(t.date).toLocaleDateString("fr-FR", {day:'2-digit', month:'2-digit'});
                if (!daily[k]) daily[k] = { g: 0, d: 0 };
                if (t.type === "gain") daily[k].g += t.montant; else daily[k].d += Math.abs(t.montant);
            });
            labels = Object.keys(daily);
            datasets = [
                { label: "Gains", data: labels.map(k => daily[k].g), borderColor: "#00ff88", backgroundColor: gG, fill: true, tension: 0.2 },
                { label: "Dépenses", data: labels.map(k => daily[k].d), borderColor: "#ff3366", backgroundColor: gR, fill: true, tension: 0.2 }
            ];
        } else if (dataSelector.value === "balance") {
            let cum = 0; const pts = [];
            sorted.forEach(t => { cum += t.montant; labels.push(new Date(t.date).toLocaleDateString("fr-FR", {day:'2-digit', month:'2-digit'})); pts.push(cum); });
            datasets = [{ label: "Solde", data: pts, borderColor: "#00d2ff", backgroundColor: gB, fill: true, tension: 0.1, borderWidth: 3, pointRadius: 0 }];
        } else if (dataSelector.value === "monthly") {
            const mData = {};
            transactions.forEach(t => {
                const k = new Date(t.date).toLocaleDateString("fr-FR", {month:'short', year:'numeric'});
                if (!mData[k]) mData[k] = {g:0, d:0};
                if (t.type === "gain") mData[k].g += t.montant; else mData[k].d += Math.abs(t.montant);
            });
            labels = Object.keys(mData);
            datasets = [{label:"Gains", data:labels.map(k=>mData[k].g), backgroundColor:"#00ff88"}, {label:"Dépenses", data:labels.map(k=>mData[k].d), backgroundColor:"#ff3366"}];
        } else if (dataSelector.value === "compare") {
            let tg = 0, td = 0; transactions.forEach(t => t.type === "gain" ? tg += t.montant : td += Math.abs(t.montant));
            labels = ["Gains", "Dépenses"];
            datasets = [{ data: [tg, td], backgroundColor: ["#00ff88", "#ff3366"] }];
        }

        currentChart = new Chart(ctx, {
            type: typeSelector.value,
            data: { labels, datasets },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { 
                    legend: { labels: { color: "white", font: { weight: "bold" } } },
                    tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#00d2ff', bodyColor: '#fff', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1, padding: 12 },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x', // Permet de cliquer-glisser de gauche à droite
                        },
                        zoom: {
                            wheel: {
                                enabled: true, // Permet de zoomer/dézoomer avec la molette de la souris
                            },
                            pinch: {
                                enabled: true // Permet de zoomer avec les doigts sur un trackpad
                            },
                            mode: 'x',
                        }
                    }
                },
                scales: typeSelector.value === "doughnut" ? {} : {
                    x: { ticks: { color: "rgba(255,255,255,0.5)" }, grid: { display: false } },
                    y: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.05)" }, position: 'right' }
                }
            }
        });
    };

    [typeSelector, dataSelector, chartStartDate, chartEndDate].forEach(el => el && el.addEventListener("change", render));
    render();
}

// --- LOGIQUE PLEIN ÉCRAN ---
const btnFullscreen = document.getElementById("btn-fullscreen");
if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            // Passe en plein écran
            document.documentElement.requestFullscreen().catch(err => console.log(err));
            btnFullscreen.innerHTML = "🗗 Quitter Plein Écran";
        } else {
            // Quitte le plein écran
            document.exitFullscreen();
            btnFullscreen.innerHTML = "⛶ Plein Écran";
        }
    });
}