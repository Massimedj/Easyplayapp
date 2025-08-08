// Contenu de : src/melee/pages/rencontres.js

import { players, rounds, settings, saveData, deleteRound, clearAllRounds } from '../shared/data.js'; 
import { showToast, showModal } from '../shared/ui.js';
import { generateTeamsAndMatches } from '../shared/generation.js';

const APP_CONTAINER = document.getElementById('app-container');
let selectedPhaseId = null;

/**
 * Retourne le symbole correspondant au genre du joueur.
 * @param {string} gender - Le genre ('Homme', 'Femme', 'Autre').
 * @returns {string} Le symbole HTML correspondant.
 */
function getGenderSymbol(gender) {
    switch (gender) {
        case 'Homme':
            // On combine le gras avec un contour bleu foncé
            return '<span style="color: #3b82f6; font-weight: bold; -webkit-text-stroke: 1.5px #2563eb;">♂</span>';
        case 'Femme':
            // On combine le gras avec un contour rose foncé
            return '<span style="color: #ec4899; font-weight: bold; -webkit-text-stroke: 1.5px #be185d;">♀</span>';
        default:
            // On combine le gras avec un contour gris
            return '<span style="font-weight: bold; -webkit-text-stroke: 0.5px #6b7280;">⚪</span>';
    }
}


export function render() {
    const isLoggedIn = !!window.userId;
    const activeMeleeId = window.getActiveMeleeTournamentId ? window.getActiveMeleeTournamentId() : null;
    if (isLoggedIn && !activeMeleeId) {
        window.location.hash = '#melee/accueil';
        return;
    }
    const canStart = players.length >= 4;
    APP_CONTAINER.innerHTML = `
        <main class="p-8">
            <h2 class="text-3xl font-bold mb-6">Gestion des Rencontres</h2>
            ${!canStart ? `
                <div class="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
                    <p class="font-bold">Joueurs insuffisants</p>
                    <p>Vous devez avoir au moins 4 joueurs enregistrés pour pouvoir créer des rencontres.</p>
                </div>
            ` : `
                <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 class="text-2xl font-semibold text-gray-700 mb-4">Nombre d'équipes à former</h3>
                    <p class="text-sm text-gray-600 mb-4">Utilisez cet outil pour simuler la répartition des <b>${players.length}</b> joueurs. Ce paramètre sera sauvegardé.</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                         <div>
                            <label for="teamCountSimulator" class="block text-sm font-medium text-gray-700">Nombre d'équipes souhaitées</label>
                         
                            <input type="number" id="teamCountSimulator" min="2" max="${Math.floor(players.length / 2)}" class="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm" value="${settings.desiredNumTeams || ''}">
                        </div>
                        <div id="compositionSimulatorResult" class="mt-1 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                           <p class="font-semibold">Composition des équipes :</p>
                           <p>Veuillez indiquer un nombre d'équipes pour la simulation.</p>
                        </div>
                    </div>
                </section>
                
                <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 class="text-2xl font-semibold text-gray-700 mb-4">Nombre de phases du tournoi</h3>
                    <div class="flex flex-col md:flex-row gap-4 items-end">
                        <div class="flex-grow">
                            <label for="numPhases" class="block text-sm font-medium text-gray-700">Nombre de phases de rencontres à créer</label>
                            <input type="number" id="numPhases" min="1" value="1" class="mt-1 w-full md:w-auto p-2 border border-gray-300 rounded-md shadow-sm">
                        </div>
                        <button id="createPhasesBtn" class="w-full md:w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 shadow-md">Créer</button>
                    </div>
                </section>
                
                <div class="space-y-8">
                    <section class="p-6 bg-gray-50 rounded-lg border border-gray-200 h-fit">
                         <h3 class="text-2xl font-semibold text-gray-700 mb-4">Liste des phases</h3>
                         <div id="phasesList" class="space-y-2"></div>
                         ${rounds.length > 0 ? `<button id="clearAllPhasesBtn" class="mt-4 w-full bg-red-600 text-white text-sm py-2 px-3 rounded-md hover:bg-red-700">Effacer toutes les phases</button>` : ''}
                    </section>
    
                    <section class="p-6 bg-gray-50 rounded-lg border border-gray-200">
                        <div id="phaseDetails">
                        </div>
                    </section>
                </div>
            `}
        </main>
    `;
    if (canStart) {
        setupLogic();
        renderPhasesList();
        renderPhaseDetails(selectedPhaseId);
    }
}



