// Contenu de : src/melee/melee.js

// --- IMPORTATIONS ---
// On importe les fonctions de rendu de chaque page. On les renomme pour éviter les conflits.
import { render as renderAccueilPage } from './pages/accueil.js';
import { render as renderJoueursPage } from './pages/joueurs.js';
import { render as renderRencontresPage } from './pages/rencontres.js';
import { render as renderClassementPage } from './pages/classement.js';


// On importe uniquement les fonctions nécessaires du module de données

import { loadData, players, setMeleeData } from './shared/data.js';

// --- CONSTANTES ET VARIABLES GLOBALES DU MODULE ---
const APP_CONTAINER = document.getElementById('app-container');
const MAIN_NAV = document.querySelector('nav');
const FOOTER = document.querySelector('footer');

let isMeleeNavActive = false;
let originalNavLinksHTML = '';


// --- LOGIQUE DE NAVIGATION PRINCIPALE ---

// On expose la fonction de mise à jour pour qu'elle soit accessible par script.js
window.onMeleeDataUpdate = setMeleeData;

// On crée une fonction pour forcer le rafraîchissement de la page Mêlée actuelle
window.rerenderMeleePage = () => {
    const hash = window.location.hash;
    if (hash.startsWith('#melee')) {
        routeMeleePages(hash);      // Redessine le contenu de la page
        updateMeleeNavDisplay();    // Met à jour le compteur dans la nav
    }
};

/**
 * Point d'entrée principal pour le mode Mêlée.
 * Décide s'il faut afficher l'interface Mêlée ou restaurer l'interface Équipe.
 */
function handleMeleeRoute() {
    const hash = window.location.hash;

    if (hash.startsWith('#melee')) {
        if (!isMeleeNavActive) {
            // Moment où l'on bascule VERS le mode Mêlée
            renderMeleeNav();
            isMeleeNavActive = true;
            
            // NOUVELLE LOGIQUE : Forcer le rechargement des données du tournoi Mêlée
            if (typeof window.loadTournamentDataById === 'function') {
                const activeMeleeId = window.getActiveMeleeTournamentId ? window.getActiveMeleeTournamentId() : null;
                window.loadTournamentDataById(activeMeleeId);
            }
        }
        routeMeleePages(hash);
    } else {
        const isNeutralPage = (hash === '#account' || hash === '#auth' || hash === '#tournaments');
        if (isMeleeNavActive && !isNeutralPage) {
            // Moment où l'on bascule VERS le mode Équipe
            restoreTeamNav();
            isMeleeNavActive = false;

            // NOUVELLE LOGIQUE : Forcer le rechargement des données du tournoi par Équipes
            if (typeof window.loadTournamentDataById === 'function') {
                const activeTeamId = window.getActiveTeamTournamentId ? window.getActiveTeamTournamentId() : null;
                window.loadTournamentDataById(activeTeamId);
            }
        }
    }
}

function updateMeleeNavDisplay() {
    const nameSpan = document.getElementById('current-tournament-name');
    const playerCountSpan = document.getElementById('melee-player-count');
    if (!nameSpan || !playerCountSpan) return;

    const currentData = window.getCurrentTournamentData ? window.getCurrentTournamentData() : null;
    const activeMeleeId = window.getActiveMeleeTournamentId ? window.getActiveMeleeTournamentId() : null;

    // Met à jour le compteur de joueurs
    const isLoggedIn = !!window.userId;
    const hasActiveMeleeTournament = !!(window.getActiveMeleeTournamentId && window.getActiveMeleeTournamentId());
    if (!isLoggedIn || hasActiveMeleeTournament) {
         playerCountSpan.innerHTML = `<p class="text-xs">Joueurs : <b>${players.length}</b></p>`;
    } else {
         playerCountSpan.innerHTML = '';
    }
}
window.updateMeleeNavDisplay = updateMeleeNavDisplay; // On l'expose pour l'appeler depuis d'autres fichiers

/**
 * Construit et affiche la barre de navigation verte du mode Mêlée,
 * et attache les fonctionnalités aux boutons.
 */
