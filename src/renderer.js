import './index.css';
import 'animate.css';
import Chart from 'chart.js/auto';

// Imports des vues
import homeHtml from './views/home.html?raw';
import chartHtml from './views/chart.html?raw'; 
import transactionsHtml from './views/transactions.html?raw';

const appContainer = document.getElementById('app');

// Router
document.getElementById('btn-home').addEventListener('click', () => navigate(homeHtml, 'home'));
document.getElementById('btn-transactions').addEventListener('click', () => navigate(transactionsHtml, 'transactions'));
document.getElementById('btn-chart').addEventListener('click', () => navigate(chartHtml, 'chart'));

// Charger l'accueil par défaut au lancement
navigate(homeHtml, 'home');

/**
 * Fonction de navigation améliorée
 */
function navigate(content, viewName) {
    appContainer.innerHTML = `<div class="animate__animated animate__fadeIn">${content}</div>`;

    if (viewName === 'home') {
        initHomeLogic(); 
    } else if (viewName === 'transactions') {
        initTransactionsLogic();
    } else if (viewName === 'chart') {
        initCharts();
    }
}

/**
 * Logique de la page d'accueil (Formulaire + Historique)
 */
function initHomeLogic() {
    const form = document.getElementById('finance-form');
    if (!form) return;

    updateTotal(); 
    
    // Mettre à jour le texte de la date du jour
    const dateElement = document.getElementById('date-du-jour');
    if (dateElement) {
        dateElement.innerText = datetoday();
    }

    // 1. Charger l'historique initial
    updateHistory();
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const montantInput = document.getElementById('montant').value;
        const type = document.querySelector('input[name="type_transaction"]:checked').value;
        
        let montant = parseFloat(montantInput);
        if (type === 'depense') {
            montant = -Math.abs(montant);
        }

        const nouvelleTransaction = {
            id: Date.now(),
            date: new Date().toISOString(), 
            montant: montant,
            type: type
        };

        try {
            const transactionsExistantes = await window.db.get('transactions') || [];
            transactionsExistantes.push(nouvelleTransaction);
            await window.db.save('transactions', transactionsExistantes);

            // Succès visuel
            const successMsg = document.getElementById('success-msg');
            successMsg.classList.remove('hidden');
            successMsg.classList.add('animate__animated', 'animate__bounceIn');
            
            form.reset(); 
            document.getElementById('gain').checked = true; 

            updateHistory();
            updateTotal();

            setTimeout(() => {
                successMsg.classList.add('hidden');
                successMsg.classList.remove('animate__animated', 'animate__bounceIn');
            }, 3000);

        } catch (error) {
            console.error("Erreur lors de la sauvegarde :", error);
            alert("Oups, impossible de sauvegarder !");
        }
    });
}

/**
 * Fonction pour charger et afficher les dernières transactions
 */
/**
 * Fonction pour charger et afficher les dernières transactions (Home)
 */
async function updateHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;

    const transactions = await window.db.get('transactions') || [];
    
    if (transactions.length === 0) {
        list.innerHTML = '<li style="text-align: center; color: var(--text-dim);">Aucune transaction pour le moment.</li>';
        return;
    }

    // On coupe à 10 transactions maximum (au lieu de 5)
    const recentTransactions = transactions.slice(-10).reverse();

    list.innerHTML = recentTransactions.map(t => {
        const isGain = t.type === 'gain';
        const sign = isGain ? '+' : '';
        
        const colorClass = isGain ? 'gain' : 'depense'; 
        
        const dateObj = new Date(t.date);

        // Formatage de la date
        const jour = String(dateObj.getDate()).padStart(2, '0');
        const mois = String(dateObj.getMonth() + 1).padStart(2, '0');
        const annee = dateObj.getFullYear();
        const heures = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');

        const dateStr = `${jour}/${mois}/${annee} - ${heures}:${minutes}`;

        return `
            <li class="history-item ${colorClass}">
                <span class="history-date">${dateStr}</span>
                <span class="history-amount" style="color: ${isGain ? '#2ecc71' : '#e74c3c'}">
                    ${sign}${t.montant} FCFA
                </span>
            </li>
        `;
    }).join('');
}

async function updateTotal() {
    const totalDisplay = document.getElementById('total-balance');
    if (!totalDisplay) return;

    const transactions = await window.db.get('transactions') || [];
    const total = transactions.reduce((acc, t) => acc + t.montant, 0);

    // Changement de couleur dynamique : rouge si négatif, bleu/vert si positif
    totalDisplay.style.color = total < 0 ? '#e74c3c' : 'var(--accent-color)';
    totalDisplay.innerText = `${total.toLocaleString('fr-FR')} FCFA`;
}

function datetoday() {
    const today = new Date();
    const jour = String(today.getDate()).padStart(2, '0');
    const mois = String(today.getMonth() + 1).padStart(2, '0');
    const annee = today.getFullYear();
    return `${jour}/${mois}/${annee}`;
}