function renderPhasesList() {
    const listDiv = document.getElementById('phasesList');
    if (!listDiv) return;
    if (rounds.length === 0) {
        listDiv.innerHTML = `<p class="text-sm text-gray-500">Aucune phase créée.</p>`;
        return;
    }
    listDiv.innerHTML = rounds.map(phase => `
        <div class="flex items-center justify-between p-2 rounded-md ${selectedPhaseId === phase.id ? 'bg-teal-100' : 'bg-white'} shadow-sm border">
            <span class="font-medium text-gray-800">${phase.name}</span>
            <div class="flex items-center space-x-2">
                ${phase.generated
                    ? `<button data-id="${phase.id}" class="show-phase-btn bg-green-500 text-white text-sm py-1 px-3 rounded-md hover:bg-green-600">Afficher</button>`
                    : `<button data-id="${phase.id}" class="generate-phase-btn bg-teal-500 text-white text-sm py-1 px-3 rounded-md hover:bg-teal-600">Générer</button>`
                }
                <button data-id="${phase.id}" data-name="${phase.name}" class="delete-phase-btn bg-red-600 text-white rounded-md w-6 h-6 flex items-center justify-center hover:bg-red-700 transition-colors"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `).join('');
    attachPhaseListListeners();
}

/**
 * Affiche les rencontres avec les équipes et scores au milieu.
 * @param {string} phaseId 
 */
function renderPhaseDetails(phaseId) {
    const detailsDiv = document.getElementById('phaseDetails');
    const phase = rounds.find(r => r.id === phaseId);

    if (!phase) {
        detailsDiv.innerHTML = `
            <h3 class="text-2xl font-semibold text-gray-700 mb-4">Composition des équipes et rencontres</h3>
            <p class="text-center text-gray-500">Sélectionnez une phase dans la liste pour voir ses détails.</p>
        `;
        return;
    }
    
    let content = `<h3 class="text-2xl font-semibold text-gray-700 mb-4">Composition des équipes et rencontres de la ${phase.name}</h3>`;

    if (!phase.generated) {
        content += `<p class="text-center text-gray-500">Cliquez sur "Générer" pour créer les équipes et rencontres de cette phase.</p>`;
    } else {
        content += `
            <div class="space-y-4">
                ${phase.matches.map(match => {
                    const team1 = phase.teams.find(t => t.id === match.team1.id);
                    const team2 = phase.teams.find(t => t.id === match.team2.id);
                    let team1Style = 'border-gray-200';
                    let team2Style = 'border-gray-200';

                    if(match.winnerId) {
                        if(match.winnerId === team1.id) {
                            team1Style = 'border-green-500 bg-green-50';
                            team2Style = 'border-red-500 bg-red-50 opacity-70';
                        } else {
                            team2Style = 'border-green-500 bg-green-50';
                            team1Style = 'border-red-500 bg-red-50 opacity-70';
                        }
                    }

                    return `
                    <div class="grid grid-cols-1 md:grid-cols-8 items-stretch gap-4 text-center p-2">
                        <div class="md:col-span-3 bg-white p-3 rounded-md border-2 shadow-sm ${team1Style}">
                            <h5 class="font-bold text-teal-700">${team1.name} (Niveau: ${team1.totalLevel})</h5>
                            <ul class="text-sm list-disc list-inside ml-1 text-left mt-2">
                                ${team1.players.map(p => `<li class="player-swap-trigger p-1 rounded hover:bg-teal-100 cursor-pointer" data-player-id="${p.id}" data-team-id="${team1.id}" data-phase-id="${phase.id}">${p.firstName} ${p.lastName} (${getGenderSymbol(p.gender)}, N${p.level})</li>`).join('')}
                            </ul>
                        </div>
                        
                        <div class="md:col-span-2 flex justify-center items-center">
                             <select data-phase-id="${phase.id}" data-match-id="${match.id}" data-team="1" class="score-select w-20 p-1 border rounded-md text-center">${generateScoreOptions(21, match.score1)}</select>
                             <span class="mx-4 font-bold text-xl">-</span>
                             <select data-phase-id="${phase.id}" data-match-id="${match.id}" data-team="2" class="score-select w-20 p-1 border rounded-md text-center">${generateScoreOptions(21, match.score2)}</select>
                        </div>

                        <div class="md:col-span-3 bg-white p-3 rounded-md border-2 shadow-sm ${team2Style}">
                            <h5 class="font-bold text-teal-700">${team2.name} (Niveau: ${team2.totalLevel})</h5>
                            <ul class="text-sm list-disc list-inside ml-1 text-left mt-2">
                                ${team2.players.map(p => `<li class="player-swap-trigger p-1 rounded hover:bg-teal-100 cursor-pointer" data-player-id="${p.id}" data-team-id="${team2.id}" data-phase-id="${phase.id}">${p.firstName} ${p.lastName} (${getGenderSymbol(p.gender)}, N${p.level})</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    `;
                }).join('')}
                
                ${phase.exemptTeam ? `
                    <div class="mt-8 pt-4 border-t">
                        <h4 class="text-xl font-semibold text-gray-800 mb-3 text-center">Équipe Exempte</h4>
                         <div class="bg-white p-3 rounded-md border shadow-sm max-w-md mx-auto">
                            <h5 class="font-bold text-gray-600">${phase.exemptTeam.name} (Niveau: ${phase.exemptTeam.totalLevel})</h5>
                            <ul class="text-sm list-disc list-inside ml-1">
                               ${phase.exemptTeam.players.map(p => `<li>${p.firstName} ${p.lastName} (${getGenderSymbol(p.gender)}, N${p.level})</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                `: ''}
            </div>
        `;
    }

    detailsDiv.innerHTML = content;
    
    if (phase.generated) {
        attachPhaseDetailsListeners(phaseId);
    }
}


