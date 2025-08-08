// Contenu de : src/melee/shared/data.js

import { showToast } from './ui.js';

// Les données sont ici, et exportées pour être lues par d'autres modules
export let players = [];
export let rounds = [];
export let settings = {}; // Paramètres du tournoi mêlée (ex: nombre d'équipes)

const MELEE_STORAGE_KEY = 'guestMeleeTournamentData';

// --- Fonctions de Persistance ---

/**
 * Sauvegarde les données. S'adapte automatiquement :
 * - En ligne (Firestore) si l'utilisateur est connecté et un tournoi Mêlée est actif.
 * - Localement (localStorage) si l'utilisateur est en mode invité.
 */
export async function saveData() {
    const isLoggedIn = !!window.userId;

    if (isLoggedIn) {
        // --- SAUVEGARDE EN LIGNE (FIRESTORE) ---
        if (typeof window.getActiveMeleeTournamentId !== 'function') {
            console.error("La fonction pour obtenir l'ID du tournoi mêlée n'est pas disponible.");
            return;
        }
        const activeMeleeId = window.getActiveMeleeTournamentId();
        if (!activeMeleeId) {
            console.warn("Aucun tournoi à la mêlée n'est actif. Sauvegarde en ligne ignorée.");
            return;
        }
        
        try {
            const tournoiRef = window.doc(window.db, "tournaments", activeMeleeId);
            await window.updateDoc(tournoiRef, {
                meleeData: {
                    players: players,
                    rounds: rounds,
                    settings: settings // On sauvegarde aussi les paramètres
                }
            });
            console.log("Données du tournoi à la mêlée sauvegardées sur Firestore.");
        } catch (e) {
            console.error("Erreur lors de la sauvegarde sur Firestore :", e);
            showToast("Erreur de sauvegarde en ligne.", "error");
        }

    } else {
        // --- SAUVEGARDE LOCALE (NAVIGATEUR) ---
        try {
            // On sauvegarde les joueurs, les phases ET les paramètres
            localStorage.setItem(MELEE_STORAGE_KEY, JSON.stringify({ players, rounds, settings }));
        } catch (e) { 
            console.error("Erreur de sauvegarde locale:", e); 
        }
    }
}

/**
 * Charge les données. S'adapte automatiquement.
 */
export function loadData() {
    const isLoggedIn = !!window.userId;

    if (isLoggedIn) {
        // Le chargement en mode connecté est géré par la fonction setMeleeData
        // pour éviter les conflits. On initialise simplement les tableaux.
        players.length = 0;
        rounds.length = 0;
        settings = {};
    } else {
        // --- CHARGEMENT LOCAL (MODE INVITÉ) ---
        try {
            const storedData = localStorage.getItem(MELEE_STORAGE_KEY);
            if (storedData) {
                const data = JSON.parse(storedData);
                players.length = 0;
                rounds.length = 0;
                players.push(...(data.players || []));
                rounds.push(...(data.rounds || []));
                // LA LIGNE CRUCIALE QUI MANQUAIT EST CI-DESSOUS :
                settings = data.settings || {}; 
            } else {
                players.length = 0;
                rounds.length = 0;
                settings = {};
            }
        } catch (e) {
            players.length = 0;
            rounds.length = 0;
            settings = {};
        }
    }
}

/**
 * Met à jour les données du module Mêlée depuis le script principal (mode connecté).
 */
export function setMeleeData(meleeData) {
    const newPlayers = meleeData?.players || [];
    const newRounds = meleeData?.rounds || [];
    const newSettings = meleeData?.settings || {};

    players.length = 0;
    rounds.length = 0;
    players.push(...newPlayers);
    rounds.push(...newRounds);
    settings = newSettings;
}


// --- Fonctions de manipulation des Joueurs ---
export function playerExists(firstName, lastName, currentPlayerId = null) {
    // ... (le reste des fonctions ne change pas)
    const normalizedFirstName = firstName.trim().toLowerCase();
    const normalizedLastName = lastName.trim().toLowerCase();
    return players.some(player => {
        if (currentPlayerId && player.id === currentPlayerId) return false;
        return player.firstName.trim().toLowerCase() === normalizedFirstName &&
               player.lastName.trim().toLowerCase() === normalizedLastName;
    });
}
    
export function addPlayer(firstName, lastName, gender, level) {
    const newPlayer = {
        id: 'player_' + Date.now() + Math.random(),
        firstName, lastName, gender, level
    };
    players.push(newPlayer);
    saveData();
}

export function deletePlayer(playerId) {
    const indexToDelete = players.findIndex(p => p.id === playerId);
    if (indexToDelete > -1) {
        players.splice(indexToDelete, 1);
        saveData();
    }
}

export function updatePlayer(playerId, newData) {
    const playerIndex = players.findIndex(p => p.id === playerId);
    if (playerIndex > -1) {
        players[playerIndex] = { ...players[playerIndex], ...newData };
        saveData();
    }
}

export function clearAllPlayers() {
    players.length = 0;
    saveData();
}

// --- Fonctions de manipulation des Phases ---
export function deleteRound(roundId) {
    const index = rounds.findIndex(r => r.id === roundId);
    if (index > -1) {
        rounds.splice(index, 1);
        saveData();
    }
}

export function clearAllRounds() {
    rounds.length = 0;
    saveData();
}
