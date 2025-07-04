(function() {
    // --- Constantes et Variables Globales ---
    const APP_CONTAINER = document.getElementById('app-container');

    // Suppression des clés localStorage, car nous utiliserons Firestore
    // const TEAM_DATA_KEY = 'volleyTeamsData';
    // const BRASSAGE_PHASES_KEY = 'volleyBrassagePhases';
    // const ELIMINATION_PHASES_KEY = 'volleyEliminationPhases';
    // const SECONDARY_GROUPS_SELECTION_KEY = 'volleySecondaryGroupsSelection';
    // const POOL_GENERATION_BASIS_KEY = 'volleyPoolGenerationBasis';
    // const SECONDARY_GROUPS_PREVIEW_KEY = 'volleySecondaryGroupsPreview';
    // const ELIMINATED_TEAMS_KEY = 'volleyEliminatedTeams';

    const PHASE_TYPE_INITIAL = 'initial_brassage';
    const PHASE_TYPE_SECONDARY_BRASSAGE = 'secondary_brassage';
    const PHASE_TYPE_ELIMINATION_SEEDING = 'elimination_seeding'; // Phase spéciale pour le regroupement éliminatoire

    let allTeams = [];
    let allBrassagePhases = [];
    let eliminationPhases = {};
    let currentSecondaryGroupsPreview = {}; // Pour la prévisualisation des groupes secondaires, maintenant persistant
    let eliminatedTeams = new Set(); // Set pour stocker les IDs des équipes éliminées
    let modalConfirmBtn = document.getElementById('modalConfirmBtn'); // Utilisez let ici car il est réaffecté

    let currentDisplayedPhaseId = null; // ID de la phase de brassage actuellement affichée

    // Map pour suivre les occurrences de matchs dans les différentes phases
    // Clé: chaîne canonique représentant la paire d'équipes (ex: "team1_id-team2_id" triée)
    // Valeur: Set d'IDs de phases où cette paire a joué
    const matchOccurrences = new Map();

    // Références aux éléments de la modale globale
    const globalModal = document.getElementById('globalModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    // --- Fonctions Utilitaires ---

    /**
     * Génère un identifiant unique universel (UUID).
     * @returns {string} Un UUID.
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Affiche une modale avec un titre, un corps et un gestionnaire de confirmation optionnel.
     * @param {string} title - Le titre de la modale.
     * @param {string} bodyHtml - Le contenu HTML du corps de la modale.
     * @param {function} [onConfirm] - Fonction à exécuter si l'utilisateur clique sur "Confirmer".
     * @param {string} [confirmText='Confirmer'] - Texte du bouton de confirmation.
     * @param {string} [cancelText='Annuler'] - Texte du bouton d'annulation.
     */
    function showModal(title, bodyHtml, onConfirm, confirmText = 'Confirmer', cancelText = 'Annuler') {
        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHtml;
        modalConfirmBtn.textContent = confirmText;
        modalCancelBtn.textContent = cancelText;

        // Supprime tous les anciens écouteurs d'événements pour éviter les exécutions multiples
        const oldConfirmBtn = modalConfirmBtn;
        const newConfirmBtn = oldConfirmBtn.cloneNode(true);
        oldConfirmBtn.parentNode.replaceChild(newConfirmBtn, oldConfirmBtn);
        modalConfirmBtn = newConfirmBtn; // Met à jour la référence

        if (onConfirm) {
            modalConfirmBtn.style.display = 'inline-flex'; // Affiche le bouton Confirmer
            modalConfirmBtn.onclick = () => {
                onConfirm();
                hideModal();
            };
        } else {
            modalConfirmBtn.style.display = 'none'; // Cache le bouton Confirmer si pas de onConfirm
        }

        globalModal.classList.remove('hidden');
        setTimeout(() => {
            globalModal.classList.add('opacity-100');
        }, 10); // Petite pause pour la transition
    }

    /**
     * Cache la modale globale.
     */
    function hideModal() {
        globalModal.classList.remove('opacity-100');
        globalModal.classList.add('opacity-0');
        setTimeout(() => {
            globalModal.classList.add('hidden');
        }, 300); // Correspond à la durée de la transition CSS
    }

    /**
     * Affiche un message temporaire à l'utilisateur.
     * @param {string} message - Le message à afficher.
     * @param {string} type - Le type de message ('success', 'error', 'info').
     */
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-[100] flex flex-col space-y-2';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `p-4 rounded-lg shadow-md text-white flex items-center space-x-2 transition-opacity duration-300 ease-out opacity-0`;

        let bgColor = '';
        let icon = '';
        switch (type) {
            case 'success':
                bgColor = 'bg-green-500';
                icon = '<i class="fas fa-check-circle"></i>';
                break;
            case 'error':
                bgColor = 'bg-red-500';
                icon = '<i class="fas fa-times-circle"></i>';
                break;
            case 'info':
            default:
                bgColor = 'bg-blue-500';
                icon = '<i class="fas fa-info-circle"></i>';
                break;
        }

        toast.classList.add(bgColor);
        toast.innerHTML = `${icon} <span>${message}</span>`;

        toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.remove('opacity-0');
            toast.classList.add('opacity-100');
        }, 10);

        // Animate out and remove
        setTimeout(() => {
            toast.classList.remove('opacity-100');
            toast.classList.add('opacity-0');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    /**
     * Calcule le nombre de matchs joués par une équipe dans une phase donnée.
     * @param {string} teamId - L'ID de l'équipe.
     * @param {Object} phase - L'objet phase.
     * @returns {number} Le nombre de matchs joués.
     */
    function calculateMatchesPlayed(teamId, phase) {
        let matchesPlayed = 0;
        for (const pool of phase.pools) {
            for (const match of pool.matches) {
                if ((match.teamA === teamId || match.teamB === teamId) && match.scoreA !== null && match.scoreB !== null) {
                    matchesPlayed++;
                }
            }
        }
        return matchesPlayed;
    }

    /**
     * Calcule le nombre de victoires pour une équipe dans une phase donnée.
     * @param {string} teamId - L'ID de l'équipe.
     * @param {Object} phase - L'objet phase.
     * @returns {number} Le nombre de victoires.
     */
    function calculateWins(teamId, phase) {
        let wins = 0;
        for (const pool of phase.pools) {
            for (const match of pool.matches) {
                if (match.scoreA !== null && match.scoreB !== null) {
                    if (match.teamA === teamId && match.scoreA > match.scoreB) {
                        wins++;
                    } else if (match.teamB === teamId && match.scoreB > match.scoreA) {
                        wins++;
                    }
                }
            }
        }
        return wins;
    }

    /**
     * Calcule le nombre de sets gagnés pour une équipe dans une phase donnée.
     * @param {string} teamId - L'ID de l'équipe.
     * @param {Object} phase - L'objet phase.
     * @returns {number} Le nombre de sets gagnés.
     */
    function calculateSetsWon(teamId, phase) {
        let setsWon = 0;
        for (const pool of phase.pools) {
            for (const match of pool.matches) {
                if (match.scoreA !== null && match.scoreB !== null) {
                    if (match.teamA === teamId) {
                        setsWon += match.scoreA;
                    } else if (match.teamB === teamId) {
                        setsWon += match.scoreB;
                    }
                }
            }
        }
        return setsWon;
    }

    /**
     * Calcule le nombre de sets perdus pour une équipe dans une phase donnée.
     * @param {string} teamId - L'ID de l'équipe.
     * @param {Object} phase - L'objet phase.
     * @returns {number} Le nombre de sets perdus.
     */
    function calculateSetsLost(teamId, phase) {
        let setsLost = 0;
        for (const pool of phase.pools) {
            for (const match of pool.matches) {
                if (match.scoreA !== null && match.scoreB !== null) {
                    if (match.teamA === teamId) {
                        setsLost += match.scoreB;
                    } else if (match.teamB === teamId) {
                        setsLost += match.scoreA;
                    }
                }
            }
        }
        return setsLost;
    }

    /**
     * Calcule le ratio de sets pour une équipe dans une phase donnée.
     * @param {string} teamId - L'ID de l'équipe.
     * @param {Object} phase - L'objet phase.
     * @returns {number} Le ratio de sets (Sets Gagnés / Sets Perdus), ou 0 si Sets Perdus est 0.
     */
    function calculateSetRatio(teamId, phase) {
        const setsWon = calculateSetsWon(teamId, phase);
        const setsLost = calculateSetsLost(teamId, phase);
        return setsLost === 0 ? (setsWon === 0 ? 0 : setsWon) : setsWon / setsLost;
    }

    /**
     * Met à jour les occurrences de matchs dans la map globale.
     * @param {string} teamAId - L'ID de la première équipe.
     * @param {string} teamBId - L'ID de la deuxième équipe.
     * @param {string} phaseId - L'ID de la phase où le match a eu lieu.
     */
    function updateMatchOccurrence(teamAId, teamBId, phaseId) {
        const canonicalKey = [teamAId, teamBId].sort().join('-');
        if (!matchOccurrences.has(canonicalKey)) {
            matchOccurrences.set(canonicalKey, new Set());
        }
        matchOccurrences.get(canonicalKey).add(phaseId);
    }

    /**
     * Vérifie si deux équipes ont déjà joué l'une contre l'autre dans une phase spécifique.
     * @param {string} teamAId - L'ID de la première équipe.
     * @param {string} teamBId - L'ID de la deuxième équipe.
     * @param {string} phaseId - L'ID de la phase à vérifier.
     * @returns {boolean} Vrai si elles ont déjà joué, faux sinon.
     */
    function hasTeamsPlayedInPhase(teamAId, teamBId, phaseId) {
        const canonicalKey = [teamAId, teamBId].sort().join('-');
        return matchOccurrences.has(canonicalKey) && matchOccurrences.get(canonicalKey).has(phaseId);
    }

    /**
     * Vérifie si deux équipes ont déjà joué l'une contre l'autre dans n'importe quelle phase.
     * @param {string} teamAId - L'ID de la première équipe.
     * @param {string} teamBId - L'ID de la deuxième équipe.
     * @returns {boolean} Vrai si elles ont déjà joué, faux sinon.
     */
    function hasTeamsPlayedAnywhere(teamAId, teamBId) {
        const canonicalKey = [teamAId, teamBId].sort().join('-');
        return matchOccurrences.has(canonicalKey) && matchOccurrences.get(canonicalKey).size > 0;
    }

    // --- Gestion des Données (Firestore) ---

    /**
     * Chemin du document Firestore pour les données du tournoi de l'utilisateur.
     * @returns {import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").DocumentReference|null} La référence du document ou null si Firebase n'est pas prêt.
     */
    function getUserTournamentDocRef() {
        if (window.db && window.userId && window.appId) {
            return window.doc(window.db, 'artifacts', window.appId, 'users', window.userId, 'tournamentData', 'currentTournament');
        }
        console.error("Firebase ou User ID non initialisé.");
        return null;
    }

    /**
     * Sauvegarde toutes les données du tournoi dans Firestore.
     * Cette fonction est appelée chaque fois que des données sont modifiées.
     */
    async function saveAllData() {
        const docRef = getUserTournamentDocRef();
        if (!docRef) {
            showToast("Erreur: Impossible de sauvegarder les données, Firebase non prêt.", "error");
            return;
        }

        try {
            const dataToSave = {
                allTeams: allTeams,
                allBrassagePhases: allBrassagePhases,
                eliminationPhases: eliminationPhases,
                currentSecondaryGroupsPreview: currentSecondaryGroupsPreview,
                // Convertir le Set en Array pour le stockage Firestore
                eliminatedTeams: Array.from(eliminatedTeams),
                // Stocker également l'ID de la phase actuellement affichée pour la persistance de l'état de l'UI
                currentDisplayedPhaseId: currentDisplayedPhaseId
            };
            await window.setDoc(docRef, dataToSave);
            console.log("Données sauvegardées avec succès dans Firestore.");
            // showToast("Données sauvegardées.", "success"); // Peut être trop fréquent
        } catch (e) {
            console.error("Erreur lors de la sauvegarde des données dans Firestore:", e);
            showToast("Erreur lors de la sauvegarde des données.", "error");
        }
    }

    /**
     * Charge toutes les données du tournoi depuis Firestore.
     * Met également en place un listener en temps réel.
     */
    async function loadAllData() {
        const docRef = getUserTournamentDocRef();
        if (!docRef) {
            // Attendre que Firebase soit prêt si ce n'est pas le cas
            // Ceci est géré par l'écouteur onAuthStateChanged dans index.html
            // qui appelle potentiellement loadAllDataFromFirestore si nécessaire.
            // Pour l'instant, on se contente de logguer et de sortir.
            console.warn("Firebase non prêt lors du chargement des données. Tentative de réessai...");
            // On peut ajouter un petit délai et réessayer ou attendre un événement custom
            return;
        }

        // Mettre en place un listener en temps réel
        window.onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                allTeams = data.allTeams || [];
                allBrassagePhases = data.allBrassagePhases || [];
                eliminationPhases = data.eliminationPhases || {};
                currentSecondaryGroupsPreview = data.currentSecondaryGroupsPreview || {};
                // Convertir l'Array en Set lors du chargement
                eliminatedTeams = new Set(data.eliminatedTeams || []);
                currentDisplayedPhaseId = data.currentDisplayedPhaseId || null;

                console.log("Données chargées ou mises à jour depuis Firestore.");
                // showToast("Données chargées.", "info"); // Peut être trop fréquent

                // Reconstruire matchOccurrences après le chargement des phases
                rebuildMatchOccurrences();

                // Rendre la page après le chargement initial des données
                // ou après une mise à jour en temps réel
                handleLocationHash();
            } else {
                console.log("Aucune donnée trouvée dans Firestore. Initialisation des données par défaut.");
                // Si aucune donnée n'existe, on peut initialiser avec des valeurs par défaut
                // et les sauvegarder pour créer le document.
                allTeams = [];
                allBrassagePhases = [];
                eliminationPhases = {};
                currentSecondaryGroupsPreview = {};
                eliminatedTeams = new Set();
                currentDisplayedPhaseId = null;
                saveAllData(); // Crée le document initial dans Firestore
                handleLocationHash(); // Rendre la page vide
            }
        }, (error) => {
            console.error("Erreur lors de l'écoute des données Firestore:", error);
            showToast("Erreur de synchronisation des données.", "error");
        });
    }

    /**
     * Reconstruit la map `matchOccurrences` à partir de `allBrassagePhases`.
     * Ceci est nécessaire après le chargement des données depuis Firestore.
     */
    function rebuildMatchOccurrences() {
        matchOccurrences.clear(); // Vider la map existante
        for (const phase of allBrassagePhases) {
            for (const pool of phase.pools) {
                for (const match of pool.matches) {
                    if (match.teamA && match.teamB) { // S'assurer que les équipes sont définies
                        updateMatchOccurrence(match.teamA, match.teamB, phase.id);
                    }
                }
            }
        }
        console.log("Map des occurrences de matchs reconstruite.");
    }
    // --- Fonctions de Gestion des Équipes ---

    /**
     * Ajoute une nouvelle équipe.
     * @param {string} name - Le nom de l'équipe.
     */
    function addTeam(name) {
        if (!name.trim()) {
            showToast("Le nom de l'équipe ne peut pas être vide.", "error");
            return;
        }
        if (allTeams.some(team => team.name.toLowerCase() === name.toLowerCase())) {
            showToast("Une équipe avec ce nom existe déjà.", "error");
            return;
        }
        const newTeam = {
            id: generateUUID(),
            name: name.trim()
        };
        allTeams.push(newTeam);
        saveAllData();
        renderTeamsPage();
        showToast(`Équipe "${name}" ajoutée.`, "success");
    }

    /**
     * Met à jour le nom d'une équipe.
     * @param {string} id - L'ID de l'équipe à mettre à jour.
     * @param {string} newName - Le nouveau nom de l'équipe.
     */
    function updateTeam(id, newName) {
        if (!newName.trim()) {
            showToast("Le nom de l'équipe ne peut pas être vide.", "error");
            return;
        }
        if (allTeams.some(team => team.name.toLowerCase() === newName.toLowerCase() && team.id !== id)) {
            showToast("Une autre équipe avec ce nom existe déjà.", "error");
            return;
        }
        const teamIndex = allTeams.findIndex(team => team.id === id);
        if (teamIndex !== -1) {
            allTeams[teamIndex].name = newName.trim();
            saveAllData();
            renderTeamsPage();
            showToast(`Équipe "${newName}" mise à jour.`, "success");
        } else {
            showToast("Équipe non trouvée.", "error");
        }
    }

    /**
     * Supprime une équipe.
     * @param {string} id - L'ID de l'équipe à supprimer.
     */
    function deleteTeam(id) {
        // Vérifier si l'équipe est impliquée dans une phase de brassage ou d'élimination
        const isTeamInBrassage = allBrassagePhases.some(phase =>
            phase.pools.some(pool =>
                pool.teams.includes(id) || pool.matches.some(match => match.teamA === id || match.teamB === id)
            )
        );

        const isTeamInElimination = Object.values(eliminationPhases).some(phase =>
            phase.matches.some(match => match.teamA === id || match.teamB === id)
        );

        if (isTeamInBrassage || isTeamInElimination) {
            showModal(
                "Impossible de supprimer l'équipe",
                `<p>L'équipe est impliquée dans des phases de tournoi existantes (brassage ou élimination). Vous ne pouvez pas la supprimer.</p>`,
                null, // Pas de confirmation
                "OK",
                "Fermer"
            );
            return;
        }

        showModal(
            "Confirmer la suppression",
            `<p>Êtes-vous sûr de vouloir supprimer cette équipe ? Cette action est irréversible.</p>`,
            () => {
                allTeams = allTeams.filter(team => team.id !== id);
                eliminatedTeams.delete(id); // S'assurer qu'elle est retirée des équipes éliminées si elle y était
                saveAllData();
                renderTeamsPage();
                showToast("Équipe supprimée.", "success");
            }
        );
    }

    // --- Fonctions de Gestion des Phases de Brassage ---

    /**
     * Ajoute une nouvelle phase de brassage.
     * @param {string} name - Le nom de la phase.
     * @param {string[]} selectedTeamIds - Les IDs des équipes sélectionnées pour cette phase.
     */
    function addBrassagePhase(name, selectedTeamIds) {
        if (!name.trim()) {
            showToast("Le nom de la phase ne peut pas être vide.", "error");
            return;
        }
        if (allBrassagePhases.some(phase => phase.name.toLowerCase() === name.toLowerCase())) {
            showToast("Une phase avec ce nom existe déjà.", "error");
            return;
        }
        if (selectedTeamIds.length < 2) {
            showToast("Une phase de brassage nécessite au moins deux équipes.", "error");
            return;
        }

        const newPhase = {
            id: generateUUID(),
            name: name.trim(),
            type: PHASE_TYPE_INITIAL, // Type initial par défaut
            teams: selectedTeamIds,
            pools: [], // Les poules seront générées séparément
            // Ajout d'un statut pour la phase
            status: 'pending', // 'pending', 'in_progress', 'completed'
            creationDate: new Date().toISOString()
        };
        allBrassagePhases.push(newPhase);
        saveAllData();
        renderBrassagePhasesPage();
        showToast(`Phase "${name}" ajoutée.`, "success");
    }

    /**
     * Supprime une phase de brassage.
     * @param {string} phaseId - L'ID de la phase à supprimer.
     */
    function deleteBrassagePhase(phaseId) {
        showModal(
            "Confirmer la suppression",
            `<p>Êtes-vous sûr de vouloir supprimer cette phase de brassage ? Cette action est irréversible.</p>`,
            () => {
                allBrassagePhases = allBrassagePhases.filter(phase => phase.id !== phaseId);
                // Mettre à jour currentDisplayedPhaseId si la phase supprimée était affichée
                if (currentDisplayedPhaseId === phaseId) {
                    currentDisplayedPhaseId = null;
                }
                // Nettoyer les occurrences de matchs liées à cette phase
                matchOccurrences.forEach((phaseIds, key) => {
                    phaseIds.delete(phaseId);
                    if (phaseIds.size === 0) {
                        matchOccurrences.delete(key);
                    }
                });
                saveAllData();
                renderBrassagePhasesPage();
                showToast("Phase de brassage supprimée.", "success");
            }
        );
    }

    /**
     * Génère les poules pour une phase de brassage.
     * @param {string} phaseId - L'ID de la phase.
     * @param {number} numPools - Le nombre de poules à générer.
     * @param {string} basis - La base de génération ('teams' ou 'ranking').
     */
    function generatePools(phaseId, numPools, basis) {
        const phase = allBrassagePhases.find(p => p.id === phaseId);
        if (!phase) {
            showToast("Phase non trouvée.", "error");
            return;
        }

        if (numPools <= 0 || numPools > phase.teams.length) {
            showToast("Le nombre de poules n'est pas valide.", "error");
            return;
        }

        // Filtrer les équipes éliminées si la base est 'ranking'
        const availableTeams = phase.teams.filter(teamId => !eliminatedTeams.has(teamId));

        if (availableTeams.length < numPools) {
            showToast("Pas assez d'équipes disponibles pour le nombre de poules demandé (après exclusion des équipes éliminées).", "error");
            return;
        }

        let teamsToDistribute = [...availableTeams]; // Copie mutable

        if (basis === 'ranking') {
            // Calculer le classement des équipes disponibles
            const rankedTeams = teamsToDistribute.map(teamId => {
                const team = allTeams.find(t => t.id === teamId);
                if (!team) return null; // Should not happen
                return {
                    id: team.id,
                    name: team.name,
                    wins: calculateWins(team.id, phase),
                    setRatio: calculateSetRatio(team.id, phase)
                };
            }).filter(Boolean);

            // Trier les équipes par victoires (desc) puis par ratio de sets (desc)
            rankedTeams.sort((a, b) => {
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }
                return b.setRatio - a.setRatio;
            });

            teamsToDistribute = rankedTeams.map(team => team.id);
        } else { // basis === 'teams' ou autre (aléatoire)
            // Mélanger les équipes pour une distribution aléatoire
            for (let i = teamsToDistribute.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [teamsToDistribute[i], teamsToDistribute[j]] = [teamsToDistribute[j], teamsToDistribute[i]];
            }
        }

        const newPools = Array.from({
            length: numPools
        }, (_, i) => ({
            id: generateUUID(),
            name: `Poule ${i + 1}`,
            teams: [],
            matches: []
        }));

        // Distribuer les équipes dans les poules de manière équitable (serpentine)
        for (let i = 0; i < teamsToDistribute.length; i++) {
            const teamId = teamsToDistribute[i];
            const poolIndex = i % numPools;
            newPools[poolIndex].teams.push(teamId);
        }

        // Générer les matchs pour chaque poule (toutes contre toutes)
        for (const pool of newPools) {
            for (let i = 0; i < pool.teams.length; i++) {
                for (let j = i + 1; j < pool.teams.length; j++) {
                    const teamA = pool.teams[i];
                    const teamB = pool.teams[j];
                    // Vérifier si les équipes ont déjà joué dans cette phase
                    if (!hasTeamsPlayedInPhase(teamA, teamB, phaseId)) {
                        pool.matches.push({
                            id: generateUUID(),
                            teamA: teamA,
                            teamB: teamB,
                            scoreA: null,
                            scoreB: null
                        });
                        updateMatchOccurrence(teamA, teamB, phaseId);
                    } else {
                        console.warn(`Match entre ${allTeams.find(t=>t.id===teamA)?.name} et ${allTeams.find(t=>t.id===teamB)?.name} déjà joué dans cette phase. Ignoré.`);
                    }
                }
            }
        }

        phase.pools = newPools;
        phase.status = 'in_progress'; // La phase passe en cours
        saveAllData();
        renderPhaseDetails(phaseId);
        showToast("Poules générées avec succès.", "success");
    }


    /**
     * Met à jour les scores d'un match.
     * @param {string} phaseId - L'ID de la phase.
     * @param {string} poolId - L'ID de la poule.
     * @param {string} matchId - L'ID du match.
     * @param {number} scoreA - Le score de l'équipe A.
     * @param {number} scoreB - Le score de l'équipe B.
     */
    function updateMatchScore(phaseId, poolId, matchId, scoreA, scoreB) {
        const phase = allBrassagePhases.find(p => p.id === phaseId);
        if (!phase) {
            showToast("Phase non trouvée.", "error");
            return;
        }
        const pool = phase.pools.find(p => p.id === poolId);
        if (!pool) {
            showToast("Poule non trouvée.", "error");
            return;
        }
        const match = pool.matches.find(m => m.id === matchId);
        if (!match) {
            showToast("Match non trouvé.", "error");
            return;
        }

        const parsedScoreA = parseInt(scoreA);
        const parsedScoreB = parseInt(scoreB);

        if (isNaN(parsedScoreA) || isNaN(parsedScoreB) || parsedScoreA < 0 || parsedScoreB < 0) {
            showToast("Scores invalides. Veuillez entrer des nombres positifs.", "error");
            return;
        }

        match.scoreA = parsedScoreA;
        match.scoreB = parsedScoreB;
        saveAllData();
        renderPhaseDetails(phaseId); // Re-render pour mettre à jour le tableau des scores
        showToast("Score mis à jour.", "success");
    }

    /**
     * Marque une phase de brassage comme terminée.
     * @param {string} phaseId - L'ID de la phase.
     */
    function completeBrassagePhase(phaseId) {
        const phase = allBrassagePhases.find(p => p.id === phaseId);
        if (!phase) {
            showToast("Phase non trouvée.", "error");
            return;
        }

        // Vérifier si tous les matchs ont un score
        const allMatchesPlayed = phase.pools.every(pool =>
            pool.matches.every(match => match.scoreA !== null && match.scoreB !== null)
        );

        if (!allMatchesPlayed) {
            showModal(
                "Phase incomplète",
                `<p>Tous les matchs de cette phase n'ont pas encore été joués. Veuillez saisir tous les scores avant de terminer la phase.</p>`,
                null,
                "OK"
            );
            return;
        }

        showModal(
            "Terminer la phase",
            `<p>Êtes-vous sûr de vouloir terminer la phase "${phase.name}" ? Une fois terminée, vous ne pourrez plus modifier les scores.</p>`,
            () => {
                phase.status = 'completed';
                saveAllData();
                renderPhaseDetails(phaseId);
                showToast(`Phase "${phase.name}" terminée.`, "success");
            }
        );
    }

    // --- Fonctions de Gestion des Phases d'Élimination ---

    /**
     * Ajoute une nouvelle phase d'élimination.
     * @param {string} name - Le nom de la phase.
     * @param {string} type - Le type de phase (ex: 'Quarts de finale', 'Demi-finales', 'Finale').
     * @param {string[]} teamIds - Les IDs des équipes participant à cette phase.
     */
    function addEliminationPhase(name, type, teamIds) {
        if (!name.trim() || !type.trim()) {
            showToast("Le nom et le type de la phase ne peuvent pas être vides.", "error");
            return;
        }
        if (eliminationPhases[name]) {
            showToast("Une phase d'élimination avec ce nom existe déjà.", "error");
            return;
        }
        if (teamIds.length < 2) {
            showToast("Une phase d'élimination nécessite au moins deux équipes.", "error");
            return;
        }
        if (teamIds.length % 2 !== 0) {
            showToast("Le nombre d'équipes pour une phase d'élimination doit être pair.", "error");
            return;
        }

        // Filtrer les équipes éliminées
        const availableTeams = teamIds.filter(teamId => !eliminatedTeams.has(teamId));
        if (availableTeams.length !== teamIds.length) {
            showToast("Des équipes sélectionnées sont déjà éliminées. Veuillez revoir votre sélection.", "error");
            return;
        }
        if (availableTeams.length % 2 !== 0) {
            showToast("Le nombre d'équipes disponibles pour cette phase d'élimination doit être pair.", "error");
            return;
        }

        // Générer les matchs par paires aléatoires
        const shuffledTeams = [...availableTeams].sort(() => Math.random() - 0.5);
        const matches = [];
        for (let i = 0; i < shuffledTeams.length; i += 2) {
            matches.push({
                id: generateUUID(),
                teamA: shuffledTeams[i],
                teamB: shuffledTeams[i + 1],
                scoreA: null,
                scoreB: null,
                winner: null,
                loser: null // Ajout du perdant
            });
        }

        const newEliminationPhase = {
            id: generateUUID(),
            name: name.trim(),
            type: type.trim(),
            teams: availableTeams, // Les équipes qui *commencent* cette phase
            matches: matches,
            status: 'pending', // 'pending', 'in_progress', 'completed'
            creationDate: new Date().toISOString()
        };

        eliminationPhases[newEliminationPhase.id] = newEliminationPhase;
        saveAllData();
        renderEliminationPhasesPage();
        showToast(`Phase d'élimination "${name}" ajoutée.`, "success");
    }

    /**
     * Met à jour les scores d'un match d'élimination et détermine le gagnant/perdant.
     * @param {string} phaseId - L'ID de la phase d'élimination.
     * @param {string} matchId - L'ID du match.
     * @param {number} scoreA - Le score de l'équipe A.
     * @param {number} scoreB - Le score de l'équipe B.
     */
    function updateEliminationMatchScore(phaseId, matchId, scoreA, scoreB) {
        const phase = eliminationPhases[phaseId];
        if (!phase) {
            showToast("Phase d'élimination non trouvée.", "error");
            return;
        }
        const match = phase.matches.find(m => m.id === matchId);
        if (!match) {
            showToast("Match non trouvé.", "error");
            return;
        }

        const parsedScoreA = parseInt(scoreA);
        const parsedScoreB = parseInt(scoreB);

        if (isNaN(parsedScoreA) || isNaN(parsedScoreB) || parsedScoreA < 0 || parsedScoreB < 0) {
            showToast("Scores invalides. Veuillez entrer des nombres positifs.", "error");
            return;
        }

        match.scoreA = parsedScoreA;
        match.scoreB = parsedScoreB;

        if (parsedScoreA > parsedScoreB) {
            match.winner = match.teamA;
            match.loser = match.teamB;
            eliminatedTeams.add(match.teamB); // Ajouter le perdant aux équipes éliminées
        } else if (parsedScoreB > parsedScoreA) {
            match.winner = match.teamB;
            match.loser = match.teamA;
            eliminatedTeams.add(match.teamA); // Ajouter le perdant aux équipes éliminées
        } else {
            match.winner = null; // Match nul, pas de gagnant/perdant défini
            match.loser = null;
            // Si le score devient nul après avoir eu un gagnant/perdant, retirer les équipes éliminées
            if (eliminatedTeams.has(match.teamA)) eliminatedTeams.delete(match.teamA);
            if (eliminatedTeams.has(match.teamB)) eliminatedTeams.delete(match.teamB);
        }

        // Mettre à jour le statut de la phase si tous les matchs sont joués
        const allMatchesPlayed = phase.matches.every(m => m.scoreA !== null && m.scoreB !== null);
        if (allMatchesPlayed) {
            phase.status = 'completed';
        } else {
            phase.status = 'in_progress';
        }

        saveAllData();
        renderEliminationPhaseDetails(phaseId);
        showToast("Score d'élimination mis à jour.", "success");
    }

    /**
     * Marque une phase d'élimination comme terminée.
     * @param {string} phaseId - L'ID de la phase.
     */
    function completeEliminationPhase(phaseId) {
        const phase = eliminationPhases[phaseId];
        if (!phase) {
            showToast("Phase d'élimination non trouvée.", "error");
            return;
        }

        // Vérifier si tous les matchs ont un score et un gagnant
        const allMatchesCompleted = phase.matches.every(match => match.winner !== null);

        if (!allMatchesCompleted) {
            showModal(
                "Phase incomplète",
                `<p>Tous les matchs de cette phase n'ont pas encore été joués ou n'ont pas de gagnant défini. Veuillez saisir tous les scores avant de terminer la phase.</p>`,
                null,
                "OK"
            );
            return;
        }

        showModal(
            "Terminer la phase d'élimination",
            `<p>Êtes-vous sûr de vouloir terminer la phase "${phase.name}" ? Une fois terminée, vous ne pourrez plus modifier les scores.</p>`,
            () => {
                phase.status = 'completed';
                saveAllData();
                renderEliminationPhaseDetails(phaseId);
                showToast(`Phase d'élimination "${phase.name}" terminée.`, "success");
            }
        );
    }

    /**
     * Supprime une phase d'élimination.
     * @param {string} phaseId - L'ID de la phase à supprimer.
     */
    function deleteEliminationPhase(phaseId) {
        showModal(
            "Confirmer la suppression",
            `<p>Êtes-vous sûr de vouloir supprimer cette phase d'élimination ? Cette action est irréversible.</p>`,
            () => {
                const phaseToDelete = eliminationPhases[phaseId];
                if (phaseToDelete) {
                    // Retirer les équipes perdantes de cette phase du set des équipes éliminées
                    phaseToDelete.matches.forEach(match => {
                        if (match.loser) {
                            eliminatedTeams.delete(match.loser);
                        }
                    });
                    delete eliminationPhases[phaseId];
                    saveAllData();
                    renderEliminationPhasesPage();
                    showToast("Phase d'élimination supprimée.", "success");
                }
            }
        );
    }

    // --- Fonctions de Rendu des Pages ---

    /**
     * Vide le conteneur principal de l'application.
     */
    function clearAppContainer() {
        APP_CONTAINER.innerHTML = '';
    }

    /**
     * Rend la page d'accueil.
     */
    function renderHomePage() {
        clearAppContainer();
        APP_CONTAINer.className = 'p-6 bg-gray-100 min-h-screen flex flex-col items-center justify-center';
        APP_CONTAINER.innerHTML = `
            <div class="text-center p-8 bg-white rounded-xl shadow-lg max-w-2xl w-full">
                <h1 class="text-5xl font-extrabold text-blue-800 mb-6 animate-fade-in-down">Bienvenue sur EasyPlay !</h1>
                <p class="text-lg text-gray-700 mb-8 leading-relaxed animate-fade-in-up">
                    Votre outil simple et efficace pour gérer vos tournois sportifs.
                    Créez des équipes, organisez des phases de brassage et d'élimination,
                    et suivez les scores en temps réel.
                </p>
                <div class="space-y-4 md:space-x-4 md:space-y-0 flex flex-col md:flex-row justify-center">
                    <a href="#teams" class="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105">
                        <i class="fas fa-users mr-3 text-xl"></i> Gérer les Équipes
                    </a>
                    <a href="#brassage-phases" class="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-full shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105">
                        <i class="fas fa-sitemap mr-3 text-xl"></i> Phases de Brassage
                    </a>
                    <a href="#elimination-phases" class="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-full shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105">
                        <i class="fas fa-trophy mr-3 text-xl"></i> Phases d'Élimination
                    </a>
                </div>
            </div>
        `;
    }

    /**
     * Rend la page de gestion des équipes.
     */
    function renderTeamsPage() {
        clearAppContainer();
        APP_CONTAINer.className = 'p-6 bg-gray-100 min-h-screen';
        const teamListHtml = allTeams.length === 0 ?
            '<p class="text-gray-600 text-center col-span-full">Aucune équipe enregistrée pour le moment.</p>' :
            allTeams.map(team => `
            <li class="bg-white p-4 rounded-lg shadow flex items-center justify-between transition-transform transform hover:scale-[1.02] duration-200 ease-in-out">
                <span class="text-lg font-medium text-gray-800 flex-grow" id="team-name-${team.id}">${team.name}</span>
                <div class="flex space-x-2">
                    <button onclick="editTeamName('${team.id}')" class="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-full transition-colors duration-200" title="Modifier le nom">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTeam('${team.id}')" class="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors duration-200" title="Supprimer l'équipe">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `).join('');

        APP_CONTAINER.innerHTML = `
            <div class="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h2 class="text-3xl font-bold text-blue-700 mb-6 text-center">Gestion des Équipes</h2>

                <!-- Formulaire d'ajout d'équipe -->
                <div class="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
                    <h3 class="text-2xl font-semibold text-blue-600 mb-4">Ajouter une Nouvelle Équipe</h3>
                    <div class="flex flex-col sm:flex-row gap-4">
                        <input type="text" id="newTeamName" placeholder="Nom de l'équipe"
                               class="flex-grow p-3 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                               onkeypress="if(event.key === 'Enter') document.getElementById('addTeamBtn').click()">
                        <button id="addTeamBtn"
                                class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center">
                            <i class="fas fa-plus-circle mr-2"></i> Ajouter l'équipe
                        </button>
                    </div>
                </div>

                <!-- Liste des équipes existantes -->
                <div class="mb-8">
                    <h3 class="text-2xl font-semibold text-blue-600 mb-4">Équipes Enregistrées</h3>
                    <ul class="space-y-4">
                        ${teamListHtml}
                    </ul>
                </div>

                <!-- Boutons d'import/export -->
                <div class="flex flex-wrap justify-center gap-4 mt-8">
                    <button id="importTeamsBtn"
                            class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center">
                        <i class="fas fa-file-excel mr-2"></i> Importer des équipes (Excel)
                    </button>
                    <button id="exportTeamsBtn"
                            class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center">
                        <i class="fas fa-download mr-2"></i> Exporter les équipes (Excel)
                    </button>
                </div>
            </div>
        `;

        document.getElementById('addTeamBtn').addEventListener('click', () => {
            const newTeamNameInput = document.getElementById('newTeamName');
            addTeam(newTeamNameInput.value);
            newTeamNameInput.value = ''; // Réinitialiser le champ
        });

        // Exposer les fonctions au scope global pour les onclick dans le HTML injecté
        window.editTeamName = function(id) {
            const teamNameSpan = document.getElementById(`team-name-${id}`);
            const currentName = teamNameSpan.textContent;
            showModal(
                "Modifier le nom de l'équipe",
                `<input type="text" id="editTeamNameInput" class="w-full p-2 border rounded" value="${currentName}">`,
                () => {
                    const newName = document.getElementById('editTeamNameInput').value;
                    updateTeam(id, newName);
                },
                "Enregistrer",
                "Annuler"
            );
        };
        window.deleteTeam = deleteTeam; // Exposer la fonction deleteTeam

        // Gestionnaires pour import/export Excel
        document.getElementById('importTeamsBtn').addEventListener('click', importTeamsFromExcel);
        document.getElementById('exportTeamsBtn').addEventListener('click', exportTeamsToExcel);
    }

    /**
     * Rend la page de gestion des phases de brassage.
     */
    function renderBrassagePhasesPage() {
        clearAppContainer();
        APP_CONTAINER.className = 'p-6 bg-gray-100 min-h-screen';

        const phaseListHtml = allBrassagePhases.length === 0 ?
            '<p class="text-gray-600 text-center col-span-full">Aucune phase de brassage enregistrée pour le moment.</p>' :
            allBrassagePhases.map(phase => `
            <li class="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row items-start sm:items-center justify-between transition-transform transform hover:scale-[1.02] duration-200 ease-in-out">
                <div class="flex-grow mb-2 sm:mb-0">
                    <span class="text-xl font-semibold text-blue-800">${phase.name}</span>
                    <p class="text-sm text-gray-500">Créée le: ${new Date(phase.creationDate).toLocaleDateString()}</p>
                    <p class="text-sm text-gray-600">Statut: <span class="font-bold ${phase.status === 'completed' ? 'text-green-600' : (phase.status === 'in_progress' ? 'text-yellow-600' : 'text-gray-500')}">${phase.status === 'pending' ? 'En attente' : (phase.status === 'in_progress' ? 'En cours' : 'Terminée')}</span></p>
                    <p class="text-sm text-gray-600">Équipes: ${phase.teams.length}</p>
                </div>
                <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button onclick="displayPhaseDetails('${phase.id}')" class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full transition-colors duration-200" title="Voir les détails">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="deleteBrassagePhase('${phase.id}')" class="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors duration-200" title="Supprimer la phase">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `).join('');

        const availableTeamsForSelection = allTeams.filter(team => !eliminatedTeams.has(team.id));
        const teamOptionsHtml = availableTeamsForSelection.length === 0 ?
            '<p class="text-gray-600">Aucune équipe disponible pour la sélection. Ajoutez des équipes d\'abord.</p>' :
            availableTeamsForSelection.map(team => `
            <label class="inline-flex items-center">
                <input type="checkbox" name="selectedTeams" value="${team.id}" class="form-checkbox h-5 w-5 text-blue-600 rounded">
                <span class="ml-2 text-gray-700">${team.name}</span>
            </label>
        `).join('');

        APP_CONTAINER.innerHTML = `
            <div class="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h2 class="text-3xl font-bold text-blue-700 mb-6 text-center">Gestion des Phases de Brassage</h2>

                <!-- Formulaire d'ajout de phase de brassage -->
                <div class="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
                    <h3 class="text-2xl font-semibold text-blue-600 mb-4">Ajouter une Nouvelle Phase</h3>
                    <div class="flex flex-col gap-4 mb-4">
                        <input type="text" id="newBrassagePhaseName" placeholder="Nom de la phase de brassage"
                               class="p-3 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-800">
                        <div class="flex flex-wrap gap-x-4 gap-y-2">
                            ${teamOptionsHtml}
                        </div>
                    </div>
                    <button id="addBrassagePhaseBtn"
                            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center w-full">
                        <i class="fas fa-plus-circle mr-2"></i> Créer la phase
                    </button>
                </div>

                <!-- Liste des phases de brassage existantes -->
                <div class="mb-8">
                    <h3 class="text-2xl font-semibold text-blue-600 mb-4">Phases Existantes</h3>
                    <ul class="space-y-4">
                        ${phaseListHtml}
                    </ul>
                </div>
            </div>
        `;

        document.getElementById('addBrassagePhaseBtn').addEventListener('click', () => {
            const name = document.getElementById('newBrassagePhaseName').value;
            const selectedTeamIds = Array.from(document.querySelectorAll('input[name="selectedTeams"]:checked'))
                .map(checkbox => checkbox.value);
            addBrassagePhase(name, selectedTeamIds);
            // Réinitialiser les champs
            document.getElementById('newBrassagePhaseName').value = '';
            document.querySelectorAll('input[name="selectedTeams"]:checked').forEach(checkbox => checkbox.checked = false);
        });

        // Exposer les fonctions au scope global pour les onclick dans le HTML injecté
        window.displayPhaseDetails = displayPhaseDetails;
        window.deleteBrassagePhase = deleteBrassagePhase;
    }

    /**
     * Rend les détails d'une phase de brassage spécifique.
     * @param {string} phaseId - L'ID de la phase à afficher.
     */
    function renderPhaseDetails(phaseId) {
        currentDisplayedPhaseId = phaseId; // Mettre à jour la phase affichée
        saveAllData(); // Sauvegarder l'état de l'UI
        clearAppContainer();
        APP_CONTAINER.className = 'p-6 bg-gray-100 min-h-screen';

        const phase = allBrassagePhases.find(p => p.id === phaseId);
        if (!phase) {
            APP_CONTAINER.innerHTML = `<p class="text-red-500 text-center">Phase non trouvée.</p>`;
            return;
        }

        const isPhaseCompleted = phase.status === 'completed';

        // Tableau de classement
        let rankingTableHtml = '';
        if (phase.pools.length > 0) {
            const teamStats = {}; // { teamId: { matchesPlayed, wins, setsWon, setsLost, setRatio } }

            // Initialiser les stats pour toutes les équipes de la phase
            phase.teams.forEach(teamId => {
                teamStats[teamId] = {
                    matchesPlayed: 0,
                    wins: 0,
                    setsWon: 0,
                    setsLost: 0,
                    setRatio: 0
                };
            });

            // Calculer les stats pour chaque équipe
            for (const pool of phase.pools) {
                for (const match of pool.matches) {
                    if (match.scoreA !== null && match.scoreB !== null) {
                        const teamAId = match.teamA;
                        const teamBId = match.teamB;

                        teamStats[teamAId].matchesPlayed++;
                        teamStats[teamBId].matchesPlayed++;

                        teamStats[teamAId].setsWon += match.scoreA;
                        teamStats[teamAId].setsLost += match.scoreB;
                        teamStats[teamBId].setsWon += match.scoreB;
                        teamStats[teamBId].setsLost += match.scoreA;

                        if (match.scoreA > match.scoreB) {
                            teamStats[teamAId].wins++;
                        } else if (match.scoreB > match.scoreA) {
                            teamStats[teamBId].wins++;
                        }
                    }
                }
            }

            // Calculer le ratio de sets et préparer les données pour le tri
            const rankedTeamsData = Object.keys(teamStats).map(teamId => {
                const stats = teamStats[teamId];
                const setsWon = stats.setsWon;
                const setsLost = stats.setsLost;
                const setRatio = setsLost === 0 ? (setsWon === 0 ? 0 : setsWon) : setsWon / setsLost;

                return {
                    team: allTeams.find(t => t.id === teamId)?.name || `Équipe Inconnue (${teamId})`,
                    matchesPlayed: stats.matchesPlayed,
                    wins: stats.wins,
                    setsWon: setsWon,
                    setsLost: setsLost,
                    setRatio: setRatio.toFixed(2) // Arrondir pour l'affichage
                };
            });

            // Trier les équipes: 1. Victoires (desc), 2. Ratio de sets (desc)
            rankedTeamsData.sort((a, b) => {
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }
                return parseFloat(b.setRatio) - parseFloat(a.setRatio);
            });

            rankingTableHtml = `
                <h3 class="text-2xl font-semibold text-blue-600 mb-4">Classement de la Phase</h3>
                <div class="overflow-x-auto bg-white rounded-lg shadow mb-8">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Équipe</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matchs Joués</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Victoires</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sets Gagnés</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sets Perdus</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ratio Sets</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${rankedTeamsData.map(data => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${data.team}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.matchesPlayed}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.wins}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.setsWon}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.setsLost}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.setRatio}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }


        const poolsHtml = phase.pools.length === 0 ?
            `<p class="text-gray-600 text-center">Aucune poule générée pour cette phase.</p>` :
            phase.pools.map(pool => `
            <div class="bg-blue-50 p-4 rounded-lg shadow-inner mb-6">
                <h4 class="text-xl font-semibold text-blue-700 mb-3">${pool.name}</h4>
                <p class="text-gray-700 mb-3">Équipes: ${pool.teams.map(id => allTeams.find(t => t.id === id)?.name || 'Inconnue').join(', ')}</p>
                <div class="space-y-3">
                    ${pool.matches.map(match => `
                        <div class="flex flex-col sm:flex-row items-center justify-between bg-white p-3 rounded-md shadow-sm">
                            <span class="font-medium text-gray-800 mb-2 sm:mb-0">
                                ${allTeams.find(t => t.id === match.teamA)?.name || 'Équipe A'} vs
                                ${allTeams.find(t => t.id === match.teamB)?.name || 'Équipe B'}
                            </span>
                            <div class="flex items-center space-x-2">
                                <input type="number" value="${match.scoreA !== null ? match.scoreA : ''}"
                                       id="scoreA-${match.id}" placeholder="Score A" min="0"
                                       class="w-20 p-2 border rounded-md text-center ${isPhaseCompleted ? 'bg-gray-100 cursor-not-allowed' : ''}"
                                       ${isPhaseCompleted ? 'disabled' : ''}>
                                <span>-</span>
                                <input type="number" value="${match.scoreB !== null ? match.scoreB : ''}"
                                       id="scoreB-${match.id}" placeholder="Score B" min="0"
                                       class="w-20 p-2 border rounded-md text-center ${isPhaseCompleted ? 'bg-gray-100 cursor-not-allowed' : ''}"
                                       ${isPhaseCompleted ? 'disabled' : ''}>
                                ${!isPhaseCompleted ? `
                                <button onclick="updateMatchScore('${phase.id}', '${pool.id}', '${match.id}',
                                    document.getElementById('scoreA-${match.id}').value,
                                    document.getElementById('scoreB-${match.id}').value)"
                                    class="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full transition-colors duration-200" title="Enregistrer le score">
                                    <i class="fas fa-save"></i>
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        const generatePoolsSection = phase.pools.length === 0 && !isPhaseCompleted ? `
            <div class="mb-8 p-6 bg-green-50 rounded-lg shadow-inner">
                <h3 class="text-2xl font-semibold text-green-600 mb-4">Générer les Poules</h3>
                <div class="flex flex-col sm:flex-row gap-4 mb-4">
                    <input type="number" id="numPools" placeholder="Nombre de poules" min="1"
                           class="flex-grow p-3 border border-green-300 rounded-md focus:ring-green-500 focus:border-green-500 text-gray-800">
                    <select id="poolGenerationBasis" class="flex-grow p-3 border border-green-300 rounded-md focus:ring-green-500 focus:border-green-500 text-gray-800">
                        <option value="teams">Distribution Aléatoire</option>
                        <option value="ranking">Basé sur le Classement Actuel</option>
                    </select>
                </div>
                <button id="generatePoolsBtn"
                        class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center w-full">
                    <i class="fas fa-random mr-2"></i> Générer les poules
                </button>
            </div>
        ` : '';

        const completePhaseButton = !isPhaseCompleted ? `
            <button id="completePhaseBtn"
                    class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center w-full mt-6">
                <i class="fas fa-check-circle mr-2"></i> Terminer la Phase
            </button>
        ` : `<p class="text-center text-green-700 font-semibold text-lg mt-6">Cette phase est terminée.</p>`;


        APP_CONTAINER.innerHTML = `
            <div class="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h2 class="text-3xl font-bold text-blue-700 mb-4 text-center">${phase.name}</h2>
                <p class="text-gray-600 text-center mb-6">Statut: <span class="font-bold ${phase.status === 'completed' ? 'text-green-600' : (phase.status === 'in_progress' ? 'text-yellow-600' : 'text-gray-500')}">${phase.status === 'pending' ? 'En attente' : (phase.status === 'in_progress' ? 'En cours' : 'Terminée')}</span></p>

                ${rankingTableHtml}

                ${generatePoolsSection}

                <h3 class="text-2xl font-semibold text-blue-600 mb-4">Détails des Poules et Matchs</h3>
                <div class="space-y-6">
                    ${poolsHtml}
                </div>

                ${completePhaseButton}

                <div class="mt-8 text-center">
                    <a href="#brassage-phases" class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105">
                        <i class="fas fa-arrow-left mr-2"></i> Retour aux phases de brassage
                    </a>
                </div>
            </div>
        `;

        // Attacher les gestionnaires d'événements
        if (document.getElementById('generatePoolsBtn')) {
            document.getElementById('generatePoolsBtn').addEventListener('click', () => {
                const numPools = parseInt(document.getElementById('numPools').value);
                const basis = document.getElementById('poolGenerationBasis').value;
                generatePools(phaseId, numPools, basis);
            });
        }
        if (document.getElementById('completePhaseBtn')) {
            document.getElementById('completePhaseBtn').addEventListener('click', () => {
                completeBrassagePhase(phaseId);
            });
        }

        // Exposer la fonction updateMatchScore au scope global
        window.updateMatchScore = updateMatchScore;
    }

    /**
     * Rend la page de gestion des phases d'élimination.
     */
    function renderEliminationPhasesPage() {
        clearAppContainer();
        APP_CONTAINER.className = 'p-6 bg-gray-100 min-h-screen';

        const eliminationPhaseListHtml = Object.values(eliminationPhases).length === 0 ?
            '<p class="text-gray-600 text-center col-span-full">Aucune phase d\'élimination enregistrée pour le moment.</p>' :
            Object.values(eliminationPhases).map(phase => `
            <li class="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row items-start sm:items-center justify-between transition-transform transform hover:scale-[1.02] duration-200 ease-in-out">
                <div class="flex-grow mb-2 sm:mb-0">
                    <span class="text-xl font-semibold text-blue-800">${phase.name} (${phase.type})</span>
                    <p class="text-sm text-gray-500">Créée le: ${new Date(phase.creationDate).toLocaleDateString()}</p>
                    <p class="text-sm text-gray-600">Statut: <span class="font-bold ${phase.status === 'completed' ? 'text-green-600' : (phase.status === 'in_progress' ? 'text-yellow-600' : 'text-gray-500')}">${phase.status === 'pending' ? 'En attente' : (phase.status === 'in_progress' ? 'En cours' : 'Terminée')}</span></p>
                    <p class="text-sm text-gray-600">Équipes: ${phase.teams.length}</p>
                </div>
                <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button onclick="displayEliminationPhaseDetails('${phase.id}')" class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full transition-colors duration-200" title="Voir les détails">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="deleteEliminationPhase('${phase.id}')" class="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors duration-200" title="Supprimer la phase">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `).join('');

        const availableTeamsForSelection = allTeams.filter(team => !eliminatedTeams.has(team.id));
        const teamOptionsHtml = availableTeamsForSelection.length === 0 ?
            '<p class="text-gray-600">Aucune équipe disponible pour la sélection. Ajoutez des équipes d\'abord ou toutes les équipes sont éliminées.</p>' :
            availableTeamsForSelection.map(team => `
            <label class="inline-flex items-center">
                <input type="checkbox" name="selectedEliminationTeams" value="${team.id}" class="form-checkbox h-5 w-5 text-blue-600 rounded">
                <span class="ml-2 text-gray-700">${team.name}</span>
            </label>
        `).join('');

        APP_CONTAINER.innerHTML = `
            <div class="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h2 class="text-3xl font-bold text-blue-700 mb-6 text-center">Gestion des Phases d'Élimination</h2>

                <!-- Formulaire d'ajout de phase d'élimination -->
                <div class="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
                    <h3 class="text-2xl font-semibold text-blue-600 mb-4">Ajouter une Nouvelle Phase d'Élimination</h3>
                    <div class="flex flex-col gap-4 mb-4">
                        <input type="text" id="newEliminationPhaseName" placeholder="Nom de la phase (ex: Quarts de finale)"
                               class="p-3 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-800">
                        <select id="newEliminationPhaseType"
                                class="p-3 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-800">
                            <option value="">Sélectionner le type de phase</option>
                            <option value="Huitièmes de finale">Huitièmes de finale</option>
                            <option value="Quarts de finale">Quarts de finale</option>
                            <option value="Demi-finales">Demi-finales</option>
                            <option value="Finale">Finale</option>
                        </select>
                        <div class="flex flex-wrap gap-x-4 gap-y-2">
                            ${teamOptionsHtml}
                        </div>
                    </div>
                    <button id="addEliminationPhaseBtn"
                            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center w-full">
                        <i class="fas fa-plus-circle mr-2"></i> Créer la phase d'élimination
                    </button>
                </div>

                <!-- Liste des phases d'élimination existantes -->
                <div class="mb-8">
                    <h3 class="text-2xl font-semibold text-blue-600 mb-4">Phases d'Élimination Existantes</h3>
                    <ul class="space-y-4">
                        ${eliminationPhaseListHtml}
                    </ul>
                </div>
            </div>
        `;

        document.getElementById('addEliminationPhaseBtn').addEventListener('click', () => {
            const name = document.getElementById('newEliminationPhaseName').value;
            const type = document.getElementById('newEliminationPhaseType').value;
            const selectedTeamIds = Array.from(document.querySelectorAll('input[name="selectedEliminationTeams"]:checked'))
                .map(checkbox => checkbox.value);
            addEliminationPhase(name, type, selectedTeamIds);
            // Réinitialiser les champs
            document.getElementById('newEliminationPhaseName').value = '';
            document.getElementById('newEliminationPhaseType').value = '';
            document.querySelectorAll('input[name="selectedEliminationTeams"]:checked').forEach(checkbox => checkbox.checked = false);
        });

        // Exposer les fonctions au scope global pour les onclick dans le HTML injecté
        window.displayEliminationPhaseDetails = displayEliminationPhaseDetails;
        window.deleteEliminationPhase = deleteEliminationPhase;
    }

    /**
     * Rend les détails d'une phase d'élimination spécifique.
     * @param {string} phaseId - L'ID de la phase d'élimination à afficher.
     */
    function renderEliminationPhaseDetails(phaseId) {
        clearAppContainer();
        APP_CONTAINER.className = 'p-6 bg-gray-100 min-h-screen';

        const phase = eliminationPhases[phaseId];
        if (!phase) {
            APP_CONTAINER.innerHTML = `<p class="text-red-500 text-center">Phase d'élimination non trouvée.</p>`;
            return;
        }

        const isPhaseCompleted = phase.status === 'completed';

        const matchesHtml = phase.matches.length === 0 ?
            `<p class="text-gray-600 text-center">Aucun match généré pour cette phase.</p>` :
            phase.matches.map(match => {
                const teamAName = allTeams.find(t => t.id === match.teamA)?.name || 'Équipe A';
                const teamBName = allTeams.find(t => t.id === match.teamB)?.name || 'Équipe B';

                const teamAClass = match.winner === match.teamA ? 'winner-team' : (match.loser === match.teamA ? 'loser-team' : '');
                const teamBClass = match.winner === match.teamB ? 'winner-team' : (match.loser === match.teamB ? 'loser-team' : '');

                return `
                <div class="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-lg shadow-md">
                    <span class="font-medium text-gray-800 mb-2 sm:mb-0">
                        <span class="${teamAClass}">${teamAName}</span> vs <span class="${teamBClass}">${teamBName}</span>
                    </span>
                    <div class="flex items-center space-x-2">
                        <input type="number" value="${match.scoreA !== null ? match.scoreA : ''}"
                               id="elimScoreA-${match.id}" placeholder="Score A" min="0"
                               class="w-20 p-2 border rounded-md text-center ${isPhaseCompleted ? 'bg-gray-100 cursor-not-allowed' : ''}"
                               ${isPhaseCompleted ? 'disabled' : ''}>
                        <span>-</span>
                        <input type="number" value="${match.scoreB !== null ? match.scoreB : ''}"
                               id="elimScoreB-${match.id}" placeholder="Score B" min="0"
                               class="w-20 p-2 border rounded-md text-center ${isPhaseCompleted ? 'bg-gray-100 cursor-not-allowed' : ''}"
                               ${isPhaseCompleted ? 'disabled' : ''}>
                        ${!isPhaseCompleted ? `
                        <button onclick="updateEliminationMatchScore('${phase.id}', '${match.id}',
                            document.getElementById('elimScoreA-${match.id}').value,
                            document.getElementById('elimScoreB-${match.id}').value)"
                            class="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full transition-colors duration-200" title="Enregistrer le score">
                            <i class="fas fa-save"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('');

        const completePhaseButton = !isPhaseCompleted ? `
            <button id="completeEliminationPhaseBtn"
                    class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center w-full mt-6">
                <i class="fas fa-check-circle mr-2"></i> Terminer la Phase d'Élimination
            </button>
        ` : `<p class="text-center text-green-700 font-semibold text-lg mt-6">Cette phase est terminée.</p>`;

        APP_CONTAINER.innerHTML = `
            <div class="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h2 class="text-3xl font-bold text-blue-700 mb-4 text-center">${phase.name} (${phase.type})</h2>
                <p class="text-gray-600 text-center mb-6">Statut: <span class="font-bold ${phase.status === 'completed' ? 'text-green-600' : (phase.status === 'in_progress' ? 'text-yellow-600' : 'text-gray-500')}">${phase.status === 'pending' ? 'En attente' : (phase.status === 'in_progress' ? 'En cours' : 'Terminée')}</span></p>

                <h3 class="text-2xl font-semibold text-blue-600 mb-4">Matchs</h3>
                <div class="space-y-4">
                    ${matchesHtml}
                </div>

                ${completePhaseButton}

                <div class="mt-8 text-center">
                    <a href="#elimination-phases" class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105">
                        <i class="fas fa-arrow-left mr-2"></i> Retour aux phases d'élimination
                    </a>
                </div>
            </div>
        `;

        if (document.getElementById('completeEliminationPhaseBtn')) {
            document.getElementById('completeEliminationPhaseBtn').addEventListener('click', () => {
                completeEliminationPhase(phaseId);
            });
        }
        window.updateEliminationMatchScore = updateEliminationMatchScore;
    }

    /**
     * Rend la page de gestion des groupes secondaires.
     */
    function renderSecondaryGroupsPage() {
        clearAppContainer();
        APP_CONTAINER.className = 'p-6 bg-gray-100 min-h-screen';

        const availableTeamsForSelection = allTeams.filter(team => !eliminatedTeams.has(team.id));
        const teamOptionsHtml = availableTeamsForSelection.length === 0 ?
            '<p class="text-gray-600">Aucune équipe disponible pour la sélection.</p>' :
            availableTeamsForSelection.map(team => `
            <label class="inline-flex items-center">
                <input type="checkbox" name="secondaryGroupTeams" value="${team.id}" class="form-checkbox h-5 w-5 text-blue-600 rounded">
                <span class="ml-2 text-gray-700">${team.name}</span>
            </label>
        `).join('');

        const previewHtml = Object.keys(currentSecondaryGroupsPreview).length > 0 ?
            `
            <div class="mt-8 p-6 bg-blue-50 rounded-lg shadow-inner">
                <h3 class="text-2xl font-semibold text-blue-600 mb-4">Prévisualisation des Groupes Secondaires</h3>
                ${Object.entries(currentSecondaryGroupsPreview).map(([groupName, teamIds]) => `
                    <div class="mb-4">
                        <h4 class="text-xl font-medium text-blue-700">${groupName}</h4>
                        <ul class="list-disc list-inside ml-4 text-gray-700">
                            ${teamIds.map(id => `<li>${allTeams.find(t => t.id === id)?.name || 'Inconnue'}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
                <button id="clearPreviewBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition-all duration-300">
                    Effacer la prévisualisation
                </button>
            </div>
            ` : '';


        APP_CONTAINER.innerHTML = `
            <div class="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h2 class="text-3xl font-bold text-blue-700 mb-6 text-center">Gestion des Groupes Secondaires</h2>

                <div class="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
                    <h3 class="text-2xl font-semibold text-blue-600 mb-4">Créer de Nouveaux Groupes</h3>
                    <div class="flex flex-col gap-4 mb-4">
                        <input type="number" id="numSecondaryGroups" placeholder="Nombre de groupes" min="1"
                               class="p-3 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-800">
                        <select id="secondaryGroupBasis" class="p-3 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-800">
                            <option value="random">Distribution Aléatoire</option>
                            <option value="rank">Basé sur le Classement Global</option>
                            <option value="manual">Sélection Manuelle par Groupe</option>
                        </select>
                        <div id="manualSelectionContainer" class="hidden flex flex-col gap-2 p-4 border border-dashed border-gray-300 rounded-md">
                            <!-- Les champs de sélection manuelle seront injectés ici -->
                        </div>
                        <div class="flex flex-wrap gap-x-4 gap-y-2" id="secondaryTeamsCheckboxContainer">
                            ${teamOptionsHtml}
                        </div>
                    </div>
                    <button id="generateSecondaryGroupsBtn"
                            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center w-full">
                        <i class="fas fa-layer-group mr-2"></i> Générer la prévisualisation
                    </button>
                </div>

                ${previewHtml}

                <div class="mt-8 text-center">
                    <a href="#home" class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105">
                        <i class="fas fa-home mr-2"></i> Retour à l'accueil
                    </a>
                </div>
            </div>
        `;

        const numSecondaryGroupsInput = document.getElementById('numSecondaryGroups');
        const secondaryGroupBasisSelect = document.getElementById('secondaryGroupBasis');
        const manualSelectionContainer = document.getElementById('manualSelectionContainer');
        const secondaryTeamsCheckboxContainer = document.getElementById('secondaryTeamsCheckboxContainer');

        function toggleManualSelection() {
            if (secondaryGroupBasisSelect.value === 'manual') {
                manualSelectionContainer.classList.remove('hidden');
                secondaryTeamsCheckboxContainer.classList.add('hidden'); // Cacher la sélection globale
                renderManualGroupInputs(parseInt(numSecondaryGroupsInput.value) || 1);
            } else {
                manualSelectionContainer.classList.add('hidden');
                secondaryTeamsCheckboxContainer.classList.remove('hidden'); // Afficher la sélection globale
                manualSelectionContainer.innerHTML = ''; // Nettoyer les inputs manuels
            }
        }

        function renderManualGroupInputs(numGroups) {
            manualSelectionContainer.innerHTML = '';
            for (let i = 0; i < numGroups; i++) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'border border-gray-200 p-3 rounded-md';
                groupDiv.innerHTML = `
                    <h5 class="font-semibold mb-2">Groupe ${i + 1}</h5>
                    <div class="flex flex-wrap gap-x-4 gap-y-2" id="manualGroup-${i}">
                        ${availableTeamsForSelection.map(team => `
                            <label class="inline-flex items-center">
                                <input type="checkbox" name="manualGroupTeam-${i}" value="${team.id}" class="form-checkbox h-5 w-5 text-blue-600 rounded">
                                <span class="ml-2 text-gray-700">${team.name}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
                manualSelectionContainer.appendChild(groupDiv);
            }
        }

        numSecondaryGroupsInput.addEventListener('input', toggleManualSelection);
        secondaryGroupBasisSelect.addEventListener('change', toggleManualSelection);

        if (document.getElementById('generateSecondaryGroupsBtn')) {
            document.getElementById('generateSecondaryGroupsBtn').addEventListener('click', () => {
                const numGroups = parseInt(numSecondaryGroupsInput.value);
                const basis = secondaryGroupBasisSelect.value;
                let selectedTeamIds = [];

                if (basis === 'manual') {
                    // Collecter les équipes par groupe pour la sélection manuelle
                    const manualGroups = {};
                    for (let i = 0; i < numGroups; i++) {
                        manualGroups[`Groupe ${i+1}`] = Array.from(document.querySelectorAll(`input[name="manualGroupTeam-${i}"]:checked`))
                            .map(checkbox => checkbox.value);
                    }
                    generateSecondaryGroups(numGroups, basis, manualGroups);
                } else {
                    // Collecter toutes les équipes sélectionnées pour les modes auto
                    selectedTeamIds = Array.from(document.querySelectorAll('input[name="secondaryGroupTeams"]:checked'))
                        .map(checkbox => checkbox.value);
                    generateSecondaryGroups(numGroups, basis, selectedTeamIds);
                }
            });
        }

        if (document.getElementById('clearPreviewBtn')) {
            document.getElementById('clearPreviewBtn').addEventListener('click', () => {
                currentSecondaryGroupsPreview = {};
                saveAllData();
                renderSecondaryGroupsPage(); // Re-render pour effacer la prévisualisation
                showToast("Prévisualisation des groupes secondaires effacée.", "info");
            });
        }
    }

    /**
     * Génère une prévisualisation des groupes secondaires.
     * @param {number} numGroups - Le nombre de groupes à générer.
     * @param {string} basis - La base de génération ('random', 'rank', 'manual').
     * @param {string[]|Object} teamsInput - Les IDs des équipes sélectionnées (array pour auto, object pour manuel).
     */
    function generateSecondaryGroups(numGroups, basis, teamsInput) {
        if (numGroups <= 0) {
            showToast("Le nombre de groupes doit être supérieur à zéro.", "error");
            return;
        }

        currentSecondaryGroupsPreview = {};

        if (basis === 'manual') {
            // Pour la sélection manuelle, teamsInput est un objet { "Groupe N": [teamIds] }
            let allSelectedTeams = new Set();
            for (const groupName in teamsInput) {
                teamsInput[groupName].forEach(teamId => allSelectedTeams.add(teamId));
            }

            // Vérifier les doublons
            if (allSelectedTeams.size !== Array.from(allSelectedTeams).length) {
                showToast("Une équipe a été sélectionnée dans plusieurs groupes. Veuillez corriger.", "error");
                return;
            }

            // Vérifier que toutes les équipes sélectionnées manuellement sont disponibles (non éliminées)
            const unavailableManualTeams = Array.from(allSelectedTeams).filter(teamId => eliminatedTeams.has(teamId));
            if (unavailableManualTeams.length > 0) {
                const teamNames = unavailableManualTeams.map(id => allTeams.find(t => t.id === id)?.name || 'Inconnue').join(', ');
                showToast(`Les équipes suivantes sont éliminées et ne peuvent pas être dans les groupes: ${teamNames}`, "error");
                return;
            }

            currentSecondaryGroupsPreview = teamsInput;

        } else {
            // Pour les modes automatiques ('random', 'rank'), teamsInput est un array de teamIds
            const selectedTeamIds = teamsInput;

            if (selectedTeamIds.length < numGroups) {
                showToast("Pas assez d'équipes sélectionnées pour le nombre de groupes demandé.", "error");
                return;
            }

            // Filtrer les équipes éliminées
            let availableTeams = selectedTeamIds.filter(teamId => !eliminatedTeams.has(teamId));

            if (availableTeams.length < numGroups) {
                showToast("Pas assez d'équipes disponibles pour le nombre de groupes demandé (après exclusion des équipes éliminées).", "error");
                return;
            }

            if (basis === 'rank') {
                // Calculer le classement global des équipes disponibles
                const rankedTeams = availableTeams.map(teamId => {
                    const team = allTeams.find(t => t.id === teamId);
                    if (!team) return null; // Should not happen

                    let totalWins = 0;
                    let totalSetsWon = 0;
                    let totalSetsLost = 0;

                    // Agréger les stats de toutes les phases de brassage terminées
                    allBrassagePhases.filter(p => p.status === 'completed').forEach(phase => {
                        totalWins += calculateWins(team.id, phase);
                        totalSetsWon += calculateSetsWon(team.id, phase);
                        totalSetsLost += calculateSetsLost(team.id, phase);
                    });

                    const setRatio = totalSetsLost === 0 ? (totalSetsWon === 0 ? 0 : totalSetsWon) : totalSetsWon / totalSetsLost;

                    return {
                        id: team.id,
                        name: team.name,
                        totalWins: totalWins,
                        totalSetRatio: setRatio
                    };
                }).filter(Boolean);

                // Trier les équipes par victoires (desc) puis par ratio de sets (desc)
                rankedTeams.sort((a, b) => {
                    if (b.totalWins !== a.totalWins) {
                        return b.totalWins - a.totalWins;
                    }
                    return b.totalSetRatio - a.totalSetRatio;
                });

                availableTeams = rankedTeams.map(team => team.id);
            } else { // basis === 'random'
                // Mélanger les équipes pour une distribution aléatoire
                for (let i = availableTeams.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [availableTeams[i], availableTeams[j]] = [availableTeams[j], availableTeams[i]];
                }
            }

            // Distribuer les équipes dans les groupes de manière équitable (serpentine)
            for (let i = 0; i < numGroups; i++) {
                currentSecondaryGroupsPreview[`Groupe ${i + 1}`] = [];
            }

            for (let i = 0; i < availableTeams.length; i++) {
                const teamId = availableTeams[i];
                const groupIndex = i % numGroups;
                currentSecondaryGroupsPreview[`Groupe ${groupIndex + 1}`].push(teamId);
            }
        }

        saveAllData(); // Persister la prévisualisation
        renderSecondaryGroupsPage(); // Re-render pour afficher la prévisualisation
        showToast("Prévisualisation des groupes générée.", "success");
    }


    // --- Routage et Initialisation ---

    /**
     * Gère les changements de hash dans l'URL pour la navigation.
     */
    function handleLocationHash() {
        const path = window.location.hash.substring(1); // Supprime le '#' initial
        console.log("Navigating to:", path);
        switch (path) {
            case 'teams':
                renderTeamsPage();
                break;
            case 'brassage-phases':
                renderBrassagePhasesPage();
                break;
            case 'elimination-phases':
                renderEliminationPhasesPage();
                break;
            case 'brassage-details':
                // Si l'ID de la phase est déjà stocké, l'utiliser
                if (currentDisplayedPhaseId) {
                    renderPhaseDetails(currentDisplayedPhaseId);
                } else {
                    // Sinon, rediriger vers la liste des phases
                    window.location.hash = '#brassage-phases';
                }
                break;
            case 'secondary-groups':
                renderSecondaryGroupsPage();
                break;
            case '': // Page d'accueil par défaut
            case 'home':
                renderHomePage();
                break;
            default:
                // Si la route est inconnue, rediriger vers l'accueil
                console.warn(`Route inconnue: ${path}. Redirection vers l'accueil.`);
                window.location.hash = '#home';
        }
    }

    // --- Fonctions d'Import/Export Excel ---

    /**
     * Importe les équipes à partir d'un fichier Excel (.xlsx).
     */
    function importTeamsFromExcel() {
        showModal(
            "Importer des équipes",
            `
            <p class="mb-4">Sélectionnez un fichier Excel (.xlsx) contenant les noms des équipes dans la première colonne.</p>
            <input type="file" id="excelFileInput" accept=".xlsx, .xls" class="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100">
            `,
            () => {
                const fileInput = document.getElementById('excelFileInput');
                const file = fileInput.files[0];
                if (!file) {
                    showToast("Veuillez sélectionner un fichier.", "error");
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {
                        type: 'array'
                    });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, {
                        header: 1
                    });

                    if (json.length === 0) {
                        showToast("Le fichier Excel est vide ou ne contient pas de données.", "error");
                        return;
                    }

                    const newTeams = [];
                    const existingTeamNames = new Set(allTeams.map(t => t.name.toLowerCase()));
                    let importedCount = 0;

                    json.forEach(row => {
                        const teamName = String(row[0]).trim(); // Assurez-vous que c'est une chaîne
                        if (teamName && !existingTeamNames.has(teamName.toLowerCase())) {
                            newTeams.push({
                                id: generateUUID(),
                                name: teamName
                            });
                            existingTeamNames.add(teamName.toLowerCase()); // Ajouter au set pour éviter les doublons dans le même import
                            importedCount++;
                        }
                    });

                    if (newTeams.length > 0) {
                        allTeams.push(...newTeams);
                        saveAllData();
                        renderTeamsPage();
                        showToast(`${importedCount} équipes importées avec succès.`, "success");
                    } else {
                        showToast("Aucune nouvelle équipe à importer ou toutes les équipes existent déjà.", "info");
                    }
                };
                reader.onerror = function(e) {
                    showToast("Erreur de lecture du fichier.", "error");
                    console.error("File reading error:", e);
                };
                reader.readAsArrayBuffer(file);
            },
            "Importer",
            "Annuler"
        );
    }

    /**
     * Exporte les équipes existantes vers un fichier Excel (.xlsx).
     */
    function exportTeamsToExcel() {
        if (allTeams.length === 0) {
            showToast("Aucune équipe à exporter.", "info");
            return;
        }

        const data = [
            ["Nom de l'équipe"]
        ]; // En-tête
        allTeams.forEach(team => {
            data.push([team.name]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Équipes");

        const wbout = XLSX.write(wb, {
            bookType: 'xlsx',
            type: 'array'
        });

        function s2ab(s) {
            const buf = new ArrayBuffer(s.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
            return buf;
        }

        const blob = new Blob([s2ab(wbout)], {
            type: "application/octet-stream"
        });
        const fileName = "equipes_easyplay.xlsx";

        // Créer un lien de téléchargement et le déclencher
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast("Équipes exportées avec succès.", "success");
    }

// --- Initialisation de l'Application ---
    document.addEventListener('DOMContentLoaded', () => {
        // Attendre que Firebase soit prêt avant de tenter de charger les données
        // L'initialisation de Firebase est gérée dans index.html et expose les variables globales.
        // On peut s'assurer que window.db est défini avant d'appeler loadAllData.
        const checkFirebaseReady = setInterval(() => {
            if (window.db && window.userId) {
                clearInterval(checkFirebaseReady);
                loadAllData(); // Charger toutes les données au démarrage depuis Firestore
                handleLocationHash(); // Rendre la page initiale après le chargement des données
            }
        }, 100); // Vérifier toutes les 100ms

        // Écouter les changements de hash dans l'URL pour le routage
        window.addEventListener('hashchange', handleLocationHash);

        // Attacher les gestionnaires d'événements pour les boutons de la modale globale
        modalCancelBtn.addEventListener('click', hideModal); // <--- CETTE LIGNE EST LE PROBLÈME

        // Ajout de la transparence à la barre de navigation lors du défilement
        const navBar = document.querySelector('nav');
        let isScrolled = false;
        window.addEventListener('scroll', () => {
            if (window.scrollY > 0) {
                if (!isScrolled) {
                    navBar.classList.add('bg-blue-700/70', 'transition-colors', 'duration-300'); // Plus transparent
                    navBar.classList.remove('bg-blue-700/90');
                    isScrolled = true;
                }
            } else {
                if (isScrolled) {
                    navBar.classList.remove('bg-blue-700/70');
                    navBar.classList.add('bg-blue-700/90'); // Moins transparent
                    isScrolled = false;
                }
            }
        });
    });

})();
