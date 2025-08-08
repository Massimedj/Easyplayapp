// Contenu de : src/melee/pages/classement.js

import { players, rounds } from '../shared/data.js';

const APP_CONTAINER = document.getElementById('app-container');

/**
 * Calcule les statistiques de chaque joueur en fonction des résultats des matchs.
 * @returns {Array} Une liste de joueurs triée avec leurs statistiques.
 */
function calculateRankings() {
    const playerStats = new Map();

    // 1. Initialiser les statistiques pour chaque joueur
    players.forEach(player => {
        playerStats.set(player.id, {
            playerObject: player,
            totalPoints: 0,
            scoreDifference: 0,
            wins: 0,
            losses: 0,
        });
    });

    // 2. Parcourir toutes les phases et tous les matchs pour accumuler les points
    rounds.forEach(round => {
        if (!round.generated || !round.matches) return;

        round.matches.forEach(match => {
            // On ne traite que les matchs dont les scores sont entièrement saisis
            if (match.score1 === null || match.score2 === null || match.score1 === match.score2) {
                return; 
            }

            const score1 = match.score1;
            const score2 = match.score2;
            const diff = Math.abs(score1 - score2);

            const winnerId = score1 > score2 ? match.team1.id : match.team2.id;
            const loserId = score1 < score2 ? match.team1.id : match.team2.id;
            
            const winningTeam = round.teams.find(t => t.id === winnerId);
            const losingTeam = round.teams.find(t => t.id === loserId);

            if (!winningTeam || !losingTeam) return;

            // 3. Appliquer les points aux joueurs de l'équipe GAGNANTE
            winningTeam.players.forEach(player => {
                const stats = playerStats.get(player.id);
                if (stats) {
                    stats.totalPoints += 8;
                    stats.wins += 1;
                    stats.scoreDifference += (winningTeam.id === match.team1.id) ? diff : -diff;
                }
            });

            // 4. Appliquer les points aux joueurs de l'équipe PERDANTE
            let loserPoints = 0;
            if (diff >= 1 && diff <= 3) loserPoints = 4;
            else if (diff >= 4 && diff <= 6) loserPoints = 3;
            else if (diff >= 7 && diff <= 9) loserPoints = 2;
            else if (diff >= 10) loserPoints = 1;

            losingTeam.players.forEach(player => {
                const stats = playerStats.get(player.id);
                if (stats) {
                    stats.totalPoints += loserPoints;
                    stats.losses += 1;
                    stats.scoreDifference += (losingTeam.id === match.team1.id) ? -diff : diff;
                }
            });
        });
    });

    // 5. Convertir la Map en tableau et trier les joueurs
    const rankedPlayers = Array.from(playerStats.values());
    
    rankedPlayers.sort((a, b) => {
        // Critère 1 : Le plus de points
        if (b.totalPoints !== a.totalPoints) {
            return b.totalPoints - a.totalPoints;
        }
        // Critère 2 (en cas d'égalité) : La meilleure différence de score
        if (b.scoreDifference !== a.scoreDifference) {
            return b.scoreDifference - a.scoreDifference;
        }
        // Critère 3 (en cas d'égalité) : Ordre alphabétique
        return a.playerObject.lastName.localeCompare(b.playerObject.lastName);
    });

    return rankedPlayers;
}


/**
 * Fonction principale qui affiche le contenu de la page de classement.
 */
export function render() {
	const isLoggedIn = !!window.userId;
    const activeMeleeId = window.getActiveMeleeTournamentId ? window.getActiveMeleeTournamentId() : null;

    if (isLoggedIn && !activeMeleeId) {
        window.location.hash = '#melee/accueil';
        return;
    }

    const rankedPlayers = calculateRankings();

    APP_CONTAINER.innerHTML = `
        <main class="p-8">
            <h2 class="text-3xl font-bold mb-6">Classement des Joueurs</h2>

            <div class="bg-white p-6 rounded-lg shadow-md border overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rang</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joueur</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Total des Points">Pts</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Différence de Score">Diff.</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Victoires">V</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Défaites">D</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${rankedPlayers.length > 0 && rounds.some(r => r.generated) ? rankedPlayers.map((stats, index) => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap font-bold text-lg text-gray-700">${index + 1}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900">${stats.playerObject.firstName} ${stats.playerObject.lastName}</div>
                                    <div class="text-sm text-gray-500">${stats.playerObject.gender} - Nv. ${stats.playerObject.level}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-center text-xl font-bold text-teal-600">${stats.totalPoints}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold ${stats.scoreDifference >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${stats.scoreDifference > 0 ? '+' : ''}${stats.scoreDifference}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">${stats.wins}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">${stats.losses}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="6" class="px-6 py-4 text-center text-gray-500">Aucun match complété. Veuillez saisir des scores dans la page "Rencontres".</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        </main>
    `;
}