// Contenu de : src/melee/shared/generation.js

/**
 * L'algorithme principal pour générer des équipes et une seule rencontre par équipe.
 * @returns {{teams: Array, matches: Array, exemptTeam: object|null}|{error: string}}
 */
export function generateTeamsAndMatches({ allPlayers, existingRounds, numTeams }) {
    // --- 1. & 2. Séparation par sexe et vérification de faisabilité ---
    const men = allPlayers.filter(p => p.gender === 'Homme').sort((a, b) => b.level - a.level);
    const women = allPlayers.filter(p => p.gender === 'Femme').sort((a, b) => b.level - a.level);

    if (men.length < numTeams || women.length < numTeams) {
        return { error: `Impossible de créer ${numTeams} équipes mixtes. Il faut au moins ${numTeams} hommes et ${numTeams} femmes.` };
    }

    // --- 3. Création de l'historique des coéquipiers ---
    const teammateHistory = new Map();
    existingRounds.forEach(round => {
        if (!round.generated) return;
        round.teams.forEach(team => {
            for (let i = 0; i < team.players.length; i++) {
                for (let j = i + 1; j < team.players.length; j++) {
                    const key = [team.players[i].id, team.players[j].id].sort().join('-');
                    teammateHistory.set(key, (teammateHistory.get(key) || 0) + 1);
                }
            }
        });
    });

    // --- 4. & 5. Création, initialisation et distribution des joueurs dans les équipes ---
    let teams = Array.from({ length: numTeams }, () => ({ players: [], totalLevel: 0 }));
    for (let i = 0; i < numTeams; i++) {
        const man = men.shift();
        const woman = women.shift();
        teams[i].players.push(man, woman);
        teams[i].totalLevel += man.level + woman.level;
    }
    const remainingPlayers = [...men, ...women].sort((a, b) => b.level - a.level);
    
    remainingPlayers.forEach(player => {
        let bestTeamIndex = -1;
        let minCost = Infinity;
        teams.forEach((team, index) => {
            if (team.players.length >= Math.ceil(allPlayers.length / numTeams)) return;
            const levelCost = team.totalLevel;
            let historyCost = 0;
            team.players.forEach(teammate => {
                const key = [player.id, teammate.id].sort().join('-');
                historyCost += (teammateHistory.get(key) || 0);
            });
            const totalCost = levelCost + (historyCost * 10);
            if (totalCost < minCost) {
                minCost = totalCost;
                bestTeamIndex = index;
            }
        });
        if (bestTeamIndex === -1) {
            bestTeamIndex = teams.findIndex(t => t.players.length < Math.ceil(allPlayers.length / numTeams));
        }
        teams[bestTeamIndex].players.push(player);
        teams[bestTeamIndex].totalLevel += player.level;
    });

    const finalTeams = teams.map((team, index) => ({
        id: `team_${Date.now()}_${index}`,
        name: `Équipe ${String.fromCharCode(65 + index)}`,
        players: team.players,
        totalLevel: team.totalLevel
    }));

    // --- 6. NOUVELLE LOGIQUE DE GÉNÉRATION DES RENCONTRES (1 par équipe) ---
    const matches = [];
    let exemptTeam = null;
    
    // On mélange les équipes pour que les rencontres soient aléatoires
    let teamsToPair = [...finalTeams];
    for (let i = teamsToPair.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [teamsToPair[i], teamsToPair[j]] = [teamsToPair[j], teamsToPair[i]];
    }

    // Si le nombre d'équipes est impair, la dernière est exempte
    if (teamsToPair.length % 2 !== 0) {
        exemptTeam = teamsToPair.pop();
    }

    // On crée les paires
    for (let i = 0; i < teamsToPair.length; i += 2) {
        const team1 = teamsToPair[i];
        const team2 = teamsToPair[i + 1];
        matches.push({
            id: `match_${Date.now()}_${i}`,
            team1: { id: team1.id, name: team1.name },
            team2: { id: team2.id, name: team2.name },
            score1: null,
            score2: null,
            winnerId: null
        });
    }

    return { teams: finalTeams, matches, exemptTeam };
}