/**
 * Attache tous les écouteurs nécessaires pour les détails d'une phase (scores et échange de joueurs).
 */
function attachPhaseDetailsListeners(phaseId) {
    attachScoreListeners(); // On continue d'attacher les écouteurs pour les scores

    document.querySelectorAll('.player-swap-trigger').forEach(el => {
        el.addEventListener('click', (e) => {
            const { playerId, teamId, phaseId } = e.currentTarget.dataset;
            
            const phase = rounds.find(r => r.id === phaseId);
            const isMatchPlayed = phase.matches.some(m => m.score1 !== null || m.score2 !== null);
            
            if (isMatchPlayed) {
                showToast("Impossible de modifier les équipes : des scores ont déjà été saisis pour cette phase.", "error");
                return;
            }

            showSwapPlayerModal(playerId, teamId, phaseId);
        });
    });
}

/**
 * Affiche une modale pour permettre l'échange d'un joueur.
 */
function showSwapPlayerModal(playerId, teamId, phaseId) {
    const phase = rounds.find(r => r.id === phaseId);
    const sourceTeam = phase.teams.find(t => t.id === teamId);
    const sourcePlayer = sourceTeam.players.find(p => p.id === playerId);

    if (!sourcePlayer) return;

    // Construit la liste des autres joueurs pour le menu déroulant
    let optionsHTML = '';
    phase.teams.forEach(targetTeam => {
        // On ne peut pas échanger un joueur avec un coéquipier
        if (targetTeam.id === teamId) return; 
        
        optionsHTML += `<optgroup label="Équipe ${targetTeam.name}">`;
        targetTeam.players.forEach(targetPlayer => {
            optionsHTML += `<option value="${targetPlayer.id}">${targetPlayer.firstName} ${targetPlayer.lastName}</option>`;
        });
        optionsHTML += `</optgroup>`;
    });

    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
        <p class="mb-4 text-gray-700">Avec quel joueur souhaitez-vous échanger <strong>${sourcePlayer.firstName} ${sourcePlayer.lastName}</strong> ?</p>
        <select id="swap-player-select" class="w-full p-2 border border-gray-300 rounded-md bg-white shadow-sm">
            <option value="">-- Choisissez un joueur --</option>
            ${optionsHTML}
        </select>
    `;

    showModal(`Échanger un joueur`, modalContent, () => {
        const targetPlayerId = document.getElementById('swap-player-select').value;
        if (!targetPlayerId) {
            showToast("Veuillez sélectionner un joueur.", "error");
            return;
        }
        
        // Retrouver le joueur cible et son équipe
        let targetPlayer, targetTeam;
        for (const team of phase.teams) {
            const foundPlayer = team.players.find(p => p.id === targetPlayerId);
            if (foundPlayer) {
                targetPlayer = foundPlayer;
                targetTeam = team;
                break;
            }
        }

        // Effectuer l'échange
        const sourcePlayerIndex = sourceTeam.players.findIndex(p => p.id === sourcePlayer.id);
        const targetPlayerIndex = targetTeam.players.findIndex(p => p.id === targetPlayer.id);

        sourceTeam.players.splice(sourcePlayerIndex, 1, targetPlayer);
        targetTeam.players.splice(targetPlayerIndex, 1, sourcePlayer);

        // Recalculer les niveaux des équipes
        sourceTeam.totalLevel = sourceTeam.players.reduce((acc, p) => acc + p.level, 0);
        targetTeam.totalLevel = targetTeam.players.reduce((acc, p) => acc + p.level, 0);
        
        saveData();
        renderPhaseDetails(phaseId); // Rafraîchir l'affichage
        showToast("L'échange a été effectué avec succès !", "success");
    });
}


function handleGeneratePhase(phaseId) {
    //  On lit directement depuis l'objet "settings"
    const numTeams = settings.desiredNumTeams;

    if (!numTeams) { // La validation se fait sur la base de la donnée sauvegardée
        showToast("Veuillez d'abord saisir un nombre d'équipes valide dans le calculateur.", "error");
        document.getElementById('teamCountSimulator')?.focus();
        return;
    }
    
    const result = generateTeamsAndMatches({ allPlayers: players, existingRounds: rounds, numTeams: numTeams });
    
    if (result.error) {
        showToast(result.error, "error", 5000);
        return;
    }
    
    const phaseIndex = rounds.findIndex(r => r.id === phaseId);
    if (phaseIndex > -1) {
        rounds[phaseIndex].generated = true;
        rounds[phaseIndex].teams = result.teams;
        rounds[phaseIndex].matches = result.matches;
        rounds[phaseIndex].exemptTeam = result.exemptTeam || null;
        saveData();
        selectedPhaseId = phaseId;
        renderPhasesList();
        renderPhaseDetails(phaseId);
        showToast("Équipes et rencontres générées avec succès !", "success");
    }
}

function setupLogic() {
    const createPhasesBtn = document.getElementById('createPhasesBtn');
    const numPhasesInput = document.getElementById('numPhases');
    const simulatorInput = document.getElementById('teamCountSimulator');
    const simulatorResultDiv = document.getElementById('compositionSimulatorResult');

    // Logique pour la création de la structure des phases
    createPhasesBtn.addEventListener('click', () => {
        const numToCreate = parseInt(numPhasesInput.value);
        if (isNaN(numToCreate) || numToCreate < 1) return showToast("Nombre de phases invalide.", "error");
        
        const currentCount = rounds.length;
        for (let i = 0; i < numToCreate; i++) {
            // On ajoute la propriété "exemptTeam" dès la création
            rounds.push({ 
                id: 'phase_' + Date.now() + i, 
                name: `Phase ${currentCount + i + 1}`, 
                generated: false, 
                teams: [], 
                matches: [], 
                exemptTeam: null 
            });
        }
        saveData();
        render(); // On re-render la page pour afficher le bouton "Effacer toutes les phases" si besoin
        showToast(`${numToCreate} phase(s) créée(s).`, "success");
    });
    
    //  Le calculateur sauvegarde maintenant la donnée
    const simulatorEventHandler = (e) => {
        const numTeamsStr = e.target.value;
        const totalPlayers = players.length;
        
        if (numTeamsStr === '') {
            settings.desiredNumTeams = null;
            simulatorResultDiv.innerHTML = `<p class="font-semibold">Composition :</p><p>Indiquez un nombre d'équipes.</p>`;
            saveData(); // On sauvegarde la suppression
            return;
        }

        const numTeams = parseInt(numTeamsStr);
        if (isNaN(numTeams) || numTeams < 2 || numTeams > Math.floor(totalPlayers / 2)) {
            settings.desiredNumTeams = null;
            simulatorResultDiv.innerHTML = `<p class="font-semibold text-red-600">Invalide.</p><p class="text-sm">Entre 2 et ${Math.floor(totalPlayers / 2)}.</p>`;
            saveData(); // On sauvegarde la suppression
            return;
        }
        
        settings.desiredNumTeams = numTeams; // On sauvegarde le nombre valide
        saveData(); // On persiste la nouvelle valeur immédiatement !
        
        const baseSize = Math.floor(totalPlayers / numTeams);
        const remainder = totalPlayers % numTeams;
        let text = (remainder === 0)
            ? `Toutes les <b>${numTeams}</b> équipes auront <b>${baseSize}</b> joueurs.`
            : `<b>${remainder}</b> équipe(s) de <b>${baseSize + 1}</b> & <b>${numTeams - remainder}</b> équipe(s) de <b>${baseSize}</b>.`;
        simulatorResultDiv.innerHTML = `<p class="font-semibold">Composition calculée :</p><p>${text}</p>`;
    };
    
    simulatorInput.addEventListener('input', simulatorEventHandler);
    
    // On s'assure que la composition s'affiche au chargement si une valeur était déjà sauvegardée
    if (settings.desiredNumTeams) {
        simulatorEventHandler({ target: { value: settings.desiredNumTeams } });
    }

    // Logique pour le bouton "Effacer toutes les phases"
    document.getElementById('clearAllPhasesBtn')?.addEventListener('click', () => {
        showModal(
            "Confirmation", 
            Object.assign(document.createElement('p'), { textContent: "Voulez-vous vraiment supprimer toutes les phases ? Cette action est irréversible." }), 
            () => {
                clearAllRounds();
                selectedPhaseId = null;
                render();
                showToast("Toutes les phases ont été supprimées.", "success");
            }, 
            true
        );
    });
}

