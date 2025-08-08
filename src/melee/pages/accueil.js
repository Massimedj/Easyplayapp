// Contenu de : src/melee/pages/accueil.js

const APP_CONTAINER = document.getElementById('app-container');

/**
 * Génère le contenu HTML de la page d'accueil détaillée pour le mode Mêlée.
 * @param {string} tournamentName - Le nom du tournoi à afficher.
 */
function getMeleeWelcomeContentHTML(tournamentName) {
    return `
        <h2 class="text-4xl font-extrabold text-center text-teal-700 mb-4">
            Tournoi à la Mêlée !
        </h2>
        <p class="text-xl text-gray-700 text-center mb-12">
            Ici, pas d'équipe fixe, les partenaires changent à chaque phase, pour que chacun joue avec tout le monde et que le tournoi soit fun !
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 text-left">
            <div class="bg-teal-50 p-6 rounded-lg shadow-md border border-teal-200">
                <h3 class="text-2xl font-semibold text-teal-800 mb-3 flex items-center">
                    <i class="fas fa-user-friends mr-3 text-teal-600"></i>Gestion des Joueurs
                </h3>
                <p class="text-teal-700">
                    Ajoutez, modifiez ou importez facilement tous les participants. Chaque joueur est unique et possède son propre niveau.
                </p>
            </div>
            <div class="bg-green-50 p-6 rounded-lg shadow-md border border-green-200">
                <h3 class="text-2xl font-semibold text-green-800 mb-3 flex items-center">
                    <i class="fas fa-balance-scale-right mr-3 text-green-600"></i>Génération Équilibrée
                </h3>
                <p class="text-green-700">
                    L'application crée des équipes mixtes, équilibrées en niveau et s'assure de varier les coéquipiers à chaque phase de rencontres. Mais vous avez quand même la possibilité d'ajuster les équipes.
                </p>
            </div>
            <div class="bg-purple-50 p-6 rounded-lg shadow-md border border-purple-200">
                <h3 class="text-2xl font-semibold text-purple-800 mb-3 flex items-center">
                    <i class="fas fa-clipboard-check mr-3 text-purple-600"></i>Saisie des Scores
                </h3>
                <p class="text-purple-700">
                    L'interface claire vous permet de visualiser la composition des équipes face à face et de saisir les scores des rencontres en un clin d'œil.
                </p>
            </div>
            <div class="bg-yellow-50 p-6 rounded-lg shadow-md border border-yellow-200">
                <h3 class="text-2xl font-semibold text-yellow-800 mb-3 flex items-center">
                    <i class="fas fa-trophy mr-3 text-yellow-600"></i>Classement Individuel
                </h3>
                <p class="text-yellow-700">
                    Suivez en temps réel le classement de chaque joueur. Les points sont calculés automatiquement après chaque match saisi.
                </p>
            </div>
        </div>

        <div class="bg-gray-100 p-6 rounded-lg shadow-inner border border-gray-300 text-gray-800 max-w-2xl mx-auto text-left">
            <h3 class="text-xl font-bold mb-4 text-center">Règles et Système de Points</h3>
            <p class="text-sm text-gray-600 mb-4">Les points sont attribués individuellement à chaque joueur en fonction de la performance de son équipe pour un match donné :</p>
            <ul class="list-disc list-inside space-y-2">
                <li>
                    <strong class="text-teal-700">Équipe gagnante :</strong><span class="ml-2">chaque joueur reçoit <b>8 points</b>.</span>
                    
                </li>
                <li>
                    <strong class="text-teal-700">Équipe perdante (écart de 1 à 3 pts) :</strong><span class="ml-2">chaque joueur reçoit <b>4 points</b>.</span>
                </li>
                 <li>
                    <strong class="text-teal-700">Équipe perdante (écart de 4 à 6 pts) :</strong><span class="ml-2">chaque joueur reçoit <b>3 points</b>.</span>
                    
                </li>
                 <li>
                    <strong class="text-teal-700">Équipe perdante (écart de 7 à 9 pts) :</strong><span class="ml-2">chaque joueur reçoit <b>2 points</b>.</span>
                    
                </li>
                 <li>
                    <strong class="text-teal-700">Équipe perdante (écart de 10+ pts) :</strong><span class="ml-2">chaque joueur reçoit <b>1 point</b>.</span>
                    
                </li>
            </ul>
			<p class="text-sm italic text-gray-600 mt-2 ml-4">
				Ce système de points permet de faire un classement plus précis et surtout de <b>récompenser "les bons perdants"</b>, ceux qui se donnent à fond et ne baissent pas les bras même s'ils perdent.
			</p>
        </div>
    `;
}


export function render() {
    const isLoggedIn = !!window.userId;
    const activeMeleeId = window.getActiveMeleeTournamentId ? window.getActiveMeleeTournamentId() : null;
    const currentData = window.getCurrentTournamentData ? window.getCurrentTournamentData() : null;
    
    let contentHTML = '';

    // Si on est connecté avec un tournoi mêlée actif, OU si on est en mode invité
    if ((isLoggedIn && activeMeleeId && currentData) || !isLoggedIn) {
        const tournamentName = currentData ? currentData.name : "en Mode Invité";
        contentHTML = getMeleeWelcomeContentHTML(tournamentName);
    
    // Si on est connecté mais SANS tournoi mêlée actif
    } else if (isLoggedIn) {
        contentHTML = `
            <h2 class="text-3xl font-bold mb-2">Aucun tournoi à la Mêlée sélectionné</h2>
            <p class="text-lg text-gray-600 mb-6">Veuillez sélectionner un tournoi à la mêlée existant ou en créer un nouveau.</p>
            <a href="#tournaments" class="bg-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-teal-700">
                Gérer mes tournois
            </a>
        `;
    }

    APP_CONTAINER.innerHTML = `
        <main class="p-8">
            ${contentHTML}
        </main>
    `;
}