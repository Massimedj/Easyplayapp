// Contenu de : src/melee/shared/generation.js

/**
 * L'algorithme principal pour générer des équipes et une seule rencontre par équipe.
 * Cette version est agnostique au sexe des joueurs.
 * @returns {{teams: Array, matches: Array, exemptTeam: object|null}|{error: string}}
 */
export function generateTeamsAndMatches({ allPlayers, existingRounds, numTeams }) {
    // --- 1. Vérification de faisabilité (non basée sur le sexe) ---
    // Il faut au moins 2 joueurs par équipe en moyenne pour commencer.
    if (allPlayers.length < numTeams * 2) {
        return { error: `Pas assez de joueurs (${allPlayers.length}) pour former ${numTeams} équipes de 2 ou plus.` };
    }

    // --- 2. Création de l'historique des coéquipiers (inchangé) ---
    const teammateHistory = new Map();
    existingRounds.forEach(round => {
        if (!round.generated || !round.teams) return;
        round.teams.forEach(team => {
            for (let i = 0; i < team.players.length; i++) {
                for (let j = i + 1; j < team.players.length; j++) {
                    const key = [team.players[i].id, team.players[j].id].sort().join('-');
                    teammateHistory.set(key, (teammateHistory.get(key) || 0) + 1);
                }
            }
        });
    });

    // --- 3. NOUVELLE LOGIQUE de répartition des joueurs (agnostique au sexe) ---
    // Trier tous les joueurs par niveau, du plus fort au plus faible.
    const playersToDistribute = [...allPlayers].sort((a, b) => b.level - a.level);

    // Initialiser les équipes vides.
    let teams = Array.from({ length: numTeams }, () => ({ players: [], totalLevel: 0 }));

    // Distribuer chaque joueur, un par un, dans la meilleure équipe possible.
    playersToDistribute.forEach(player => {
        let bestTeamIndex = -1;
        let minCost = Infinity;

        // Évaluer chaque équipe pour y placer le joueur actuel.
        teams.forEach((team, index) => {
            // Le coût est basé sur le niveau total actuel (on favorise les équipes de bas niveau).
            const levelCost = team.totalLevel;
            
            // On ajoute une forte pénalité pour chaque fois que le joueur a déjà été avec un des coéquipiers.
            let historyCost = 0;
            team.players.forEach(teammate => {
                const key = [player.id, teammate.id].sort().join('-');
                historyCost += (teammateHistory.get(key) || 0) * 100; // Forte pénalité pour éviter les doublons
            });

            // Le coût total combine le niveau et l'historique.
            const totalCost = levelCost + historyCost;

            if (totalCost < minCost) {
                minCost = totalCost;
                bestTeamIndex = index;
            }
        });
        
        // Placer le joueur dans l'équipe la moins "coûteuse" trouvée.
        if (bestTeamIndex !== -1) {
             teams[bestTeamIndex].players.push(player);
             teams[bestTeamIndex].totalLevel += player.level;
        } else {
            // Fallback au cas où (ne devrait pas arriver), on le met dans l'équipe la plus vide.
            teams.sort((a, b) => a.players.length - b.players.length);
            teams[0].players.push(player);
            teams[0].totalLevel += player.level;
        }
    });

    const finalTeams = teams.map((team, index) => ({
        id: `team_${Date.now()}_${index}`,
        name: `Équipe ${String.fromCharCode(65 + index)}`,
        players: team.players,
        totalLevel: team.totalLevel
    }));

    // --- 4. Génération des rencontres (inchangé) ---
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