function renderMeleeNav() {
    if (!MAIN_NAV) return;

    // Change la couleur principale de la barre de navigation et du footer
    MAIN_NAV.classList.remove('bg-blue-600');
    MAIN_NAV.classList.add('bg-teal-600');
    if (FOOTER) {
        FOOTER.classList.remove('bg-blue-600');
        FOOTER.classList.add('bg-teal-600');
    }

    // Injecte le HTML de la navigation Mêlée
    MAIN_NAV.innerHTML = getMeleeNavHTML();

    // 1. On demande au script principal de gérer la visibilité des blocs de connexion
    if (typeof window.updateNavLinksVisibility === 'function') {
        window.updateNavLinksVisibility();
    }
	updateMeleeNavDisplay(); 

    // 2. On rebranche les fonctionnalités sur les NOUVEAUX boutons que nous venons de créer

    // Bouton "Déconnexion"
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (typeof window.cleanupFirestoreListeners === 'function') {
                window.cleanupFirestoreListeners();
            }
            if (window.signOut && window.auth) {
                await window.signOut(window.auth);
            }
        });
    }

    // Bouton "Mon Compte" (pour les utilisateurs connectés)
    const myAccountBtn = document.getElementById('my-account-btn');
    if (myAccountBtn) {
        myAccountBtn.addEventListener('click', () => {
            window.location.hash = '#account';
        });
    }

    // Bouton "Changer de tournoi"
    const selectTournamentBtn = document.getElementById('select-tournament-btn');
    if(selectTournamentBtn) {
        selectTournamentBtn.addEventListener('click', () => {
            window.location.hash = '#tournaments';
        });
    }
}

/**
 * Restaure l'interface du mode Équipe (couleurs et liens).
 */
function restoreTeamNav() {
    if (!MAIN_NAV) return;

    MAIN_NAV.classList.remove('bg-teal-600');
    MAIN_NAV.classList.add('bg-blue-600');

    if (FOOTER) {
        FOOTER.classList.remove('bg-teal-600');
        FOOTER.classList.add('bg-blue-600');
    }

    // On réinjecte la structure HTML originale de la navigation
    MAIN_NAV.innerHTML = `
        <img src="Images/Logo_EsayPlay.png" alt="Logo" class="h-20 w-auto mb-6">

		<div id="auth-cta-container" class="w-full text-center mb-4">
			<a href="#auth" onclick="sessionStorage.setItem('loginRedirect', window.location.hash || '#home')" class="bg-blue-700 text-white text-xs py-1 px-2 rounded-md hover:bg-blue-800">Mon Compte</a>
		</div>

		<div id="auth-info" class="text-white text-sm text-center mb-4 hidden">
			<p id="user-email" class="font-bold break-words"></p>
			<div id="current-tournament-name" class="text-xs italic mt-1"></div>
			<div class="flex flex-col space-y-2 mt-2">
				<button id="select-tournament-btn" class="bg-blue-700 text-white text-xs py-1 px-2 rounded-md hover:bg-blue-800">Changer de tournoi</button>
				<a href="#account" id="my-account-btn" class="bg-gray-500 text-white text-xs py-1 px-2 rounded-md hover:bg-gray-600">Mon Compte</a>
				<button id="logout-btn" class="bg-red-500 text-white text-xs py-1 px-2 rounded-md mt-2 hover:bg-red-600">Déconnexion</button>
			</div>
		</div>

		<ul id="main-nav-links" class="flex flex-col space-y-2 w-full h-full">
			${originalNavLinksHTML}
		</ul>
    `;

    // On rebranche les écouteurs d'événements du script principal car les éléments ont été recréés
    document.getElementById('logout-btn').addEventListener('click', async () => {
        if (typeof window.cleanupFirestoreListeners === 'function') {
            window.cleanupFirestoreListeners();
        }
        if (window.signOut && window.auth) {
            await window.signOut(window.auth);
        }
    });

    document.getElementById('select-tournament-btn').addEventListener('click', () => {
        window.location.hash = '#tournaments';
    });

    document.getElementById('my-account-btn').addEventListener('click', () => {
        window.location.hash = '#account';
    });


    // On force la mise à jour de la visibilité des onglets et de l'état de connexion de l'autre script
    if (typeof window.updateNavLinksVisibility === 'function') {
        setTimeout(() => window.updateNavLinksVisibility(), 0);
    }
}

/**
 * Génère le code HTML pour la barre de navigation du mode Mêlée.
 */