async function initTransactionsLogic() {
    const list = document.getElementById('all-transactions-list');
    const filterType = document.getElementById('filter-type');
    const filterDate = document.getElementById('filter-date');
    if (!list) return;

    // Fonction interne pour filtrer et dessiner la liste
    const renderFilteredTransactions = async () => {
        const transactions = await window.db.get('transactions') || [];
        let filtered = [...transactions].reverse(); // Du plus récent au plus vieux

        // 1. Appliquer le filtre de type (Gain/Dépense)
        if (filterType && filterType.value !== 'all') {
            filtered = filtered.filter(t => t.type === filterType.value);
        }

        // 2. Appliquer le filtre de date (Aujourd'hui)
        if (filterDate && filterDate.value === 'today') {
            const todayStr = datetoday(); // Ton format 'JJ/MM/AAAA'
            filtered = filtered.filter(t => {
                const d = new Date(t.date);
                const j = String(d.getDate()).padStart(2, '0');
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const a = d.getFullYear();
                return `${j}/${m}/${a}` === todayStr;
            });
        }

        // Affichage si vide
        if (filtered.length === 0) {
            list.innerHTML = '<li style="text-align: center; color: var(--text-dim);">Aucune transaction correspondante.</li>';
            return;
        }

        // Génération du HTML
        list.innerHTML = filtered.map(t => {
            const isGain = t.type === 'gain';
            const colorClass = isGain ? 'gain' : 'depense';
            const sign = isGain ? '+' : '';
            const dateObj = new Date(t.date);
            const jour = String(dateObj.getDate()).padStart(2, '0');
            const mois = String(dateObj.getMonth() + 1).padStart(2, '0');
            const annee = dateObj.getFullYear();
            const heures = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');

            return `
                <li class="history-item ${colorClass}">
                    <span class="history-date">${jour}/${mois}/${annee} - ${heures}:${minutes}</span>
                    <span class="history-amount" style="color: ${isGain ? '#2ecc71' : '#e74c3c'}">
                        ${sign}${t.montant} FCFA
                    </span>
                </li>
            `;
        }).join('');
    };

    // Brancher les écouteurs pour mettre à jour instantanément
    if (filterType) filterType.addEventListener('change', renderFilteredTransactions);
    if (filterDate) filterDate.addEventListener('change', renderFilteredTransactions);

    // Lancer le premier rendu
    renderFilteredTransactions();
}

// A METTRE TOUT EN HAUT DU FICHIER (sous les imports) :
let currentChart = null;


// LA NOUVELLE FONCTION (à remplacer en bas) :
async function initCharts() {
    const ctx = document.getElementById('myChart');
    const typeSelector = document.getElementById('chart-type');
    const dataSelector = document.getElementById('chart-data');
    if (!ctx) return;

    const renderChart = async () => {
        const transactions = await window.db.get('transactions') || [];
        const chartType = typeSelector ? typeSelector.value : 'line';
        const dataType = dataSelector ? dataSelector.value : 'balance';

        // IMPORTANT : Détruire l'ancien graphique avant d'en dessiner un nouveau
        if (currentChart) {
            currentChart.destroy();
        }

        let labels = [];
        let datasets = [];

        if (dataType === 'balance') {
            // Mode "Évolution du Solde"
            // On trie par date du plus vieux au plus récent pour tracer une courbe logique
            const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
            let soldeCumulative = 0;
            const dataPoints = [];
            
            sorted.forEach(t => {
                soldeCumulative += t.montant;
                const d = new Date(t.date);
                labels.push(`${d.getDate()}/${d.getMonth()+1}`); // Affiche "Jour/Mois"
                dataPoints.push(soldeCumulative);
            });

            datasets = [{
                label: 'Solde cumulé (FCFA)',
                data: dataPoints,
                borderColor: '#00d2ff',
                backgroundColor: 'rgba(0, 210, 255, 0.2)',
                fill: true,
                tension: 0.3,
                borderWidth: 2
            }];
            
        } else if (dataType === 'compare') {
            // Mode "Comparaison Gain/Dépense" (Top pour les Camemberts)
            let totalGains = 0;
            let totalDepenses = 0;
            
            transactions.forEach(t => {
                if (t.type === 'gain') totalGains += t.montant;
                else totalDepenses += Math.abs(t.montant); // On met en positif pour le graphe
            });

            labels = ['Gains Totaux', 'Dépenses Totales'];
            datasets = [{
                label: 'Montant (FCFA)',
                data: [totalGains, totalDepenses],
                backgroundColor: ['rgba(46, 204, 113, 0.7)', 'rgba(231, 76, 60, 0.7)'],
                borderColor: ['#2ecc71', '#e74c3c'],
                borderWidth: 1
            }];
        }

        // Création du graphique
        currentChart = new Chart(ctx, {
            type: chartType,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Permet au canvas de remplir la div de 350px
                plugins: { 
                    legend: { labels: { color: 'white' } } 
                },
                // Si c'est un doughnut, on cache les grilles/axes qui n'ont pas de sens
                scales: chartType === 'doughnut' ? {} : {
                    x: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { display: false } },
                    y: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
    };

    // Écouteurs pour redessiner le graphe quand on change les menus
    if(typeSelector) typeSelector.addEventListener('change', renderChart);
    if(dataSelector) dataSelector.addEventListener('change', renderChart);

    // Lancement du premier rendu
    renderChart();
}