function attachPhaseListListeners() {
    document.querySelectorAll('.generate-phase-btn').forEach(b => b.addEventListener('click', () => handleGeneratePhase(b.dataset.id)));
    document.querySelectorAll('.show-phase-btn').forEach(b => b.addEventListener('click', () => {
        selectedPhaseId = b.dataset.id;
        renderPhasesList();
        renderPhaseDetails(selectedPhaseId);
    }));
    document.querySelectorAll('.delete-phase-btn').forEach(b => b.addEventListener('click', () => {
        const { id, name } = b.dataset;
        showModal("Confirmation", Object.assign(document.createElement('p'), {textContent: `Supprimer la "${name}" ?`}), () => {
            deleteRound(id);
            if (selectedPhaseId === id) selectedPhaseId = null;
            render();
            showToast(`"${name}" a été supprimée.`, "success");
        }, true);
    }));
}

/**
 * MODIFICATION : Déclenche le rafraîchissement de l'affichage pour les couleurs.
 */
function attachScoreListeners() {
    document.querySelectorAll('.score-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const { phaseId, matchId, team } = e.target.dataset;
            const score = e.target.value === "" ? null : parseInt(e.target.value);
            
            const phase = rounds.find(r => r.id === phaseId);
            const match = phase?.matches.find(m => m.id === matchId);
            if (!match) return;

            if (team === '1') match.score1 = score;
            else match.score2 = score;

            if (match.score1 !== null && match.score2 !== null) {
                if(match.score1 > match.score2) match.winnerId = match.team1.id;
                else if (match.score2 > match.score1) match.winnerId = match.team2.id;
                else match.winnerId = null; 
            } else {
                match.winnerId = null;
            }
            
            saveData();
            renderPhaseDetails(phaseId);
        });
    });
}

function generateScoreOptions(maxScore, selectedValue) {
    let options = '<option value="">-</option>';
    for (let i = 0; i <= maxScore; i++) {
        options += `<option value="${i}" ${selectedValue === i ? 'selected' : ''}>${i}</option>`;
    }
    return options;
}