function getMeleeNavHTML() {
    const isLoggedIn = !!window.userId;
    const hasActiveMeleeTournament = !!(window.getActiveMeleeTournamentId && window.getActiveMeleeTournamentId());

    const shouldShowLinks = !isLoggedIn || hasActiveMeleeTournament;

    return `
        <img src="Images/Logo_EsayPlay.png" alt="Logo" class="h-20 w-auto mb-6">

        <div id="auth-cta-container" class="w-full text-center mb-4">
            <a href="#auth" onclick="sessionStorage.setItem('loginRedirect', window.location.hash || '#melee/accueil')" class="bg-teal-700 text-white text-xs py-1 px-2 rounded-md hover:bg-teal-800">Mon Compte</a>
        </div>

        <div id="auth-info" class="text-white text-sm text-center mb-4 hidden">
            <p id="user-email" class="font-bold break-words"></p>
            <div id="current-tournament-name" class="text-xs italic mt-1"></div>

            <div id="melee-player-count" class="text-xs mt-1"></div>

            <div class="flex flex-col space-y-2 mt-2">
                <button id="select-tournament-btn" class="bg-teal-700 text-white text-xs py-1 px-2 rounded-md hover:bg-teal-800">Changer de tournoi</button>
                <a href="#account" id="my-account-btn" class="bg-gray-500 text-white text-xs py-1 px-2 rounded-md hover:bg-gray-600">Mon Compte</a>
                <button id="logout-btn" class="bg-red-500 text-white text-xs py-1 px-2 rounded-md mt-2 hover:bg-red-600">Déconnexion</button>
            </div>
        </div>

        <ul id="main-nav-links" class="flex flex-col space-y-2 w-full h-full">
            <li><a href="#melee/accueil" class="nav-link flex items-center space-x-2 text-white hover:text-teal-100 px-3 py-2"><i class="fas fa-home w-6"></i><span>Accueil Mêlée</span></a></li>

            ${shouldShowLinks ? `
                <li><a href="#melee/joueurs" class="nav-link flex items-center space-x-2 text-white hover:text-teal-100 px-3 py-2"><i class="fas fa-users w-6"></i><span>Joueurs</span></a></li>
                <li><a href="#melee/rencontres" class="nav-link flex items-center space-x-2 text-white hover:text-teal-100 px-3 py-2"><i class="fas fa-sitemap w-6"></i><span>Rencontres</span></a></li>
                <li><a href="#melee/classement" class="nav-link flex items-center space-x-2 text-white hover:text-teal-100 px-3 py-2"><i class="fas fa-list-ol w-6"></i><span>Classement</span></a></li>
            ` : ''}

            <li class="mt-auto">
                <a href="#home" onclick="window.location.hash='#home'" class="nav-link flex items-center text-sm space-x-1.5 text-white px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200">
                    <i class="fas fa-exchange-alt w-5"></i>
                    <span>Tournoi par équipes</span>
                </a>
            </li>
        </ul>
    `;
}

/**
 * "Sous-routeur" qui appelle le bon module de page en fonction de l'URL.
 */
function routeMeleePages(hash) {
    const subpage = hash.split('/')[1] || 'accueil';

    // Met à jour le lien actif dans la navigation
    document.querySelectorAll('#main-nav-links a').forEach(link => {
        const linkHash = link.getAttribute('href');
        link.classList.remove('active-link');
        if (linkHash === hash || (subpage === 'accueil' && linkHash === '#melee/accueil')) {
            link.classList.add('active-link');
        }
    });

    // Appelle la fonction render() du module de page approprié
    switch (subpage) {
        case 'joueurs':
            renderJoueursPage();
            break;
        case 'rencontres':
            renderRencontresPage();
            break;
        case 'classement':
            renderClassementPage();
            break;
        case 'accueil':
        default:
            renderAccueilPage();
            break;
    }
}

// --- INITIALISATION DU MODULE ---
document.addEventListener('DOMContentLoaded', () => {
    // On mémorise les liens du mode Équipe avant toute modification
    const navLinksContainer = document.getElementById('main-nav-links');
    if (navLinksContainer) {
        originalNavLinksHTML = navLinksContainer.innerHTML;
    }

    // On charge les données sauvegardées (joueurs, etc.)
    loadData();

    // On attache l'écouteur de changement d'URL
    window.addEventListener('hashchange', handleMeleeRoute);

    // On exécute le routeur une première fois au cas où l'URL de départ est déjà en mode Mêlée
    handleMeleeRoute();
});