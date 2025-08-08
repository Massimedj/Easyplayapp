// Contenu de arbitre.js

// --- Références aux éléments de la modale ---
const actionModal = document.getElementById('actionModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCancelBtn = document.getElementById('modalCancelBtn');
let modalConfirmBtn = document.getElementById('modalConfirmBtn');

/**
 * Affiche une modale générique.
 */
function showModal(title, bodyContent, confirmCallback, isDelete = false, showCancelBtn = true) {
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    modalBody.appendChild(bodyContent);
    actionModal.classList.remove('hidden');

    const oldConfirmBtn = modalConfirmBtn;
    const newConfirmBtn = oldConfirmBtn.cloneNode(true);
    oldConfirmBtn.parentNode.replaceChild(newConfirmBtn, oldConfirmBtn);
    modalConfirmBtn = newConfirmBtn;
    modalConfirmBtn.textContent = 'Confirmer';

    if (isDelete) {
        modalConfirmBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        modalConfirmBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
        modalConfirmBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        modalConfirmBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }

    modalConfirmBtn.onclick = () => {
        confirmCallback();
        hideModal();
    };
    
    // Attacher l'événement au bouton Annuler
    modalCancelBtn.onclick = hideModal;

    if (showCancelBtn) {
        modalCancelBtn.classList.remove('hidden');
    } else {
        modalCancelBtn.classList.add('hidden');
    }
}

/**
 * Cache la modale générique.
 */
function hideModal() {
    actionModal.classList.add('hidden');
    modalBody.innerHTML = '';
    if (modalConfirmBtn) modalConfirmBtn.onclick = null;
    if (modalCancelBtn) modalCancelBtn.onclick = null;
}

// --- Fonctions Utilitaires ---
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-[100] flex flex-col space-y-2';
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `p-4 rounded-lg shadow-md text-white flex items-center space-x-2 transition-opacity duration-300 ease-out opacity-0`;
    let bgColor = ''; let icon = '';
    switch (type) {
        case 'success': bgColor = 'bg-green-500'; icon = '<i class="fas fa-check-circle"></i>'; break;
        case 'error': bgColor = 'bg-red-500'; icon = '<i class="fas fa-times-circle"></i>'; break;
        default: bgColor = 'bg-blue-500'; icon = '<i class="fas fa-info-circle"></i>'; break;
    }
    toast.classList.add(bgColor);
    toast.innerHTML = `${icon} <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.remove('opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

// --- Logique Principale ---

let TOURNAMENT_ID, PHASE_ID, POOL_ID;

function loadAndDisplayPoolData() {
    const params = new URLSearchParams(window.location.search);
    TOURNAMENT_ID = params.get('tournoi');
    
    // On vérifie si c'est un match de brassage (avec phase et poule)
    const PHASE_ID = params.get('phase');
    const POOL_ID = params.get('poule');
    
    // Ou si c'est un match éliminatoire (avec groupe et match)
    const GROUP_TYPE = params.get('groupe');
    const MATCH_ID = params.get('match');

    if (!TOURNAMENT_ID || (!POOL_ID && !MATCH_ID)) {
        document.getElementById('pool-name-title').textContent = "Lien invalide ou incomplet.";
        return;
    }

    const tournamentRef = window.doc(window.db, "tournaments", TOURNAMENT_ID);

    window.onSnapshot(tournamentRef, (docSnap) => {
        if (!docSnap.exists()) {
            document.getElementById('pool-name-title').textContent = "Tournoi introuvable.";
            return;
        }

        const tournamentData = docSnap.data();

        if (POOL_ID) {
            // Logique pour les BRASSAGES
            const phase = tournamentData.allBrassagePhases.find(p => p.id === PHASE_ID);
            if (!phase) { document.getElementById('pool-name-title').textContent = "Phase introuvable."; return; }
            const pool = phase.pools.find(p => p.id === POOL_ID);
            if (!pool) { document.getElementById('pool-name-title').textContent = "Poule introuvable."; return; }

            renderArbitreView_Brassage(pool, phase, tournamentData);

        } else if (MATCH_ID) {
            // Logique pour les ÉLIMINATOIRES
            const bracket = tournamentData.eliminationPhases[GROUP_TYPE];
            if (!bracket) { document.getElementById('pool-name-title').textContent = "Groupe éliminatoire introuvable."; return; }
            
            let match, roundName;
            for (const round of bracket.bracket) {
                const foundMatch = round.matches.find(m => m.id === MATCH_ID);
                if (foundMatch) {
                    match = foundMatch;
                    roundName = round.roundName;
                    break;
                }
            }

            if (!match) { document.getElementById('pool-name-title').textContent = "Match introuvable."; return; }
            
            renderArbitreView_Eliminatoire(match, roundName, GROUP_TYPE, tournamentData);
        }
    }, (error) => {
        console.error("Erreur d'écoute Firestore : ", error);
        document.getElementById('pool-name-title').textContent = "Erreur de chargement des données.";
    });
}

function renderArbitreView_Brassage(pool, phase, tournamentData) {
    document.getElementById('pool-name-title').textContent = `Saisie des scores - ${pool.name}`;
    const matchesListDiv = document.getElementById('matches-list');
    matchesListDiv.innerHTML = '';

    pool.matches.forEach((match, index) => {
        const isValide = match.scoreValide === true;
        const isDisabled = isValide ? 'disabled' : '';

        const matchCard = document.createElement('div');
        matchCard.className = `bg-white p-4 rounded-lg shadow-md border ${isValide ? 'border-green-300 bg-green-50' : 'border-gray-200'}`;
		matchCard.innerHTML = `
			<div class="flex justify-between items-center text-lg font-bold">
				<span class="text-gray-800 text-center flex-1">${match.team1Name}</span>
				<span class="text-gray-400 mx-2">vs</span>
				<span class="text-gray-800 text-center flex-1">${match.team2Name}</span>
			</div>
			<div class="flex justify-around items-center mt-4">
				<div class="flex items-center gap-2">
					<button ${isDisabled} data-match-index="${index}" data-team="1" data-action="minus" class="score-btn w-9 h-9 rounded-full bg-red-500 text-white font-bold text-2xl disabled:bg-gray-300">-</button>
					<span id="score1-match${index}" class="text-4xl font-bold w-14 text-center">${match.score1 || 0}</span>
					<button ${isDisabled} data-match-index="${index}" data-team="1" data-action="plus" class="score-btn w-9 h-9 rounded-full bg-green-500 text-white font-bold text-2xl disabled:bg-gray-300">+</button>
				</div>
				<div class="flex items-center gap-2">
					<button ${isDisabled} data-match-index="${index}" data-team="2" data-action="minus" class="score-btn w-9 h-9 rounded-full bg-red-500 text-white font-bold text-2xl disabled:bg-gray-300">-</button>
					<span id="score2-match${index}" class="text-4xl font-bold w-14 text-center">${match.score2 || 0}</span>
					<button ${isDisabled} data-match-index="${index}" data-team="2" data-action="plus" class="score-btn w-9 h-9 rounded-full bg-green-500 text-white font-bold text-2xl disabled:bg-gray-300">+</button>
				</div>
			</div>
			<div class="text-center mt-4">
				${isValide 
					? `<p class="text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i>Score Final Validé</p>`
					: `<button data-match-index="${index}" class="validate-score-btn bg-blue-600 text-white text-sm font-semibold py-1 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400">Valider</button>`
				}
			</div>
        `;
        matchesListDiv.appendChild(matchCard);
    });
    attachArbitreListeners_Brassage(pool, phase, tournamentData);
}

function attachArbitreListeners_Brassage(pool, phase, tournamentData) {
    document.querySelectorAll('.score-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const { matchIndex, team, action } = e.currentTarget.dataset;
            const scoreSpan = document.getElementById(`score${team}-match${matchIndex}`);
            let currentScore = parseInt(scoreSpan.textContent);
            
            if (action === 'plus') {
                currentScore++;
            } else if (action === 'minus' && currentScore > 0) {
                currentScore--;
            }
            scoreSpan.textContent = currentScore;
        });
    });

    document.querySelectorAll('.validate-score-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const matchIndex = parseInt(e.currentTarget.dataset.matchIndex);
            const score1 = parseInt(document.getElementById(`score1-match${matchIndex}`).textContent);
            const score2 = parseInt(document.getElementById(`score2-match${matchIndex}`).textContent);
            
            if (score1 === score2) {
                showToast("Un match ne peut pas être nul. Veuillez désigner un vainqueur.", "error");
                return;
            }

            const confirmButton = e.currentTarget;

            const messageContent = document.createElement('p');
            messageContent.textContent = 'Êtes-vous sûr de vouloir valider ce score ? Cette action est définitive.';
            messageContent.className = 'text-gray-700';

            const validationCallback = async () => {
                confirmButton.disabled = true;
                confirmButton.textContent = 'Validation...';

                const updatedTournamentData = { ...tournamentData };
                const phaseToUpdate = updatedTournamentData.allBrassagePhases.find(p => p.id === PHASE_ID);
                const poolToUpdate = phaseToUpdate.pools.find(p => p.id === POOL_ID);
                const matchToUpdate = poolToUpdate.matches[matchIndex];
                
                matchToUpdate.score1 = score1;
                matchToUpdate.score2 = score2;
                matchToUpdate.winnerId = score1 > score2 ? matchToUpdate.team1Id : matchToUpdate.team2Id;
                matchToUpdate.scoreValide = true;

                try {
                    const tournamentRef = window.doc(window.db, "tournaments", TOURNAMENT_ID);
                    await window.updateDoc(tournamentRef, {
                        allBrassagePhases: updatedTournamentData.allBrassagePhases
                    });
                    showToast("Score validé avec succès !", "success");
                } catch (error) {
                    showToast("Erreur lors de la validation du score.", "error");
                    console.error("Erreur de validation : ", error);
                    confirmButton.disabled = false;
                    confirmButton.textContent = 'Valider';
                }
            };

            showModal('Confirmer la validation', messageContent, validationCallback, true);
        });
    });
}

function renderArbitreView_Eliminatoire(match, roundName, groupType, tournamentData) {
    document.getElementById('pool-name-title').textContent = `Tournoi ${groupType} - ${roundName}`;
    const matchesListDiv = document.getElementById('matches-list');
    matchesListDiv.innerHTML = '';

    const isValide = match.scoreValide === true;
    const isDisabled = isValide ? 'disabled' : '';

    const matchCard = document.createElement('div');
    matchCard.className = `bg-white p-4 rounded-lg shadow-md border ${isValide ? 'border-green-300 bg-green-50' : 'border-gray-200'}`;
    matchCard.innerHTML = `
        <div class="flex justify-between items-center text-lg font-bold">
            <span class="text-gray-800 text-center flex-1">${match.team1.name}</span>
            <span class="text-gray-400 mx-2">vs</span>
            <span class="text-gray-800 text-center flex-1">${match.team2.name}</span>
        </div>
        <div class="flex justify-around items-center mt-4">
            <div class="flex items-center gap-3">
                <button ${isDisabled} data-team="1" data-action="minus" class="score-btn w-10 h-10 rounded-full bg-red-500 text-white font-bold text-2xl disabled:bg-gray-300">-</button>
                <span id="score1-match" class="text-4xl font-bold w-14 text-center">${match.score1 || 0}</span>
                <button ${isDisabled} data-team="1" data-action="plus" class="score-btn w-10 h-10 rounded-full bg-green-500 text-white font-bold text-2xl disabled:bg-gray-300">+</button>
            </div>
            <div class="flex items-center gap-3">
                <button ${isDisabled} data-team="2" data-action="minus" class="score-btn w-10 h-10 rounded-full bg-red-500 text-white font-bold text-2xl disabled:bg-gray-300">-</button>
                <span id="score2-match" class="text-4xl font-bold w-14 text-center">${match.score2 || 0}</span>
                <button ${isDisabled} data-team="2" data-action="plus" class="score-btn w-10 h-10 rounded-full bg-green-500 text-white font-bold text-2xl disabled:bg-gray-300">+</button>
            </div>
        </div>
        <div class="text-center mt-4">
            ${isValide 
                ? `<p class="text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i>Score Final Validé</p>`
                : `<button class="validate-score-btn bg-blue-600 text-white text-sm font-semibold py-1 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400">Valider</button>`
            }
        </div>
    `;
    matchesListDiv.appendChild(matchCard);
    attachArbitreListeners_Eliminatoire(match, groupType, tournamentData);
}

// AJOUTEZ AUSSI CETTE FONCTION
function attachArbitreListeners_Eliminatoire(match, groupType, tournamentData) {
    document.querySelectorAll('.score-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const { team, action } = e.currentTarget.dataset;
            const scoreSpan = document.getElementById(`score${team}-match`);
            let currentScore = parseInt(scoreSpan.textContent);
            
            if (action === 'plus') currentScore++;
            else if (action === 'minus' && currentScore > 0) currentScore--;
            
            scoreSpan.textContent = currentScore;
        });
    });

    const validateButton = document.querySelector('.validate-score-btn');
    if (validateButton) {
        validateButton.addEventListener('click', (e) => {
            const score1 = parseInt(document.getElementById('score1-match').textContent);
            const score2 = parseInt(document.getElementById('score2-match').textContent);
            
            if (score1 === score2) {
                showToast("Un match ne peut pas être nul. Veuillez désigner un vainqueur.", "error");
                return;
            }

            const confirmButton = e.currentTarget;

            const messageContent = document.createElement('p');
            messageContent.textContent = 'Êtes-vous sûr de vouloir valider ce score ? Cette action est définitive.';
            messageContent.className = 'text-gray-700';

            const validationCallback = async () => {
                confirmButton.disabled = true;
                confirmButton.textContent = 'Validation...';

                const updatedTournamentData = { ...tournamentData };
                const bracketToUpdate = updatedTournamentData.eliminationPhases[groupType];
                
                let matchToUpdate;
                for (const round of bracketToUpdate.bracket) {
                    const foundMatch = round.matches.find(m => m.id === match.id);
                    if (foundMatch) {
                        matchToUpdate = foundMatch;
                        break;
                    }
                }

                if (matchToUpdate) {
                    matchToUpdate.score1 = score1;
                    matchToUpdate.score2 = score2;
                    matchToUpdate.winnerId = score1 > score2 ? matchToUpdate.team1.id : matchToUpdate.team2.id;
                    matchToUpdate.loserId = score1 < score2 ? matchToUpdate.team1.id : matchToUpdate.team2.id;
                    matchToUpdate.scoreValide = true;

                    try {
                        const tournamentRef = window.doc(window.db, "tournaments", TOURNAMENT_ID);
                        await window.updateDoc(tournamentRef, {
                            eliminationPhases: updatedTournamentData.eliminationPhases
                        });
                        showToast("Score validé avec succès !", "success");
                    } catch (error) {
                        showToast("Erreur lors de la validation du score.", "error");
                        console.error("Erreur de validation : ", error);
                        confirmButton.disabled = false;
                        confirmButton.textContent = 'Valider';
                    }
                }
            };

            showModal('Confirmer la validation', messageContent, validationCallback, true);
        });
    }
}

// Initialisation
window.onArbitreFirebaseReady = loadAndDisplayPoolData;
if (window.db) {
    loadAndDisplayPoolData();
}