// --- Importations Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// --- Configuration et Initialisation de Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyA1AoHpUpvD12YUzLe91SWNpxmPRPB36aQ",
    authDomain: "easyplayapp-97e15.firebaseapp.com",
    projectId: "easyplayapp-97e15",
    storageBucket: "easyplayapp-97e15.firebasestorage.app",
    messagingSenderId: "741324257784",
    appId: "1:741324257784:web:06a85e1f10b8dc804afe0d",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


(function() {
    // --- OBJET D'ÉTAT GLOBAL CENTRALISÉ ---
    const AppState = {
        isGuestMode: true,
        auth: {
            allUserTournaments: [],
            activeTeamTournamentId: null,
            activeMeleeTournamentId: null,
        },
        listeners: {
            currentUserPrivateData: null,
            currentTournament: null,
        },
        teamTournament: {
            currentData: null,
            allTeams: [],
            allBrassagePhases: [],
            eliminationPhases: {},
            currentSecondaryGroupsPreview: {},
            eliminatedTeams: new Set(),
            poolGenerationBasis: 'initialLevels',
            currentDisplayedPhaseId: null,
            matchOccurrenceMap: new Map(),
        }
    };

    // --- Constantes et Variables Globales ---

    const APP_CONTAINER = document.getElementById('app-container');

    // Les clés de localStorage sont réactivées pour le mode invité (Guest Mode).
    // La persistance Firestore est toujours utilisée pour les utilisateurs connectés.
    const TEAM_DATA_KEY = 'volleyTeamsData';
    const BRASSAGE_PHASES_KEY = 'volleyBrassagePhases';
    const ELIMINATION_PHASES_KEY = 'volleyEliminationPhases';
    const SECONDARY_GROUPS_SELECTION_KEY = 'volleySecondaryGroupsSelection'; // Non utilisé, à supprimer si non pertinent
    const POOL_GENERATION_BASIS_KEY = 'volleyPoolGenerationBasis'; // Réactivé
    const SECONDARY_GROUPS_PREVIEW_KEY = 'volleySecondaryGroupsPreview';
    const ELIMINATED_TEAMS_KEY = 'volleyEliminatedTeams';

    const PHASE_TYPE_INITIAL = 'initial_brassage';
    const PHASE_TYPE_SECONDARY_BRASSAGE = 'secondary_brassage';
    const PHASE_TYPE_ELIMINATION_SEEDING = 'elimination_seeding'; // Phase spéciale pour le regroupement éliminatoire

    // Variable pour le mode invité
    const GUEST_MODE_MAX_TEAMS = 9;


    // --- Cache des éléments DOM de la modale ---
    const actionModal = document.getElementById('actionModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    let modalConfirmBtn = document.getElementById('modalConfirmBtn');

    // --- Cache des éléments DOM de la navigation et de l'authentification ---
    const authInfoDiv = document.getElementById('auth-info');
    const userEmailSpan = document.getElementById('user-email');
    const currentTournamentNameSpan = document.getElementById('current-tournament-name');
    const selectTournamentBtn = document.getElementById('select-tournament-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const navLinks = {
        home: document.getElementById('nav-home'), // Added home for consistency, ensure ID exists in HTML
        equipes: document.getElementById('nav-equipes'),
        brassages: document.getElementById('nav-brassages'),
        eliminatoires: document.getElementById('nav-eliminatoires'),
        classements: document.getElementById('nav-classements'),
    };

    // --- Fonctions Utilitaires ---

    /**
     * Échappe les caractères HTML spéciaux.
     * @param {string} text Le texte à échapper.
     * @returns {string} Le texte échappé.
     */
    function escapeHtml(text) {
        const s = String(text);
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '`': '&#96;',
            '$': '&#36;'
        };
        return s.replace(/[&<>"'`$]/g, function(m) { return map[m]; });
    }

	/**
     * Génère les options HTML pour un menu déroulant de score.
     * @param {number} maxScore Le score maximum à inclure.
     * @param {number|null} selectedValue La valeur actuellement sélectionnée.
     * @returns {string} Le code HTML pour les options.
     */
    function generateScoreOptions(maxScore, selectedValue) {
        let options = '<option value="">-</option>'; // Option vide par défaut
        for (let i = 0; i <= maxScore; i++) {
            options += `<option value="${i}" ${selectedValue === i ? 'selected' : ''}>${i}</option>`;
        }
        return options;
    }

    /**
     * Affiche un message temporaire (toast) à l'utilisateur.
     * @param {string} message - Le message à afficher.
     * @param {string} type - Le type de message ('success', 'error', 'info').
     * @param {number} duration - Durée d'affichage en ms (par défaut 3000ms).
     */
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
        }, duration);
    }

    /**
     * Affiche une modale générique.
     * @param {string} title Le titre de la modale.
     * @param {HTMLElement} bodyContent Le contenu HTML à afficher dans le corps de la modale.
     * @param {Function} confirmCallback La fonction à appeler si l'utilisateur confirme.
     * @param {boolean} isDelete Indique si la modale est pour une suppression (bouton rouge).
     * @param {boolean} showCancelBtn Indique si le bouton annuler doit être affiché (par défaut true).
     */
    function showModal(title, bodyContent, confirmCallback, isDelete = false, showCancelBtn = true) {
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    modalBody.appendChild(bodyContent);
    actionModal.classList.remove('hidden');

    // Réaffecter modalConfirmBtn pour s'assurer que les anciens écouteurs sont retirés
    const oldConfirmBtn = modalConfirmBtn;
    const newConfirmBtn = oldConfirmBtn.cloneNode(true);
    oldConfirmBtn.parentNode.replaceChild(newConfirmBtn, oldConfirmBtn);
    modalConfirmBtn = newConfirmBtn; // Met à jour la référence
    modalConfirmBtn.textContent = 'Confirmer'; // Réinitialise le texte du bouton

    if (isDelete) {
            modalConfirmBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'focus:ring-blue-500');
            modalConfirmBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'focus:ring-red-500');
        } else {
            modalConfirmBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'focus:ring-red-500');
            modalConfirmBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'focus:ring-blue-500');
        }

        modalConfirmBtn.onclick = () => {
            confirmCallback(); // Exécuter la logique de confirmation spécifique
            hideModal(); // Puis masquer la modale
        };

        if (showCancelBtn) {
            modalCancelBtn.classList.remove('hidden');
            modalCancelBtn.onclick = () => {
                hideModal();
            };
        } else {
            modalCancelBtn.classList.add('hidden');
            modalCancelBtn.onclick = null; // Clear event listener
        }
    }

    /**
     * Cache la modale générique.
     */
    function hideModal() {
        actionModal.classList.add('hidden');
        modalBody.innerHTML = '';
        modalConfirmBtn.onclick = null; // Supprimer l'écouteur pour éviter les effets secondaires
        modalCancelBtn.onclick = null; // Supprimer l'écouteur pour éviter les effets secondaires
    }

    /**
     * Mélange un tableau (algorithme de Fisher-Yates).
     * @param {Array} array Le tableau à mélanger.
     * @returns {Array} Le tableau mélangé.
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // NEW: Fonction globale pour mettre à jour l'UI des radios de génération de poules
    // Déplacée ici pour être accessible globalement.
    function updatePoolGenerationBasisUI() {
        const initialLevelsRadio = document.getElementById('basisInitialLevels');
        const previousResultsRadio = document.getElementById('basisPreviousResults');
        const numberOfGlobalPhasesInput = document.getElementById('numberOfGlobalPhases');
        const basisHelpText = document.getElementById('basisHelpText');

        if (!initialLevelsRadio || !previousResultsRadio || !numberOfGlobalPhasesInput || !basisHelpText) {
            // Ces éléments n'existent pas sur toutes les pages, c'est normal.
            // Ne pas lancer d'erreur si on n'est pas sur la page "Brassages".
            return;
        }

        // Lire directement à partir de la variable globale AppState.teamTournament.poolGenerationBasis
        // La variable AppState.teamTournament.poolGenerationBasis est mise à jour par les event listeners sur les radios
        // et chargée depuis Firestore/localStorage.
        const selectedBasis = AppState.teamTournament.poolGenerationBasis;

        if (selectedBasis === 'initialLevels') {
            initialLevelsRadio.checked = true;
            previousResultsRadio.checked = false;
            numberOfGlobalPhasesInput.readOnly = false; // Permettre plusieurs phases pour les niveaux initiaux
            basisHelpText.textContent = "Crée des phases en utilisant les niveaux initiaux des équipes. Vous pouvez créer plusieurs phases de brassage initiales si nécessaire.";
        } else { // selectedBasis === 'previousResults'
            initialLevelsRadio.checked = false;
            previousResultsRadio.checked = true;
            numberOfGlobalPhasesInput.value = 1; // Forcer à 1 pour les résultats précédents
            numberOfGlobalPhasesInput.readOnly = true; // Une seule phase à la fois pour les résultats précédents
            basisHelpText.textContent = "Crée une phase en utilisant les résultats cumulés des brassages précédents. Une seule phase peut être créée à la fois avec cette méthode.";
        }
        // Assurez-vous que l'historique des phases et la visibilité des boutons sont mis à jour
        // renderPhaseHistory(); // Non appelé ici pour éviter des boucles ou des erreurs si pas sur la bonne page
    }


    // --- Fonctions de Persistance (Firestore et LocalStorage) ---


	function cleanupFirestoreListeners() {
		if (AppState.listeners.currentUserPrivateData) {
			 AppState.listeners.currentUserPrivateData();
			 AppState.listeners.currentUserPrivateData = null;
			 console.log("Listener de données privées détaché.");
		 }
		 if (AppState.listeners.currentTournament) {
			 AppState.listeners.currentTournament();
			 AppState.listeners.currentTournament = null;
			 console.log("Listener de tournoi détaché.");
		 }
	}
	 // Cette ligne est cruciale pour que index.html puisse trouver la fonction
	 window.cleanupFirestoreListeners = cleanupFirestoreListeners;

    /**
     * Référence au document Firestore pour les données privées de l'utilisateur (ex: tournoi actif).
     * @returns {import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js").DocumentReference|null} La référence du document ou null si Firebase n'est pas prêt.
     */
    function getUserPrivateDataRef() {
        if (window.db && window.userId) {
            // CORRECTION : Le chemin pointe maintenant vers la collection "users_private",
            // conformément à vos règles de sécurité Firestore.
            return window.doc(window.db, 'users_private', window.userId);
        }
        return null;
    }

    /**
     * Référence au document Firestore pour un tournoi spécifique.
     * @param {string} tournamentId L'ID du tournoi.
     * @returns {import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js").DocumentReference|null} La référence du document ou null si Firebase n'est pas prêt.
     */
    function getTournamentDataRef(tournamentId) {
        if (window.db && tournamentId) {
            return window.doc(window.db, 'tournaments', tournamentId);
        }
        // console.error("Firebase ou Tournament ID non initialisé pour les données du tournoi."); // Trop verbeux
        return null;
    }

	/**
	 * Sauvegarde les données du tournoi.
	 * Utilise updateDoc() pour les utilisateurs connectés pour ne pas écraser le document.
	 */
	async function saveAllData() {
		if (AppState.isGuestMode) {
			saveDataToLocalStorage();
			// On ne met pas de toast ici car la fonction est appelée très souvent.
			// C'est la fonction appelante (ex: addTeam) qui doit afficher le toast.
			return;
		}

		// On utilise la nouvelle variable `AppState.auth.activeTeamTournamentId`
		if (!window.userId || !AppState.auth.activeTeamTournamentId) {
			console.warn("Sauvegarde en ligne ignorée : aucun utilisateur connecté ou tournoi par équipe actif.");
			return;
		}

		const tournamentDocRef = getTournamentDataRef(AppState.auth.activeTeamTournamentId);
		if (!tournamentDocRef) return;

		try {
			// On ne met à jour que les champs qui peuvent changer après la création.
			const dataToUpdate = {
				allTeams: AppState.teamTournament.allTeams,
				allBrassagePhases: AppState.teamTournament.allBrassagePhases,
				eliminationPhases: AppState.teamTournament.eliminationPhases,
				currentSecondaryGroupsPreview: AppState.teamTournament.currentSecondaryGroupsPreview,
				eliminatedTeams: Array.from(AppState.teamTournament.eliminatedTeams),
				currentDisplayedPhaseId: AppState.teamTournament.currentDisplayedPhaseId,
				poolGenerationBasis: AppState.teamTournament.poolGenerationBasis
			};

			await window.updateDoc(tournamentDocRef, dataToUpdate);

			console.log("Données du tournoi mises à jour sur Firestore.");

		} catch (e) {
			console.error("Erreur lors de la mise à jour des données sur Firestore:", e);
			showToast("Erreur lors de la sauvegarde des données.", "error");
		}
	}


    /**
     * Charge toutes les données du tournoi actif depuis Firestore.
     * Met également en place un listener en temps réel.
     */
	async function loadAllData() {
		if (typeof window.cleanupFirestoreListeners === 'function') {
			window.cleanupFirestoreListeners();
		}

		// Si l'utilisateur n'est PAS connecté (mode invité)
		if (!window.userId) {
			AppState.isGuestMode = true;
			loadDataFromLocalStorage(); // On charge les données locales
			handleLocationHash();       // On affiche la bonne page
			return; // On arrête la fonction ici pour ne pas contacter Firebase.
		}

		// Si l'utilisateur EST connecté
		AppState.isGuestMode = false;
		const userPrivateDataRef = getUserPrivateDataRef();
		if (!userPrivateDataRef) {
            // Si on ne peut pas obtenir la référence, on ne fait rien pour éviter une erreur.
            return;
        };

		// On écoute le profil de l'utilisateur pour connaître les tournois actifs
		AppState.listeners.currentUserPrivateData = window.onSnapshot(userPrivateDataRef, async (docSnap) => {
			const userData = docSnap.data() || {};
			AppState.auth.activeTeamTournamentId = userData.activeTeamTournamentId || null;
			AppState.auth.activeMeleeTournamentId = userData.activeMeleeTournamentId || null;

			const currentHash = window.location.hash;
			const tournamentIdToLoad = currentHash.startsWith('#melee') ? AppState.auth.activeMeleeTournamentId : AppState.auth.activeTeamTournamentId;

			await fetchAndListenToTournamentData(tournamentIdToLoad);
		}, (error) => {
            // Ajout d'un gestionnaire d'erreur pour le snapshot
            console.error("Erreur d'écoute sur les données privées de l'utilisateur:", error);
            showToast("Impossible de charger les données de l'utilisateur.", "error");
        });

		await fetchUserTournamentsList();
	}

    /**
     * Sauvegarde les données du tournoi dans le localStorage pour le mode invité.
     */
    function saveDataToLocalStorage() {
        const dataToSave = {
            allTeams: AppState.teamTournament.allTeams,
            allBrassagePhases: AppState.teamTournament.allBrassagePhases,
            eliminationPhases: AppState.teamTournament.eliminationPhases,
            currentSecondaryGroupsPreview: AppState.teamTournament.currentSecondaryGroupsPreview,
            eliminatedTeams: Array.from(AppState.teamTournament.eliminatedTeams),
            currentDisplayedPhaseId: AppState.teamTournament.currentDisplayedPhaseId,
            poolGenerationBasis: AppState.teamTournament.poolGenerationBasis // Save basis for guest mode too
        };
        localStorage.setItem('guestTournamentData', JSON.stringify(dataToSave));
        localStorage.setItem(POOL_GENERATION_BASIS_KEY, AppState.teamTournament.poolGenerationBasis); // Also save basis separately for robustness

        // For guest mode, simulate currentTournamentData and currentTournamentId
        // This is a "dummy" tournament data for UI display in guest mode
        AppState.auth.activeTeamTournamentId = 'guest_mode_tournament';
        AppState.teamTournament.currentData = {
            name: "Tournoi Invité",
            date: new Date().toISOString().split('T')[0],
            numTeamsAllowed: GUEST_MODE_MAX_TEAMS,
            ownerId: 'guest',
            collaboratorIds: [],
            collaboratorEmails: []
        };
        updateTournamentDisplay();
        updateNavLinksVisibility();
        rebuildMatchOccurrenceMap(); // Rebuild map after saving data
    }

    /**
     * Charge les données du tournoi depuis le localStorage pour le mode invité.
     */
	function loadDataFromLocalStorage() {
		const storedData = localStorage.getItem('guestTournamentData');
		if (storedData) {
			try {
				const data = JSON.parse(storedData);
				AppState.teamTournament.allTeams = data.allTeams || [];
				AppState.teamTournament.allBrassagePhases = data.allBrassagePhases || [];
				AppState.teamTournament.eliminationPhases = data.eliminationPhases || {};
				AppState.teamTournament.currentSecondaryGroupsPreview = data.currentSecondaryGroupsPreview || {};
				AppState.teamTournament.eliminatedTeams = new Set(data.eliminatedTeams || []);
				AppState.teamTournament.currentDisplayedPhaseId = data.currentDisplayedPhaseId || null;
				AppState.teamTournament.poolGenerationBasis = data.poolGenerationBasis || 'initialLevels';
			} catch (e) {
				console.error("Erreur lors du chargement des données depuis localStorage:", e);
				clearGuestData(); // Réinitialise en cas d'erreur
			}
		} else {
			clearGuestData(); // Initialise si aucune donnée n'est trouvée
		}

		// On simule un ID de tournoi actif pour que l'interface s'affiche correctement en mode invité.
		AppState.auth.activeTeamTournamentId = 'guest_mode_tournament';
		AppState.teamTournament.currentData = {
			name: "Tournoi Invité",
			date: new Date().toISOString().split('T')[0],
			numTeamsAllowed: GUEST_MODE_MAX_TEAMS,
			ownerId: 'guest',
		};

		rebuildMatchOccurrenceMap();
		updateTournamentDisplay();
		updateNavLinksVisibility();
	}

    /**
     * Efface toutes les données locales pour le mode invité.
     */
    function clearGuestData() {
        AppState.teamTournament.allTeams = [];
        AppState.teamTournament.allBrassagePhases = [];
        AppState.teamTournament.eliminationPhases = {};
        AppState.teamTournament.currentSecondaryGroupsPreview = {};
        AppState.teamTournament.eliminatedTeams = new Set();
        AppState.teamTournament.currentDisplayedPhaseId = null;
        AppState.teamTournament.poolGenerationBasis = 'initialLevels';
        localStorage.removeItem('guestTournamentData');
        localStorage.removeItem(POOL_GENERATION_BASIS_KEY); // Also remove basis
        rebuildMatchOccurrenceMap();
        updateTournamentDisplay();
        updateNavLinksVisibility();
    }

	/**
     * Récupère et met en place un listener en temps réel pour les données d'un tournoi spécifique.
     * @param {string} tournamentId L'ID du tournoi à charger.
     */
	async function fetchAndListenToTournamentData(tournamentId) {
        // NOUVELLE GARDE DE SÉCURITÉ : On vérifie l'état de connexion AU DÉBUT de la fonction.
        if (!window.userId || AppState.isGuestMode) {
            console.warn("Appel à fetchAndListenToTournamentData ignoré car l'utilisateur est en mode invité.");
            // On ne fait rien si on est en mode invité, car les données sont déjà gérées localement.
            return;
        }

		if (AppState.listeners.currentTournament) AppState.listeners.currentTournament();

		if (!tournamentId) {
			AppState.teamTournament.currentData = null;
			updateTournamentDisplay();
			updateNavLinksVisibility();
			handleLocationHash();
			return;
		}

		const tournamentDocRef = getTournamentDataRef(tournamentId);

		AppState.listeners.currentTournament = window.onSnapshot(tournamentDocRef, (docSnap) => {
			if (docSnap.exists()) {
				AppState.teamTournament.currentData = { id: docSnap.id, ...docSnap.data() };

				// --- DÉBUT DE LA CORRECTION ---

				if (AppState.teamTournament.currentData.type === 'equipe') {
					// Logique existante pour les tournois par équipe
					AppState.teamTournament.allTeams = AppState.teamTournament.currentData.allTeams || [];
					AppState.teamTournament.allBrassagePhases = AppState.teamTournament.currentData.allBrassagePhases || [];
					AppState.teamTournament.eliminationPhases = AppState.teamTournament.currentData.eliminationPhases || {};
					AppState.teamTournament.poolGenerationBasis = AppState.teamTournament.currentData.poolGenerationBasis || 'initialLevels';
					
					// On s'assure que les données de la mêlée sont vides pour éviter les conflits
					if (typeof window.onMeleeDataUpdate === 'function') {
						window.onMeleeDataUpdate(null);
					}

				} else if (AppState.teamTournament.currentData.type === 'melee') {
					// NOUVELLE LOGIQUE : On passe les données au module Mêlée
					if (typeof window.onMeleeDataUpdate === 'function') {
						// On envoie l'objet `meleeData` à la fonction de mise à jour du module Mêlée
						window.onMeleeDataUpdate(AppState.teamTournament.currentData.meleeData || {});
					}
					// On s'assure que les données du tournoi par équipe sont vides
					AppState.teamTournament.allTeams = [];
					AppState.teamTournament.allBrassagePhases = [];
					AppState.teamTournament.eliminationPhases = {};
				}
				
				// --- FIN DE LA CORRECTION ---

				rebuildMatchOccurrenceMap();
				updateTournamentDisplay();
				updateNavLinksVisibility();

				// On force le rafraichissement de la page mêlée si on est dessus pour que les données s'affichent
				if (window.location.hash.startsWith('#melee') && typeof window.rerenderMeleePage === 'function') {
					window.rerenderMeleePage();
				}

				handleLocationHash();
			} else {
				showToast("Le tournoi actif n'est plus accessible.", "error");
			}
		});
	}

    /**
     * Récupère la liste de tous les tournois de l'utilisateur (propriétaire ou collaborateur).
     */
	async function fetchUserTournamentsList() {
		if (!window.userId || !window.db || AppState.isGuestMode) {
			AppState.auth.allUserTournaments = [];
			return;
		}
		try {
			const tournamentsCollectionRef = window.collection(window.db, 'tournaments');
			const q = window.query(tournamentsCollectionRef, window.where('ownerId', '==', window.userId));
			const querySnapshot = await window.getDocs(q);
			AppState.auth.allUserTournaments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		} catch (error) {
			console.error("Erreur lors de la récupération de la liste des tournois:", error);
			showToast("Erreur lors du chargement de la liste de vos tournois.", "error");
			AppState.auth.allUserTournaments = [];
		}
	}

	/**
	 * Sélectionne un tournoi comme actif pour un type donné.
	 * @param {string} tournamentId L'ID du tournoi à activer.
	 * @param {string} type Le type de tournoi ('equipe' ou 'melee').
	 */
	async function selectTournament(tournamentId, type) {
		if (!window.userId) {
			showToast("Vous devez être connecté pour sélectionner un tournoi.", "error");
			return;
		}

		const userPrivateDataRef = getUserPrivateDataRef();
		if (!userPrivateDataRef) return;

		try {
			let fieldToUpdate = {};
			if (type === 'equipe') {
				fieldToUpdate = { activeTeamTournamentId: tournamentId };
			} else if (type === 'melee') {
				fieldToUpdate = { activeMeleeTournamentId: tournamentId };
			}

			// 1. On sauvegarde le choix dans Firebase.
			await window.setDoc(userPrivateDataRef, fieldToUpdate, { merge: true });

			showToast("Chargement du tournoi...", "info");

			// 2. ÉTAPE CRUCIALE : On force le chargement des données du nouveau tournoi
			// et on ATTEND que ce soit terminé.
			await fetchAndListenToTournamentData(tournamentId);

			// 3. On met à jour l'état local APRES que les données sont chargées.
			if (type === 'equipe') {
				AppState.auth.activeTeamTournamentId = tournamentId;
			} else if (type === 'melee') {
				AppState.auth.activeMeleeTournamentId = tournamentId;
			}

			showToast("Tournoi sélectionné avec succès !", "success");

			// 4. On redirige maintenant que l'application est garantie d'être à jour.
			if (type === 'equipe') {
				window.location.hash = '#home';
			} else if (type === 'melee') {
				window.location.hash = '#melee/accueil';
			}

		} catch (error) {
			console.error("Erreur lors de la sélection du tournoi:", error);
			showToast("Erreur lors de la sélection du tournoi.", "error");
		}
	}

	/**
	 * Crée un nouveau tournoi en base de données avec un type spécifique.
	 * @param {string} name Nom du tournoi.
	 * @param {string} date Date du tournoi.
	 * @param {string} type Type de tournoi ('equipe' ou 'melee').
	 * @param {number|null} numTeams Le nombre d'équipes (pour le type 'equipe').
	 */
	async function createNewTournament(name, date, type, numTeams = null) {
		if (!window.userId) {
			showToast("Vous devez être connecté pour créer un tournoi.", "error");
			return;
		}

		// --- VALIDATION AMÉLIORÉE ---
		if (!name.trim() || !date || !type) {
			showToast("Veuillez remplir le Nom, la Date et le Type.", "error");
			return;
		}
		if (type === 'equipe' && (isNaN(numTeams) || numTeams < 2)) {
			showToast("Pour un tournoi par équipes, le nombre d'équipes doit être d'au moins 2.", "error");
			return;
		}

		try {
			const newTournamentDocRef = window.doc(window.collection(window.db, 'tournaments'));

			const newTournamentData = {
				name: name.trim(),
				date: date,
				type: type,
				ownerId: window.userId,

				// --- CORRECTION DÉFINITIVE CI-DESSOUS ---
				// On utilise une méthode de secours. Si window.serverTimestamp n'est pas prêt,
				// on utilise la date du client. Cela empêche l'erreur "Bad Request".
				createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),

				// Ajout conditionnel des champs
				...(type === 'equipe' && {
					numTeamsAllowed: numTeams,
					allTeams: [],
					allBrassagePhases: [],
					eliminationPhases: {},
					poolGenerationBasis: 'initialLevels',
				}),

				...(type === 'melee' && {
					meleeData: { players: [], rounds: [] }
				})
			};

			await window.setDoc(newTournamentDocRef, newTournamentData);
			showToast("Tournoi créé avec succès !", "success");

			await fetchUserTournamentsList();
			renderTournamentsList();

		} catch (error) {
			console.error("Erreur lors de la création du tournoi:", error);
			showToast("Erreur lors de la création du tournoi.", "error");
		}
	}

    /**
     * Supprime un tournoi. Seul le propriétaire peut le faire.
     * @param {string} tournamentId L'ID du tournoi à supprimer.
     */
	async function deleteTournament(tournamentId) {
		if (!window.userId) {
			showToast("Vous devez être connecté pour supprimer un tournoi.", "error");
			return;
		}

		const tournamentRef = getTournamentDataRef(tournamentId);
		if (!tournamentRef) return;

		try {
			const docSnap = await window.getDoc(tournamentRef);
			if (!docSnap.exists()) {
				showToast("Le tournoi n'existe pas.", "error");
				return;
			}

			const data = docSnap.data();
			if (data.ownerId !== window.userId) {
				showToast("Vous n'êtes pas le propriétaire de ce tournoi.", "error");
				return;
			}

			const messageContent = document.createElement('p');
			messageContent.textContent = `Êtes-vous sûr de vouloir supprimer le tournoi "${data.name}" ? Cette action est irréversible.`;
			messageContent.className = 'text-gray-700';

			showModal('Confirmer la suppression', messageContent, async () => {
				await window.deleteDoc(tournamentRef);
				showToast(`Tournoi "${data.name}" supprimé.`, "success");

				AppState.auth.allUserTournaments = AppState.auth.allUserTournaments.filter(t => t.id !== tournamentId);
				renderTournamentsList();

				// On vérifie si le tournoi supprimé était actif pour l'un des deux modes.
				if (AppState.auth.activeTeamTournamentId === tournamentId || AppState.auth.activeMeleeTournamentId === tournamentId) {
					const userPrivateDataRef = getUserPrivateDataRef();
					if (userPrivateDataRef) {
						let fieldToUpdate = {};
						// On met à jour le bon champ en fonction du type de tournoi supprimé
						if (data.type === 'equipe') {
							fieldToUpdate = { activeTeamTournamentId: null };
						} else if (data.type === 'melee') {
							fieldToUpdate = { activeMeleeTournamentId: null };
						}
						await window.setDoc(userPrivateDataRef, fieldToUpdate, { merge: true });
					}
					// Pas besoin de recharger, la mise à jour de l'état via onSnapshot s'en chargera.
				}
			}, true);
		} catch (error) {
			console.error("Erreur lors de la suppression du tournoi:", error);
			showToast("Erreur lors de la suppression du tournoi.", "error");
		}
	}



	/**
     * Met à jour l'affichage du nom, de la date et du nombre d'équipes du tournoi
     * actif dans la barre de navigation.
     */
	function updateTournamentDisplay() {
		const nameSpan = document.getElementById('current-tournament-name');
		if (!nameSpan) return;

		const currentActiveId = window.location.hash.startsWith('#melee') ? AppState.auth.activeMeleeTournamentId : AppState.auth.activeTeamTournamentId;

		// On affiche les infos seulement si les données chargées correspondent au tournoi actif du mode actuel
		if (AppState.teamTournament.currentData && AppState.teamTournament.currentData.id === currentActiveId) {
			let nameDisplay = "Tournoi: " + AppState.teamTournament.currentData.name;

			// On ajoute une étiquette pour le type Mêlée
			if (AppState.teamTournament.currentData.type === 'melee') {
				nameDisplay;
			} else if (AppState.isGuestMode) {
				nameDisplay += ' (Invité)';
			}

			let dateDisplay = 'Date non définie';
			if (AppState.teamTournament.currentData.date) {
				const dateParts = AppState.teamTournament.currentData.date.split('-');
				if (dateParts.length === 3) {
					dateDisplay = `Date: ${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
				} else {
					dateDisplay = `Date: ${AppState.teamTournament.currentData.date}`;
				}
			}

			// On n'affiche le compte des équipes que pour les tournois par équipe
			const teamsDisplayHTML = AppState.teamTournament.currentData.type === 'equipe'
				? `<p class="text-xs">Équipes: ${AppState.teamTournament.allTeams.length} / ${AppState.teamTournament.currentData.numTeamsAllowed || 0}</p>`
				: '';

			nameSpan.innerHTML = `
				<p class="font-bold">${nameDisplay}</p>
				<p class="text-xs mt-1">${dateDisplay}</p>
				${teamsDisplayHTML}
			`;

			nameSpan.classList.remove('hidden');
		} else {
			nameSpan.textContent = 'Aucun tournoi sélectionné';
			nameSpan.classList.add('italic');
		}
	}



    /**
     * Met à jour la visibilité des liens de navigation en fonction de l'état d'authentification
     * et de la sélection d'un tournoi.
     */
	window.updateNavLinksVisibility = updateNavLinksVisibility;
	function updateNavLinksVisibility() {
		const authCtaContainer = document.getElementById('auth-cta-container');
		const authInfoDiv = document.getElementById('auth-info');
		const userEmailSpan = document.getElementById('user-email');
		const selectTournamentBtn = document.getElementById('select-tournament-btn');
		const logoutBtn = document.getElementById('logout-btn');

		const isLoggedIn = !!window.userId;
		const tournamentSelected = !!AppState.auth.activeTeamTournamentId;

		if (authInfoDiv) authInfoDiv.classList.toggle('hidden', !isLoggedIn);
		if (authCtaContainer) authCtaContainer.classList.toggle('hidden', isLoggedIn);

		if (userEmailSpan && isLoggedIn && window.auth.currentUser) {
			userEmailSpan.textContent = window.auth.currentUser.email;
		}

		document.getElementById('nav-equipes')?.classList.toggle('hidden', !tournamentSelected);
		document.getElementById('nav-brassages')?.classList.toggle('hidden', !tournamentSelected);
		document.getElementById('nav-eliminatoires')?.classList.toggle('hidden', !tournamentSelected);
		document.getElementById('nav-classements')?.classList.toggle('hidden', !tournamentSelected);

		if(selectTournamentBtn) selectTournamentBtn.classList.toggle('hidden', !isLoggedIn);
		if(logoutBtn) logoutBtn.classList.toggle('hidden', !isLoggedIn);

		document.querySelectorAll('.nav-link').forEach(link => {
			const linkPath = link.getAttribute('href').substring(1) || 'home';
			const currentHashPath = window.location.hash.substring(1) || 'home';
			link.classList.toggle('active-link', linkPath.startsWith(currentHashPath));
		});
	}

    /**
     * Reconstruit la map `matchOccurrenceMap` à partir de `allBrassagePhases`.
     * Ceci est nécessaire après le chargement des données depuis Firestore ou LocalStorage.
     */
    function rebuildMatchOccurrenceMap() {
        AppState.teamTournament.matchOccurrenceMap.clear(); // Vider la map existante
        // Seules les phases de brassage (initiales et secondaires) sont pertinentes pour les occurrences de matchs
        AppState.teamTournament.allBrassagePhases.filter(p => p.type === PHASE_TYPE_INITIAL || p.type === PHASE_TYPE_SECONDARY_BRASSAGE).forEach(phase => {
            if (phase.generated && phase.pools) {
                phase.pools.forEach(pool => {
                    pool.matches.forEach(match => {
                        if (match.team1Id && match.team2Id) { // S'assurer que les équipes sont définies
                            const matchKey = JSON.stringify([match.team1Id, match.team2Id].sort());
                            if (!AppState.teamTournament.matchOccurrenceMap.has(matchKey)) {
                                AppState.teamTournament.matchOccurrenceMap.set(matchKey, new Set());
                            }
                            AppState.teamTournament.matchOccurrenceMap.get(matchKey).add(phase.id);
                        }
                    });
                });
            }
        });
        console.log("Map des occurrences de matchs reconstruite.");
    }

    /**
     * Calcule et affiche le nombre de matchs répétés.
     */
    function updateRepeatedMatchesCountDisplay() {
        const countElement = document.getElementById('repeatedMatchesCount');
        if (countElement) {
            let repeatedCount = 0;
            // Itérer sur la map pour compter les rencontres répétées uniques
            for (const [matchKey, phaseIdsSet] of AppState.teamTournament.matchOccurrenceMap.entries()) {
                if (phaseIdsSet.size > 1) { // Un match est répété s'il a eu lieu dans plus d'une phase
                    repeatedCount++;
                }
            }

            countElement.textContent = `(${repeatedCount} rencontre${repeatedCount > 1 ? 's' : ''} répétée${repeatedCount > 1 ? 's' : ''})`;
            if (repeatedCount === 0) {
                countElement.classList.add('hidden');
            } else {
                countElement.classList.remove('hidden');
            }
        }
    }

    /**
     * Vérifie si un match donné s'est déjà produit dans une autre phase.
     * @param {string} team1Id ID de la première équipe.
     * @param {string} team2Id ID de la deuxième équipe.
     * @param {string} currentPhaseId ID de la phase actuelle à exclure de la vérification.
     * @param {Map} evaluationMatchMap La map d'occurrences de matchs à utiliser pour cette vérification (peut être temporaire).
     * @returns {boolean} Vrai si le match est une répétition, faux sinon.
     */
    function isMatchRepeated(team1Id, team2Id, currentPhaseId, evaluationMatchMap = AppState.teamTournament.matchOccurrenceMap) {
        if (!team1Id || !team2Id) return false;
        const matchKey = JSON.stringify([team1Id, team2Id].sort());
        const occurrences = evaluationMatchMap.get(matchKey);
        if (!occurrences) return false;

        // Vérifier si cette paire d'équipes a joué dans au moins une *autre* phase (sans inclure currentPhaseId si c'est la phase évaluée).
        return Array.from(occurrences).some(phaseId => phaseId !== currentPhaseId);
    }
	
	/**
     * Affiche une modale avec les détails d'un match répété.
     * @param {string} team1Name Nom de la première équipe.
     * @param {string} team2Name Nom de la deuxième équipe.
     * @param {string} team1Id ID de la première équipe.
     * @param {string} team2Id ID de la deuxième équipe.
     * @param {string} currentPhaseId ID de la phase actuelle (à exclure de la liste).
     */
    function showRepeatedMatchDetailsModal(team1Name, team2Name, team1Id, team2Id, currentPhaseId) {
        const matchKey = JSON.stringify([team1Id, team2Id].sort());
        const occurrences = AppState.teamTournament.matchOccurrenceMap.get(matchKey);

        if (!occurrences) {
            console.warn("DEBUG: Aucune occurrence trouvée pour ce match répété, ce qui est inattendu.");
            return;
        }

        const previousPhases = Array.from(occurrences)
            .filter(phaseId => phaseId !== currentPhaseId) // Exclure la phase actuelle
            .map(phaseId => AppState.teamTournament.allBrassagePhases.find(p => p.id === phaseId))
            .filter(phase => phase !== undefined); // S'assurer que la phase existe

        const modalContent = document.createElement('div');
        modalContent.className = 'text-gray-700';

        if (previousPhases.length > 0) {
            modalContent.innerHTML = `
                <p class="mb-3">La rencontre <span class="font-bold">${escapeHtml(team1Name)} vs ${escapeHtml(team2Name)}</span> s'est déjà produite dans les phases suivantes :</p>
                <ul class="list-disc list-inside space-y-1">
                    ${previousPhases.map(phase => `<li>${escapeHtml(phase.name)}</li>`).join('')}
                </ul>
                <p class="mt-4 text-sm text-gray-500">Nous avons fait de notre mieux pour minimiser les répétitions, mais elles peuvent survenir si le nombre d'équipes est limité ou si les structures des poules l'exigent.</p>
            `;
        } else {
            modalContent.innerHTML = `
                <p>La rencontre <span class="font-bold">${escapeHtml(team1Name)} vs ${escapeHtml(team2Name)}</span> n'apparaît pas comme répétée dans les phases précédentes enregistrées. Il pourrait y avoir une erreur ou il s'agit d'une rencontre au sein de la même phase.</p>
            `;
        }

        showModal(`Rencontre Répétée : ${escapeHtml(team1Name)} vs ${escapeHtml(team2Name)}`, modalContent, () => hideModal());
    }

    /**
     * Vérifie si une équipe avec un nom donné existe déjà dans la liste des équipes.
     * La comparaison est insensible à la casse.
     * @param {string} teamName Le nom de l'équipe à vérifier.
     * @returns {boolean} Vrai si l'équipe existe déjà, faux sinon.
     */
    function teamExists(teamName) {
        const lowerCaseNewTeamName = teamName.toLowerCase();
        return AppState.teamTournament.allTeams.some(team => team.name.toLowerCase() === lowerCaseNewTeamName);
    }
    // --- Fonctions de Gestion des Équipes ---

    /**
     * Affiche une modale demandant à l'utilisateur de se connecter ou de s'inscrire.
     */
    function showLoginRequiredModal() {
    const messageContent = document.createElement('div');
    messageContent.innerHTML = `
        <p class="text-gray-700 mb-4">Pour dépasser ${GUEST_MODE_MAX_TEAMS} équipes et sauvegarder vos progrès, veuillez vous connecter ou créer un compte.</p>
        <p class="text-gray-700">Vous pouvez rester sur cette page en mode invité avec les équipes actuelles.</p>
    `;

    // 1. On appelle la modale en s'assurant que le deuxième bouton est visible
    showModal(
        'Connexion Requise',
        messageContent,
        () => { // Action du bouton principal
            window.location.hash = '#auth';
            clearGuestData();
        },
        false,
        true // <-- Ce 'true' force l'affichage du deuxième bouton
    );

    // 2. On change le texte du bouton de confirmation principal
    modalConfirmBtn.textContent = "Se connecter / S'inscrire";

    // 3. On sélectionne, renomme et restyle le deuxième bouton
    const guestButton = document.getElementById('modalCancelBtn');
    guestButton.textContent = "Continuer en mode invité";
    guestButton.className = "px-4 py-2 rounded text-white bg-gray-500 hover:bg-gray-600";

    // L'action par défaut de ce bouton est de fermer la modale, ce qui est parfait.
}

    /**
     * Ajoute une nouvelle équipe.
     * @param {string} name - Le nom de l'équipe.
     * @param {number} level - Le niveau de l'équipe (1-10).
     */
	function addTeam(name, level) {
        // Vérifie la limite d'équipes pour les tournois connectés et pour le mode invité
        const limit = AppState.isGuestMode ? GUEST_MODE_MAX_TEAMS : (AppState.teamTournament.currentData ? AppState.teamTournament.currentData.numTeamsAllowed : 0);
        if (AppState.teamTournament.allTeams.length >= limit) {
            showToast(`Limite de ${limit} équipes atteinte pour ce tournoi.`, "error");
            if (AppState.isGuestMode) showLoginRequiredModal();
            return;
        }

        if (!name.trim()) {
            showToast("Le nom de l'équipe ne peut pas être vide.", "error");
            return;
        }
        if (teamExists(name)) {
            showToast(`L'équipe "${escapeHtml(name)}" existe déjà.`, "error");
            return;
        }
        if (isNaN(level) || level < 1 || level > 10) {
            showToast("Le niveau doit être un nombre entre 1 et 10.", "error");
            return;
        }

        const newTeam = {
            id: 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            name: name.trim(),
            level: parseInt(level)
        };
        AppState.teamTournament.allTeams.push(newTeam);
        saveAllData();
        showToast(`Équipe "${escapeHtml(name)}" ajoutée.`, "success");
    }

    /**
     * Met à jour le nom et le niveau d'une équipe.
     * @param {string} id - L'ID de l'équipe à mettre à jour.
     * @param {string} newName - Le nouveau nom de l'équipe.
     * @param {number} newLevel - Le nouveau niveau de l'équipe.
     */
    function updateTeam(id, newName, newLevel) {
        if (!newName.trim()) {
            showToast("Le nom de l'équipe ne peut pas être vide.", "error");
            return;
        }
        if (teamExists(newName) && AppState.teamTournament.allTeams.find(t => t.id === id)?.name.toLowerCase() !== newName.toLowerCase()) {
            showToast(`Une équipe nommée "${escapeHtml(newName)}" existe déjà.`, "error");
            return;
        }
        if (isNaN(newLevel) || newLevel < 1 || newLevel > 10) {
            showToast("Le niveau doit être un nombre entre 1 et 10.", "error");
            return;
        }

        const teamToUpdate = AppState.teamTournament.allTeams.find(team => team.id === id);
        if (teamToUpdate) {
            teamToUpdate.name = newName.trim();
            teamToUpdate.level = newLevel;
            saveAllData(); // Will save to localStorage if in guest mode, Firestore if logged in
            // Le rendu est géré par setupEquipesPageLogic après l'appel à saveAllData via onSnapshot
            showToast(`Équipe "${escapeHtml(newName)}" mise à jour.`, "success");
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
        const isTeamInBrassage = AppState.teamTournament.allBrassagePhases.some(phase =>
            phase.pools && phase.pools.some(pool =>
                pool.teams.some(team => team.id === id) || pool.matches.some(match => match.team1Id === id || match.team2Id === id)
            )
        );

        const isTeamInElimination = Object.values(AppState.teamTournament.eliminationPhases).some(bracket =>
            bracket.bracket && bracket.bracket.some(round =>
                round.matches.some(match => (match.team1 && match.team1.id === id) || (match.team2 && match.team2.id === id))
            )
        );

        if (isTeamInBrassage || isTeamInElimination) {
            const messageContent = document.createElement('p');
            messageContent.innerHTML = `L'équipe est impliquée dans des phases de tournoi existantes (brassage ou élimination). Vous ne pouvez pas la supprimer.<br><br>Veuillez supprimer les phases concernées d'abord.`;
            messageContent.className = 'text-gray-700';
            showModal("Impossible de supprimer l'équipe", messageContent, () => hideModal());
            return;
        }

        const teamToDelete = AppState.teamTournament.allTeams.find(team => team.id === id);
        if (!teamToDelete) {
            showToast("Équipe non trouvée.", "error");
            return;
        }

        const messageContent = document.createElement('p');
        messageContent.textContent = `Êtes-vous sûr de vouloir supprimer l'équipe "${escapeHtml(teamToDelete.name)}" ? Cette action est irréversible.`;
        messageContent.className = 'text-gray-700';

        showModal('Confirmer la suppression', messageContent, () => {
            AppState.teamTournament.allTeams = AppState.teamTournament.allTeams.filter(team => team.id !== id);
            AppState.teamTournament.eliminatedTeams.delete(id); // S'assurer qu'elle est retirée des équipes éliminées si elle y était
            saveAllData(); // Will save to localStorage if in guest mode, Firestore if logged in
            // Le rendu est géré par setupEquipesPageLogic après l'appel à saveAllData via onSnapshot
            showToast(`Équipe "${escapeHtml(teamToDelete.name)}" supprimée.`, "success");
        }, true);
    }

    // --- Fonctions de Gestion des Phases de Brassage ---

    /**
     * Vérifie si une phase de brassage donnée est complète (tous les matchs ont des scores et un vainqueur).
     * @param {Object} phase The phase object to check.
     * @returns {boolean} True if the phase is complete, false otherwise.
     */
    function isBrassagePhaseComplete(phase) {
        if (!phase || !phase.generated || !phase.pools) return false;
        for (const pool of phase.pools) {
            if (!pool.matches) return false;
            for (const match of pool.matches) {
                // Check if score1 and score2 are valid numbers and winnerId is set
                if (match.score1 === null || match.score2 === null || isNaN(match.score1) || isNaN(match.score2) || match.winnerId === null) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Helper function to generate a single set of pools and evaluate its repetitions.
     * @param {string} phaseType The type of phase (initial_brassage or secondary_brassage).
     * @param {Array<Object>} teamsToUse The teams to use for generation.
     * @param {number} requestedTeamsPerPool The number of teams desired per pool.
     * @param {HTMLElement} msgElement Element to display messages (for internal generation failures).
     * @param {string|null} currentPhaseIdToExclude The ID of the phase currently being generated (to exclude from repetition check).
     * @returns {{pools: Array<Object>|null, repetitions: number, remainingTeamsCount: number}} Object with generated pools, repetition count, and remaining teams.
     */
   function generateAndEvaluatePools(phaseType, teamsToUse, requestedTeamsPerPool, msgElement, currentPhaseIdToExclude = null, useInitialLevelsLogic) {
    let generationResult = null;

    // --- CORRECTION : On choisit l'algorithme en fonction de la méthode sélectionnée ---
    if (useInitialLevelsLogic) {
        // Utilise l'algorithme basé sur les niveaux initiaux
        generationResult = _generatePoolsLogicInitialLevels(teamsToUse, requestedTeamsPerPool, msgElement);
    } else {
        // Utilise l'algorithme basé sur le classement par résultats
        generationResult = _generatePoolsLogicRankingBased(teamsToUse, requestedTeamsPerPool, msgElement);
    }

    if (!generationResult || !generationResult.pools) {
        return { pools: null, repetitions: Infinity, remainingTeamsCount: Infinity };
    }

    const generatedPools = generationResult.pools;

    // Le reste de la fonction pour évaluer les répétitions est correct...
    const phasesForEvaluation = [...AppState.teamTournament.allBrassagePhases.filter(p => p.id !== currentPhaseIdToExclude)];
    const tempPhaseForEvaluation = {
        id: currentPhaseIdToExclude || 'temp_phase_for_eval_' + Date.now(),
        type: phaseType,
        name: 'Temp Phase for Evaluation',
        pools: generatedPools,
        generated: true,
        timestamp: Date.now()
    };
    phasesForEvaluation.push(tempPhaseForEvaluation);

    const tempMatchOccurrenceMap = new Map();
    phasesForEvaluation.forEach(p => {
        if (p.generated && p.pools) {
            p.pools.forEach(pool => {
                pool.matches.forEach(match => {
                    if (match.team1Id && match.team2Id) {
                        const matchKey = JSON.stringify([match.team1Id, match.team2Id].sort());
                        if (!tempMatchOccurrenceMap.has(matchKey)) {
                            tempMatchOccurrenceMap.set(matchKey, new Set());
                        }
                        tempMatchOccurrenceMap.get(matchKey).add(p.id);
                    }
                });
            });
        }
    });

    let currentRepetitions = 0;
    tempPhaseForEvaluation.pools.forEach(pool => {
        pool.matches.forEach(match => {
            if (match.team1Id && match.team2Id) {
                const matchKey = JSON.stringify([match.team1Id, match.team2Id].sort());
                const occurrences = tempMatchOccurrenceMap.get(matchKey);
                if (occurrences && occurrences.has(tempPhaseForEvaluation.id) && Array.from(occurrences).some(id => id !== tempPhaseForEvaluation.id)) {
                     currentRepetitions++;
                }
            }
        });
    });

    return { pools: generatedPools, repetitions: currentRepetitions, remainingTeamsCount: generationResult.remainingTeamsCount };
	}

    /**
     * Unified function to generate pools for any brassage phase.
     * @param {string} phaseIdToUpdate ID of the phase whose pools are to be generated.
     */
    function generatePoolsForPhase(phaseIdToUpdate) {
        console.log("--- DEBUG: Entering generatePoolsForPhase ---");
        console.log(`DEBUG: Requested Phase ID to Update: ${phaseIdToUpdate}`);

        if (AppState.teamTournament.allTeams.length === 0) {
            showToast("Aucune équipe n'a été ajoutée. Veuillez gérer les équipes d'abord.", "error");
            console.log("DEBUG: No teams available, exiting.");
            return;
        }

        const numPoolsInput = document.getElementById('teamsPerPool'); // Get the input element
        const requestedTeamsPerPool = parseInt(numPoolsInput.value);

        if (isNaN(requestedTeamsPerPool) || requestedTeamsPerPool < 1) {
            showToast("Veuillez entrer un nombre valide d'équipes par poule (au moins 1).", "error");
            console.log("DEBUG: Invalid teams per pool (less than 1), exiting.");
            return;
        }

        if (requestedTeamsPerPool > 10) {
            showToast("Le nombre d'équipes par poule ne peut pas dépasser 10 (le niveau maximum des équipes).", "error");
            console.log("DEBUG: Teams per pool exceeds max level (10), exiting.");
            return;
        }

        const phaseToGenerate = AppState.teamTournament.allBrassagePhases.find(p => p.id === phaseIdToUpdate);
        if (!phaseToGenerate) {
            showToast("Erreur: Phase à générer introuvable.", "error");
            console.log(`DEBUG: Phase with ID ${phaseIdToUpdate} not found, exiting.`);
            return;
        }
        console.log(`DEBUG: Phase to generate found: ${phaseToGenerate.name} (Type: ${phaseToGenerate.type})`);

        // Get sorted list of actual brassage phases (initial and secondary)
        const sortedActualBrassagePhases = AppState.teamTournament.allBrassagePhases
            .filter(p => p.type === PHASE_TYPE_INITIAL || p.type === PHASE_TYPE_SECONDARY_BRASSAGE)
            .sort((a, b) => a.timestamp - b.timestamp);

        const currentPhaseIndexInSorted = sortedActualBrassagePhases.findIndex(p => p.id === phaseIdToUpdate);
        // Check if this is the absolute first brassage phase created by chronological order
        const isFirstActualBrassagePhaseOverall = currentPhaseIndexInSorted === 0;
        console.log(`DEBUG: Is this the first *overall* brassage phase? ${isFirstActualBrassagePhaseOverall}`);

        // Get the user's selected pool generation basis directly from radio buttons
        const basisInitialLevelsRadio = document.getElementById('basisInitialLevels');
        const basisPreviousResultsRadio = document.getElementById('basisPreviousResults');
        const selectedBasisFromUI = basisInitialLevelsRadio.checked ? 'initialLevels' : (basisPreviousResultsRadio.checked ? 'previousResults' : null);
        console.log(`DEBUG: User's selected basis from radio buttons: "${selectedBasisFromUI}"`);

        let effectiveUseInitialLevels;

        if (isFirstActualBrassagePhaseOverall) {
            // The very first brassage phase (initial or secondary, though usually initial) MUST use initial levels.
            effectiveUseInitialLevels = true;
            showToast("La toute première phase de brassage utilise toujours les niveaux initiaux des équipes.", "info");
            console.log("DEBUG: This is the first *overall* brassage phase. Forcing effectiveUseInitialLevels = true.");
        } else if (phaseToGenerate.type === PHASE_TYPE_SECONDARY_BRASSAGE) {
            // Secondary brassage phases always derive from previous results.
            effectiveUseInitialLevels = false;
            console.log("DEBUG: Phase type is SECONDARY_BRASSAGE. Forcing effectiveUseInitialLevels = false.");
        } else if (phaseToGenerate.type === PHASE_TYPE_INITIAL) {
            // For subsequent initial brassage phases, respect the user's chosen basis.
            effectiveUseInitialLevels = (selectedBasisFromUI === 'initialLevels');
            console.log(`DEBUG: Phase type is INITIAL_BRASSAGE (not first overall). EffectiveUseInitialLevels based on selectedBasis: ${effectiveUseInitialLevels}.`);
        } else {
            // Fallback for any other unexpected phase type, default to initial levels or throw error
            effectiveUseInitialLevels = true; // Safe default
            console.warn(`DEBUG: Unknown phase type encountered (${phaseToGenerate.type}). Defaulting to initial levels.`);
        }

        console.log(`DEBUG: Final effectiveUseInitialLevels for this generation attempt: ${effectiveUseInitialLevels}`);

        // Now, apply the check for previous results only if the effective method for THIS phase is 'previousResults'
        if (!effectiveUseInitialLevels) { // This means the effective method for this generation is 'previousResults'
            const previousBrassagePhase = sortedActualBrassagePhases[currentPhaseIndexInSorted - 1];
            console.log(`DEBUG: Effective method is 'previousResults'. Checking previous phase completion.`);
            if (!previousBrassagePhase) {
                showToast("Erreur logique: La phase précédente est introuvable pour une génération basée sur les résultats.", "error");
                console.log("DEBUG: Previous phase not found for results-based generation, exiting.");
                return;
            }
            console.log(`DEBUG: Previous phase to check: ${previousBrassagePhase.name} (ID: ${previousBrassagePhase.id})`);
            if (!isBrassagePhaseComplete(previousBrassagePhase)) {
                showToast(`Veuillez compléter tous les scores de la phase précédente ("${escapeHtml(previousBrassagePhase.name)}") avant de générer les poules basées sur les résultats.`, "error");
                console.log(`DEBUG: Previous phase (${previousBrassagePhase.name}) is NOT complete, exiting.`);
                return;
            }
            console.log(`DEBUG: Previous phase (${previousBrassagePhase.name}) IS complete.`);
        }

        // Determine the actual teams to use for generation
        const teamsForGeneration = effectiveUseInitialLevels ? AppState.teamTournament.allTeams : (function() {
            const globalRankings = getGlobalRankings(AppState.teamTournament.allTeams, AppState.teamTournament.allBrassagePhases);
            const teamsWithScores = globalRankings.filter(r => r.totalPoints !== 0 || r.totalDiffScore !== 0).map(r => ({
                id: r.teamObject.id,
                name: r.teamObject.name,
                level: r.teamObject.level,
                totalPoints: r.totalPoints,
                totalDiffScore: r.totalDiffScore
            }));
            // If there are no teams with scores, fall back to all teams but warn
            if (teamsWithScores.length === 0 && !isFirstActualBrassagePhaseOverall) {
                showToast("Aucune équipe avec des scores enregistrés pour générer des poules basées sur les résultats précédents. Les niveaux initiaux seront utilisés.", "error");
                console.log("DEBUG: No teams with scores for results-based generation, falling back to all teams.");
                return AppState.teamTournament.allTeams; // Fallback
            }
            console.log(`DEBUG: Teams for generation based on scores (${teamsWithScores.length} teams):`, teamsWithScores.map(t => `${t.name} (Pts: ${t.totalPoints}, Diff: ${t.totalDiffScore})`).join(', '));
            return teamsWithScores.length > 0 ? teamsWithScores : AppState.teamTournament.allTeams; // Use teamsWithScores if available, else allTeams
        })();

        if (teamsForGeneration.length === 0) {
             showToast("Aucune équipe disponible pour générer des poules.", "error");
             console.log("DEBUG: No teams for generation, exiting.");
             return;
        }
        if (teamsForGeneration.length < requestedTeamsPerPool) {
            showToast(`Pas assez d'équipes (${teamsForGeneration.length}) pour former des poules de ${requestedTeamsPerPool} équipes. Réduisez le nombre d'équipes par poule ou ajoutez des équipes.` + (effectiveUseInitialLevels ? "" : " Assurez-vous d'avoir suffisamment d'équipes avec des scores valides."), "error");
            console.log("DEBUG: Not enough teams for requested pools, exiting.");
            return;
        }


        const MAX_ATTEMPTS = 20; // Number of times to try generating pools
        let bestPools = null;
        let minRepetitions = Infinity;
        let bestRemainingTeamsCount = Infinity;
        console.log(`DEBUG: Starting pool generation attempts (max ${MAX_ATTEMPTS})...`);

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            // Generate and evaluate potential pools
            const result = generateAndEvaluatePools(phaseToGenerate.type, teamsForGeneration, requestedTeamsPerPool, null, phaseIdToUpdate, effectiveUseInitialLevels);

            if (result.pools) {
                // Prioritize fewer repetitions, then fewer remaining teams
                if (result.repetitions < minRepetitions) {
                    minRepetitions = result.repetitions;
                    bestPools = result.pools;
                    bestRemainingTeamsCount = result.remainingTeamsCount;
                } else if (result.repetitions === minRepetitions && result.remainingTeamsCount < bestRemainingTeamsCount) {
                    // If repetitions are the same, prefer fewer unassigned teams
                    minRepetitions = result.repetitions; // Redundant but for clarity
                    bestPools = result.pools;
                    bestRemainingTeamsCount = result.remainingTeamsCount;
                }

                // If we found a perfect solution (0 repetitions), no need to try further
                if (minRepetitions === 0 && bestRemainingTeamsCount === 0) { // Also ensure all teams assigned
                     console.log(`DEBUG: Optimal solution found in ${attempt + 1} attempts.`);
                     break;
                }
            }
        }

        if (!bestPools) {
            showToast("Impossible de générer des poules valides après plusieurs tentatives. Vérifiez le nombre d'équipes et les paramètres.", "error");
            console.log("DEBUG: Failed to generate valid pools after all attempts, exiting.");
            return;
        }

        const phaseIndex = AppState.teamTournament.allBrassagePhases.findIndex(p => p.id === phaseIdToUpdate);
        if (phaseIndex > -1) {
            AppState.teamTournament.allBrassagePhases[phaseIndex].pools = bestPools;
            AppState.teamTournament.allBrassagePhases[phaseIndex].generated = true;
            saveAllData(); // Sauve les données, cela déclenchera le re-rendu de l'UI

            let successMessage = bestPools.length + " poule(s) générée(s) avec succès pour cette phase ! ";
            if (minRepetitions > 0) {
                successMessage += `Ceci a entraîné ${minRepetitions} rencontre(s) répétée(s) (minimum trouvé après ${MAX_ATTEMPTS} tentatives).`;
            } else {
                successMessage += `Aucune rencontre répétée détectée dans cette phase.`;
            }
            if (bestRemainingTeamsCount > 0) {
                successMessage += ` ${bestRemainingTeamsCount} équipe(s) n'ont pas pu être assignée(s) à une poule.`;
            }
            showToast(successMessage, "success");
            console.log("DEBUG: Pool generation successful.");
        } else {
            showToast("Erreur: Phase à générer introuvable après les vérifications.", "error");
            console.log("DEBUG: Phase not found after final checks, exiting.");
        }
        console.log("--- DEBUG: Exiting generatePoolsForPhase ---");
    }
	
	/**
     * Logic to generate pools based on initial team levels.
     * @param {Array<Object>} teamsToUse The teams to use for generation.
     * @param {number} requestedTeamsPerPool The number of teams desired per pool.
     * @param {HTMLElement} msgElement Element to display messages.
     * @returns {Object|null} Object containing generated pools and remaining teams count, or null on failure.
     */
    function _generatePoolsLogicInitialLevels(teamsToUse, requestedTeamsPerPool, msgElement) {
        const teamsByExactLevel = new Map();
        for (let i = 1; i <= 10; i++) {
            teamsByExactLevel.set(i, shuffleArray(teamsToUse.filter(team => team.level === i)));
        }

        let maxPoolsThatCanBeFormed = Infinity;
        let requiredLevelsPresent = true;

        for (let level = 1; level <= requestedTeamsPerPool; level++) {
            const teamsAtLevel = teamsByExactLevel.get(level);
            if (!teamsAtLevel || teamsAtLevel.length === 0) {
                requiredLevelsPresent = false;
                // showToast(`Impossible de former des poules de ${requestedTeamsPerPool} équipes: il manque des équipes de niveau ${level}.`, "error");
                return null;
            }
            maxPoolsThatCanBeFormed = Math.min(maxPoolsThatCanBeFormed, teamsAtLevel.length);
        }

        if (!requiredLevelsPresent) return null;

        const generatedPools = [];
        for (let i = 0; i < maxPoolsThatCanBeFormed; i++) {
            const poolName = String.fromCharCode(65 + i);
            const pool = {
                id: 'pool_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
                name: "Poule " + poolName,
                teams: [],
                matches: []
            };

            for (let level = 1; level <= requestedTeamsPerPool; level++) {
                pool.teams.push(teamsByExactLevel.get(level).pop());
            }

            for (let t1_idx = 0; t1_idx < pool.teams.length; t1_idx++) {
                for (let t2_idx = t1_idx + 1; t2_idx < pool.teams.length; t2_idx++) {
                    pool.matches.push({
                        team1Id: pool.teams[t1_idx].id,
                        team1Name: pool.teams[t1_idx].name,
                        team2Id: pool.teams[t2_idx].id,
                        team2Name: pool.teams[t2_idx].name,
                        score1: null,
                        score2: null,
                        winnerId: null,
						scoreValide: false
                    });
                }
            }
            generatedPools.push(pool);
        }

        let allRemainingTeams = [];
        teamsByExactLevel.forEach(teamsAtLevel => {
            allRemainingTeams.push(...teamsAtLevel);
        });
        allRemainingTeams = shuffleArray(allRemainingTeams);

        let currentPoolIdxForRemaining = 0;
        while (allRemainingTeams.length > 0 && generatedPools.length > 0) {
            if (generatedPools.length === 0) break;

            const pool = generatedPools[currentPoolIdxForRemaining];
            const teamToAdd = allRemainingTeams.pop();

            if (!pool.teams.some(t => t.id === teamToAdd.id)) { // Prevent adding same team multiple times
                pool.teams.push(teamToAdd);
                // Add new matches with the newly added team against existing teams in the pool
                pool.teams.filter(t => t.id !== teamToAdd.id).forEach(existingTeam => {
                    pool.matches.push({
                        team1Id: teamToAdd.id,
                        team1Name: teamToAdd.name,
                        team2Id: existingTeam.id,
                        team2Name: existingTeam.name,
                        score1: null, score2: null, winnerId: null
                    });
                });
            }
            currentPoolIdxForRemaining = (currentPoolIdxForRemaining + 1) % generatedPools.length;
        }
        return { pools: generatedPools, remainingTeamsCount: allRemainingTeams.length };
    }

    /**
     * Génère des poules basées sur le classement global, en essayant de minimiser les rencontres répétées.
     * @param {Array<Object>} teamsForThisGroup Les équipes du groupe actuel, avec leurs totaux de points/diff.
     * @param {number} requestedTeamsPerPool Le nombre d'équipes souhaité par poule.
     * @param {HTMLElement} msgElement L'élément pour afficher les messages.
     * @returns {Object|null} Les poules générées et le nombre d'équipes restantes, ou null en cas d'échec.
     */
    function _generatePoolsLogicRankingBased(teamsForThisGroup, requestedTeamsPerPool, msgElement) {
        if (teamsForThisGroup.length === 0) {
            // showToast("Aucune équipe disponible pour former les poules dans ce groupe.", "error");
            return null;
        }

        const numInternalTiers = requestedTeamsPerPool; // Représente combien de niveaux nous divisons les équipes en
        const totalTeamsInGroup = teamsForThisGroup.length;

        if (numInternalTiers < 1) {
            // showToast("Le nombre d'équipes par poule doit être au moins 1.", "error");
            return null;
        }

        // Trier les équipes au sein du groupe par leur classement (points, puis différence de score)
        const sortedTeamsWithinGroup = [...teamsForThisGroup].sort((a, b) => b.totalPoints - a.totalPoints || b.totalDiffScore - a.totalDiffScore);

        const teamsGroupedByInternalTier = new Map();
        for(let i = 0; i < numInternalTiers; i++) {
            teamsGroupedByInternalTier.set(i, []);
        }

        // Distribuer les équipes de manière égale dans `numInternalTiers` en fonction de leur ordre trié
        for (let i = 0; i < totalTeamsInGroup; i++) {
            const tierIndex = i % numInternalTiers; // Distribution en serpentin dans les niveaux
            teamsGroupedByInternalTier.get(tierIndex).push(sortedTeamsWithinGroup[i]);
        }

        // Déterminer le nombre de poules en fonction de la plus petite taille de niveau
        let minTierSize = Infinity;
        const tierKeys = Array.from(teamsGroupedByInternalTier.keys()).sort((a,b)=>a-b);

        for (const tier of tierKeys) {
            const teamsInThisTier = teamsGroupedByInternalTier.get(tier);
            minTierSize = Math.min(minTierSize, teamsInThisTier.length);
        }

        if (minTierSize === 0 || minTierSize === Infinity || minTierSize < 1) {
            // showToast(`Pas assez d'équipes pour former des poules équilibrées de ${requestedTeamsPerPool} équipes à partir de ce groupe. Réduisez le nombre d'équipes par poule ou ajoutez des équipes.`, "error");
            return null;
        }

        const numberOfPools = minTierSize;
        const generatedPools = [];

        // Générer des décalages aléatoires pour chaque niveau afin de diversifier les compositions de poules
        // C'est le changement principal pour minimiser les répétitions : chaque niveau commencera sa sélection d'équipe
        // à partir d'un point différent, en tournant à travers ses membres pour chaque poule.
        const tierOffsets = shuffleArray(Array.from({length: numInternalTiers}, (_, k) => k));

        for (let i = 0; i < numberOfPools; i++) {
            const poolName = String.fromCharCode(65 + i);
            const pool = {
                id: 'pool_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
                name: "Poule " + poolName,
                teams: [],
                matches: []
            };

            for (const tier of tierKeys) {
                const teamsInThisTier = teamsGroupedByInternalTier.get(tier);
                // Appliquer le décalage pour choisir l'équipe du niveau, en s'assurant de revenir au début si l'index dépasse la longueur
                const actualIndex = (i + tierOffsets[tier]) % teamsInThisTier.length;

                if (teamsInThisTier && teamsInThisTier[actualIndex]) {
                    // Nous devons passer l'objet équipe complet ici, pas seulement l'ID/le nom.
                    // Les `teamsForThisGroup` contiennent déjà les objets équipe originaux et leurs scores calculés.
                    const originalTeam = AppState.teamTournament.allTeams.find(t => t.id === teamsInThisTier[actualIndex].id);
                    if (originalTeam) {
                        pool.teams.push({
                            ...originalTeam, // Propriétés de l'équipe originale (id, nom, niveau)
                            totalPoints: teamsInThisTier[actualIndex].totalPoints, // Points calculés
                            totalDiffScore: teamsInThisTier[actualIndex].totalDiffScore // Différence de score calculée
                        });
                    } else {
                        console.warn(`Original team data not found for ID: ${teamsInThisTier[actualIndex].id}`);
                        pool.teams.push(teamsInThisTier[actualIndex]); // Fallback vers les données partielles
                    }

                } else {
                    console.warn(`ATTENTION: Tentative de prendre une équipe de tiers vide ou hors limite pour la poule ${pool.name}, tier ${tier}, index ${actualIndex}.`);
                }
            }

            shuffleArray(pool.teams); // Mélanger les équipes dans la poule après la sélection

            // Générer les matchs pour cette poule (tous contre tous)
            for (let t1_idx = 0; t1_idx < pool.teams.length; t1_idx++) {
                for (let t2_idx = t1_idx + 1; t2_idx < pool.teams.length; t2_idx++) {
                    pool.matches.push({
                        team1Id: pool.teams[t1_idx].id,
                        team1Name: pool.teams[t1_idx].name,
                        team2Id: pool.teams[t2_idx].id,
                        team2Name: pool.teams[t2_idx].name,
                        score1: null,
                        score2: null,
                        winnerId: null
                    });
                }
            }
            generatedPools.push(pool);
        }

        let remainingTeamsCount = 0;
        // Calculer les équipes restantes (celles qui ne sont utilisées dans aucune poule)
        teamsGroupedByInternalTier.forEach(group => {
            remainingTeamsCount += (group.length - numberOfPools);
        });

        return { pools: generatedPools, remainingTeamsCount: remainingTeamsCount };
    }

    /**
     * Renommage de la fonction `previewSecondaryGroups` en `_performSecondaryGroupsPreview`
     * et ajout d'un wrapper `previewSecondaryGroups` pour la modale d'avertissement.
     */
    function _performSecondaryGroupsPreview() {
        const numberOfSecondaryGroupsInput = document.getElementById('numberOfSecondaryGroups');
        const secondaryGroupsPreviewDisplay = document.getElementById('secondaryGroupsPreviewDisplay');
        const validateSecondaryGroupsBtn = document.getElementById('validateSecondaryGroupsBtn');
        const generateSecondaryBrassagesBtn = document.getElementById('generateSecondaryBrassagesBtn');
        const refreshSecondaryGroupScoresBtn = document.getElementById('refreshSecondaryGroupScoresBtn');

        const numGroups = parseInt(numberOfSecondaryGroupsInput.value);
        if (isNaN(numGroups) || (numGroups !== 2 && numGroups !== 3)) {
            showToast("Veuillez choisir 2 ou 3 groupes de niveau pour la création.", "error");
            secondaryGroupsPreviewDisplay.innerHTML = '';
            validateSecondaryGroupsBtn.classList.add('hidden');
            generateSecondaryBrassagesBtn.classList.add('hidden');
            refreshSecondaryGroupScoresBtn.classList.add('hidden'); // Hide refresh button
            AppState.teamTournament.currentSecondaryGroupsPreview = {}; // Clear preview if invalid selection
            saveAllData(); // Sauve l'état vide
            return;
        }

        const globalRankings = getGlobalRankings(AppState.teamTournament.allTeams, AppState.teamTournament.allBrassagePhases);
        if (globalRankings.length === 0) {
            showToast("Aucune équipe classée disponible pour créer les groupes. Générez et terminez des phases de brassage initiales d'abord.", "error");
            secondaryGroupsPreviewDisplay.innerHTML = '';
            validateSecondaryGroupsBtn.classList.add('hidden');
            generateSecondaryBrassagesBtn.classList.add('hidden');
            refreshSecondaryGroupScoresBtn.classList.add('hidden'); // Hide refresh button
            AppState.teamTournament.currentSecondaryGroupsPreview = {}; // Clear preview if no rankings
            saveAllData(); // Sauve l'état vide
            return;
        }

        AppState.teamTournament.currentSecondaryGroupsPreview = {}; // Reset for new preview
        const groupNamesMap = { 2: ["Principale", "Consolante"], 3: ["Principale", "Consolante", "Super Consolante"] };
        const selectedGroupNames = groupNamesMap[numGroups];

        const teamsToDistribute = [...globalRankings];
        const totalTeams = teamsToDistribute.length;
        const baseGroupSize = Math.floor(totalTeams / numGroups);
        let remainder = totalTeams % numGroups;
        let currentTeamIndex = 0;

        for (let i = 0; i < numGroups; i++) {
            const groupName = selectedGroupNames[i];
            AppState.teamTournament.currentSecondaryGroupsPreview[groupName] = [];
            const currentSize = baseGroupSize + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder--;

            for (let j = 0; j < currentSize; j++) {
                if (teamsToDistribute[currentTeamIndex]) {
                    const teamForPreview = {
                        ...teamsToDistribute[currentTeamIndex].teamObject,
                        totalPoints: teamsToDistribute[currentTeamIndex].totalPoints,
                        totalDiffScore: teamsToDistribute[currentTeamIndex].totalDiffScore,
                        previewGroup: groupName
                    };
                    AppState.teamTournament.currentSecondaryGroupsPreview[groupName].push(teamForPreview);
                }
                currentTeamIndex++;
            }
        }

        renderSecondaryGroupsPreview(selectedGroupNames);
        saveAllData(); // Sauve la nouvelle prévisualisation générée
        showToast(`Création des ${numGroups} groupes de niveau terminée. Ajustez si nécessaire.`, "success");
    }

    /**
     * NOUVELLE FONCTION: Affiche une modale avec les options pour une équipe spécifique.
     * Permet de déplacer l'équipe ou de changer son statut d'élimination.
     * @param {string} teamId L'ID de l'équipe.
     * @param {string} teamName Le nom de l'équipe.
     * @param {number} totalPoints Les points totaux de l'équipe.
     * @param {number} totalDiffScore La différence de score totale de l'équipe.
     * @param {string} currentGroup Le groupe actuel de l'équipe.
     * @param {Array<string>} allGroupNames Tous les noms de groupes possibles.
     */
    function showTeamOptionsModal(teamId, teamName, totalPoints, totalDiffScore, currentGroup, allGroupNames) {
        const isCurrentlyEliminated = AppState.teamTournament.eliminatedTeams.has(teamId);
        const teamStatusText = isCurrentlyEliminated ? 'Actuellement **Éliminée**' : 'Actuellement **En Jeu**';
        const toggleEliminationAction = isCurrentlyEliminated ? 'Remettre en jeu' : 'Éliminer';
        const toggleEliminationColor = isCurrentlyEliminated ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

        const modalContentDiv = document.createElement('div');
        modalContentDiv.className = 'space-y-4 text-gray-700';
        modalContentDiv.innerHTML = `
            <p class="text-md">Options pour <span class="font-bold">${escapeHtml(teamName)}</span> (Pts: ${totalPoints}, Diff: ${totalDiffScore})</p>
            <p class="text-sm font-semibold">${teamStatusText}</p>
            <div class="flex flex-col space-y-2 mt-4">
                <button id="moveTeamOptionBtn" class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition ease-in-out duration-150">
                    Déplacer l'équipe dans un autre groupe
                </button>
                <button id="toggleEliminationOptionBtn" class="${toggleEliminationColor} text-white py-2 px-4 rounded-md transition ease-in-out duration-150">
                    ${toggleEliminationAction} cette équipe
                </button>
            </div>
        `;

        showModal(`Gérer l'équipe : ${escapeHtml(teamName)}`, modalContentDiv, () => { /* Aucune action par défaut */ }, false, false); // No delete style, no cancel button

        document.getElementById('moveTeamOptionBtn').addEventListener('click', () => {
            if (AppState.isGuestMode) {
                showToast("Veuillez vous connecter pour déplacer les équipes entre les groupes.", "error");
                hideModal(); // Cacher la modale d'options
                showLoginRequiredModal(); // Proposer la connexion
                return;
            }
            hideModal(); // Cacher la modale d'options
            showMoveTeamModal(teamId, teamName, currentGroup, totalPoints, totalDiffScore, allGroupNames);
        });

        document.getElementById('toggleEliminationOptionBtn').addEventListener('click', () => {
            if (AppState.isGuestMode) {
                showToast("Veuillez vous connecter pour gérer le statut d'élimination des équipes.", "error");
                hideModal(); // Hide modal
                showLoginRequiredModal(); // Prompt for login
                return;
            }

            if (AppState.teamTournament.eliminatedTeams.has(teamId)) {
                AppState.teamTournament.eliminatedTeams.delete(teamId);
                showToast(`${escapeHtml(teamName)} remise en jeu.`, "info");
            } else {
                AppState.teamTournament.eliminatedTeams.add(teamId);
                showToast(`${escapeHtml(teamName)} éliminée.`, "info");
            }
            saveAllData();
            const numberOfSecondaryGroupsInput = document.getElementById('numberOfSecondaryGroups');
            const groupNamesMap = { 2: ["Principale", "Consolante"], 3: ["Principale", "Consolante", "Super Consolante"] };
            renderSecondaryGroupsPreview(groupNamesMap[parseInt(numberOfSecondaryGroupsInput.value)]);
            hideModal(); // Cacher la modale après l'action
        });

        modalConfirmBtn.onclick = () => hideModal();
        modalCancelBtn.onclick = () => hideModal();
    }

    /**
     * Affiche une modale pour déplacer une équipe entre les groupes secondaires.
     * @param {string} teamId L'ID de l'équipe à déplacer.
     * @param {string} teamName Le nom de l'équipe.
     * @param {string} currentGroup Le groupe actuel de l'équipe.
     * @param {number} totalPoints Les points totaux de l'équipe.
     * @param {number} totalDiffScore La différence de score totale de l'équipe.
     * @param {Array<string>} allGroupNames Tous les noms de groupes possibles.
     */
    function showMoveTeamModal(teamId, teamName, currentGroup, totalPoints, totalDiffScore, allGroupNames) {
        const formDiv = document.createElement('div');
        formDiv.className = 'space-y-4';
        formDiv.innerHTML = `
            <p class="text-gray-700">Déplacer l'équipe <span class="font-bold">${escapeHtml(teamName)}</span> (Pts: ${totalPoints}, Diff: ${totalDiffScore}) :</p>
            <div>
                <label for="moveTeamGroupSelect" class="block text-sm font-medium text-gray-700 mb-1">Nouveau groupe :</label>
                <select id="moveTeamGroupSelect"
                        class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                </select>
            </div>
            <p id="moveModalMessage" class="text-sm text-center"></p>
        `;
        const groupSelect = formDiv.querySelector('#moveTeamGroupSelect');

        allGroupNames.forEach(groupName => {
            const option = document.createElement('option');
            option.value = groupName;
            option.textContent = groupName;
            if (groupName === currentGroup) {
                option.selected = true;
            }
            groupSelect.appendChild(option);
        });

        showModal('Déplacer l\'équipe', formDiv, async () => {
            const newGroup = groupSelect.value;
            if (newGroup === currentGroup) {
                return;
            }
            moveTeamBetweenSecondaryGroups(teamId, currentGroup, newGroup);
        });
    }

    /**
     * Déplace une équipe entre deux groupes secondaires.
     * @param {string} teamId L'ID de l'équipe à déplacer.
     * @param {string} fromGroup Le nom du groupe d'origine.
     * @param {string} toGroup Le nom du groupe de destination.
     */
    function moveTeamBetweenSecondaryGroups(teamId, fromGroup, toGroup) {
        if (fromGroup === toGroup) return;

        let teamToMove = null;
        AppState.teamTournament.currentSecondaryGroupsPreview[fromGroup] = AppState.teamTournament.currentSecondaryGroupsPreview[fromGroup].filter(team => {
            if (team.id === teamId) {
                teamToMove = team;
                return false;
            }
            return true;
        });

        if (teamToMove) {
            teamToMove.previewGroup = toGroup;
            if (!AppState.teamTournament.currentSecondaryGroupsPreview[toGroup]) {
                AppState.teamTournament.currentSecondaryGroupsPreview[toGroup] = [];
            }
            AppState.teamTournament.currentSecondaryGroupsPreview[toGroup].push(teamToMove);

            AppState.teamTournament.currentSecondaryGroupsPreview[toGroup].sort((a, b) => b.totalPoints - a.totalPoints || b.totalDiffScore - a.totalDiffScore);

            const numberOfSecondaryGroupsInput = document.getElementById('numberOfSecondaryGroups');
            const groupNamesMap = { 2: ["Principale", "Consolante"], 3: ["Principale", "Consolante", "Super Consolante"] };
            renderSecondaryGroupsPreview(groupNamesMap[parseInt(numberOfSecondaryGroupsInput.value)]);
            saveAllData();
            showToast(`Équipe ${escapeHtml(teamToMove.name)} déplacée vers ${escapeHtml(toGroup)}.`, "success");

        } else {
            console.error("ERROR: Team not found for movement:", teamId);
        }
    }

    /**
     * Valide la composition actuelle des groupes secondaires pour les phases éliminatoires.
     * Crée une phase spéciale de type `elimination_seeding`.
     */
    function validateSecondaryGroupsForElimination() {

        const messageContent = document.createElement('p');
        messageContent.textContent = "Confirmer la composition actuelle des groupes pour les phases éliminatoires ? Cette action enregistre ce regroupement.";
        messageContent.className = 'text-gray-700';

        showModal('Valider les Groupes', messageContent, () => {
            if (Object.keys(AppState.teamTournament.currentSecondaryGroupsPreview).length === 0) {
                showToast("Aucun groupe à valider. Créez les groupes d'abord.", "error");
                return;
            }

            AppState.teamTournament.allBrassagePhases = AppState.teamTournament.allBrassagePhases.filter(p => p.type !== PHASE_TYPE_ELIMINATION_SEEDING);

            const eliminationSeedingPhase = {
                id: `${PHASE_TYPE_ELIMINATION_SEEDING}_${Date.now()}`,
                type: PHASE_TYPE_ELIMINATION_SEEDING,
                name: `Répartition Éliminatoire Validée (${new Date().toLocaleDateString('fr-FR')})`,
                timestamp: Date.now(),
                groupedTeams: JSON.parse(JSON.stringify(AppState.teamTournament.currentSecondaryGroupsPreview)), // Deep copy
                generated: true
            };
            AppState.teamTournament.allBrassagePhases.push(eliminationSeedingPhase);
            saveAllData();
            showToast("Répartition des groupes validée pour les éliminatoires !", "success");

			window.location.hash = '#eliminatoires';
        });
    }

    /**
     * NOUVELLE FONCTION : Validation directe pour l'élimination.
     * Crée une phase de type `elimination_seeding` avec toutes les équipes éligibles dans un seul groupe.
     */
    async function validateForDirectElimination() {

        const messageContent = document.createElement('p');
        messageContent.innerHTML = `
            Êtes-vous sûr de vouloir valider toutes les équipes (non éliminées)
            pour la phase éliminatoire en vous basant sur le classement général ?
            <br>
            <strong>Attention :</strong> Cette action écrasera toute configuration de groupes secondaires préalablement validée
            et passera les équipes sélectionnées à l'étape éliminatoire principale.
        `;
        messageContent.className = 'text-gray-700';

        showModal('Confirmer la validation directe pour l\'élimination', messageContent, async () => {
            if (AppState.teamTournament.allTeams.length === 0) {
                showToast("Aucune équipe enregistrée. Veuillez ajouter des équipes d'abord.", "error");
                return;
            }

            const globalRankings = getGlobalRankings(AppState.teamTournament.allTeams, AppState.teamTournament.allBrassagePhases);
            if (globalRankings.length === 0) {
                showToast("Aucune équipe classée disponible. Veuillez générer et terminer des phases de brassage d'abord.", "error");
                return;
            }

            const eligibleTeams = globalRankings.filter(rankEntry => !AppState.teamTournament.eliminatedTeams.has(rankEntry.teamObject.id));

            if (eligibleTeams.length === 0) {
                showToast("Aucune équipe éligible (non éliminée) trouvée pour la phase éliminatoire.", "info");
                return;
            }

            const directEliminationGroup = {
                "Principale": eligibleTeams.map(r => ({
                    ...r.teamObject,
                    totalPoints: r.totalPoints,
                    totalDiffScore: r.totalDiffScore,
                    previewGroup: "Principale"
                }))
            };

            AppState.teamTournament.currentSecondaryGroupsPreview = {};
            await saveAllData();

            AppState.teamTournament.allBrassagePhases = AppState.teamTournament.allBrassagePhases.filter(p => p.type !== PHASE_TYPE_ELIMINATION_SEEDING);

            const eliminationSeedingPhase = {
                id: `${PHASE_TYPE_ELIMINATION_SEEDING}_${Date.now()}_direct`,
                type: PHASE_TYPE_ELIMINATION_SEEDING,
                name: `Validation Élimination Directe (${new Date().toLocaleDateString('fr-FR')})`,
                timestamp: Date.now(),
                groupedTeams: directEliminationGroup,
                generated: true
            };

            AppState.teamTournament.allBrassagePhases.push(eliminationSeedingPhase);
            await saveAllData();
            showToast("Toutes les équipes éligibles validées pour l'élimination directe !", "success");
            window.location.hash = '#eliminatoires';
        }, true);
    }

    /**
     * Génère les phases de brassage secondaires basées sur les groupes prévisualisés.
     */
    async function generateSecondaryBrassagePhases() {
        if (AppState.isGuestMode) {
            showToast("Veuillez vous connecter pour générer des phases de brassage secondaires.", "error");
            showLoginRequiredModal();
            return;
        }

        console.log("DEBUG: Lancement de generateSecondaryBrassagePhases...");

        const numPoolsInput = document.getElementById('teamsPerPool');
        const numberOfSecondaryGroupsInput = document.getElementById('numberOfSecondaryGroups');
        const secondaryPreviewMessage = document.getElementById('secondaryPreviewMessage');

        const teamsPerPoolForNewPhases = parseInt(numPoolsInput.value);

        if (isNaN(teamsPerPoolForNewPhases) || teamsPerPoolForNewPhases < 1) {
            showToast("Veuillez entrer un nombre valide d'équipes par poule (au moins 1) pour les phases secondaires.", "error");
            return;
        }

        if (Object.keys(AppState.teamTournament.currentSecondaryGroupsPreview).length === 0) {
            showToast("Veuillez d'abord créer les groupes de brassage secondaires.", "error");
            return;
        }

        const newPhases = [];
        const groupNamesMap = { 2: ["Principale", "Consolante"], 3: ["Principale", "Consolante", "Super Consolante"] };
        const numGroups = parseInt(numberOfSecondaryGroupsInput.value);
        const selectedGroupNames = groupNamesMap[numGroups];

        let generationFailed = false;

        for (const groupName of selectedGroupNames) {
            const teamsInThisGroup = AppState.teamTournament.currentSecondaryGroupsPreview[groupName];
            console.log(`DEBUG: Traitement du groupe: ${groupName} avec ${teamsInThisGroup ? teamsInThisGroup.length : 0} équipes.`);

            if (!teamsInThisGroup || teamsInThisGroup.length < teamsPerPoolForNewPhases) {
                showToast(`Le groupe "${escapeHtml(groupName)}" n'a pas assez d'équipes pour former des poules de ${teamsPerPoolForNewPhases} équipes. (${teamsInThisGroup.length} équipes disponibles)`, "error");
                generationFailed = true;
                break;
            }
            const MAX_ATTEMPTS = 20;
            let bestResult = null;
            let minReps = Infinity;
            let bestRemCount = Infinity;

            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                const result = generateAndEvaluatePools(PHASE_TYPE_SECONDARY_BRASSAGE, teamsInThisGroup, teamsPerPoolForNewPhases, secondaryPreviewMessage);
                if (result.pools) {
                    if (result.repetitions < minReps) {
                        minReps = result.repetitions;
                        bestResult = result;
                    } else if (result.repetitions === minReps && result.remainingTeamsCount < bestRemCount) {
                        minReps = result.repetitions;
                        bestResult = result;
                    }
                    if (minReps === 0 && bestRemCount === 0) break;
                }
            }

            if (bestResult && bestResult.pools.length > 0) {
                const newPhase = {
                    id: `${PHASE_TYPE_SECONDARY_BRASSAGE}_${Date.now()}_${groupName.replace(/\s/g, '_')}`,
                    type: PHASE_TYPE_SECONDARY_BRASSAGE,
                    name: `Brassage ${groupName}`,
                    pools: bestResult.pools,
                    generated: true,
                    timestamp: Date.now() + newPhases.length
                };
                newPhases.push(newPhase);
            } else {
                showToast(`Impossible de générer des poules pour le groupe ${escapeHtml(groupName)}. Vérifiez si vous avez suffisamment d'équipes dans ce groupe pour les poules de ${teamsPerPoolForNewPhases} équipes.`, "error");
                generationFailed = true;
                break;
            }
        }

        if (!generationFailed && newPhases.length > 0 && newPhases.length === numGroups) {
            AppState.teamTournament.allBrassagePhases.push(...newPhases);
            await saveAllData();
            showToast(`${newPhases.length} phases de brassage secondaires générées avec succès !`, "success");
        } else if (generationFailed) {
            console.error("ERREUR: La génération des phases supplémentaires a échoué pour au moins un groupe.");
        } else {
            showToast("Aucune phase de brassage secondaire n'a pu être générée. Vérifiez vos paramètres et le classement actuel.", "error");
            console.error("ERREUR: Aucune phase secondaire n'a été générée malgré aucune erreur explicite.");
        }
    }
	
	/**
     * Supprime toutes les phases de brassage (initiales et secondaires).
     */
    async function clearAllPhases() {
        if (AppState.isGuestMode) {
            showToast("Veuillez vous connecter pour effacer toutes les phases.", "error");
            showLoginRequiredModal();
            return;
        }

        const messageContent = document.createElement('p');
        messageContent.textContent = "Êtes-vous sûr de vouloir supprimer TOUTES les phases de brassage (initiales et secondaires) ? Cette action est irréversible.";
        messageContent.className = 'text-gray-700';

        showModal('Confirmer la suppression de toutes les phases', messageContent, async () => {
            AppState.teamTournament.allBrassagePhases = AppState.teamTournament.allBrassagePhases.filter(p => p.type === PHASE_TYPE_ELIMINATION_SEEDING); // Keep only seeding phases
            AppState.teamTournament.currentSecondaryGroupsPreview = {}; // Clear secondary groups preview
            await saveAllData(); // Sauve les données, cela déclenchera le re-rendu de l'UI
            showToast("Toutes les phases de brassage ont été supprimées.", "success");
        }, true); // Use red style for confirmation button
    }
    // --- Logique du Classement (partagée) ---

    /**
     * Calcule le classement global des équipes basé sur les phases de brassage,
     * y compris les scores détaillés par phase.
     */
    function getGlobalRankings(teams, brassagePhases) {
        const rankings = new Map(); // Map: teamId -> { teamObject, totalPoints, totalDiffScore, detailsByPhase }

        teams.forEach(team => {
            rankings.set(team.id, {
                teamObject: team,
                totalPoints: 0,
                totalDiffScore: 0,
                detailsByPhase: {} // Pour stocker les points/diff pour chaque phase individuellement
            });
        });

        brassagePhases.forEach(phase => {
            // Seulement compter les scores des phases de brassage initiales et secondaires
            if ((phase.type === PHASE_TYPE_INITIAL || phase.type === PHASE_TYPE_SECONDARY_BRASSAGE) && phase.generated && phase.pools) {
                // Initialiser les détails de phase pour toutes les équipes pour cette phase
                teams.forEach(team => {
                    const teamStats = rankings.get(team.id);
                    if (teamStats) { // S'assurer que teamStats existe
                        if (!teamStats.detailsByPhase[phase.id]) {
                            teamStats.detailsByPhase[phase.id] = { points: 0, diffScore: 0 };
                        }
                    }
                });

                phase.pools.forEach(pool => {
                    if (pool.matches) {
                        pool.matches.forEach(match => {
                            if (match.score1 !== null && match.score2 !== null && match.score1 >= 0 && match.score2 >= 0) {
                                const score1 = match.score1;
                                const score2 = match.score2;
                                const diff = Math.abs(score1 - score2);

                                const team1Stats = rankings.get(match.team1Id);
                                const team2Stats = rankings.get(match.team2Id);

                                // Mettre à jour les totaux globaux
                                if (team1Stats) {
                                    team1Stats.totalDiffScore += (score1 - score2);
                                    if (score1 > score2) team1Stats.totalPoints += 8;
                                    else if (score2 > score1) { // L'équipe 1 perd
                                        if (diff >= 1 && diff <= 3) team1Stats.totalPoints += 4;
                                        else if (diff >= 4 && diff <= 6) team1Stats.totalPoints += 3;
                                        else if (diff >= 7 && diff <= 9) team1Stats.totalPoints += 2;
                                        else if (diff >= 10) team1Stats.totalPoints += 1;
                                    }
                                }
                                if (team2Stats) {
                                    team2Stats.totalDiffScore += (score2 - score1);
                                    if (score2 > score1) team2Stats.totalPoints += 8;
                                    else if (score1 > score2) { // L'équipe 2 perd
                                        if (diff >= 1 && diff <= 3) team2Stats.totalPoints += 4;
                                        else if (diff >= 4 && diff <= 6) team2Stats.totalPoints += 3;
                                        else if (diff >= 7 && diff <= 9) team2Stats.totalPoints += 2;
                                        else if (diff >= 10) team2Stats.totalPoints += 1;
                                    }
                                }

                                // Mettre à jour les totaux par phase
                                if (team1Stats && team1Stats.detailsByPhase[phase.id]) {
                                    team1Stats.detailsByPhase[phase.id].diffScore += (score1 - score2);
                                    if (score1 > score2) team1Stats.detailsByPhase[phase.id].points += 8;
                                    else if (score2 > score1) {
                                        if (diff >= 1 && diff <= 3) team1Stats.detailsByPhase[phase.id].points += 4;
                                        else if (diff >= 4 && diff <= 6) team1Stats.detailsByPhase[phase.id].points += 3;
                                        else if (diff >= 7 && diff <= 9) team1Stats.detailsByPhase[phase.id].points += 2;
                                        else if (diff >= 10) team1Stats.detailsByPhase[phase.id].points += 1;
                                    }
                                }
                                if (team2Stats && team2Stats.detailsByPhase[phase.id]) {
                                    team2Stats.detailsByPhase[phase.id].diffScore += (score2 - score1);
                                    if (score2 > score1) team2Stats.detailsByPhase[phase.id].points += 8;
                                    else if (score1 > score2) {
                                        if (diff >= 1 && diff <= 3) team2Stats.detailsByPhase[phase.id].points += 4;
                                        else if (diff >= 4 && diff <= 6) team2Stats.detailsByPhase[phase.id].points += 3;
                                        else if (diff >= 7 && diff <= 9) team2Stats.detailsByPhase[phase.id].points += 2;
                                        else if (diff >= 10) team2Stats.detailsByPhase[phase.id].points += 1;
                                    }
                                }
                            }
                        });
                    }
                });
            }
        });

        let sortedRankings = Array.from(rankings.values()).sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) {
                return b.totalPoints - a.totalPoints; // Tri par points décroissant
            }
            if (b.totalDiffScore !== a.totalDiffScore) {
                return b.totalDiffScore - a.totalDiffScore; // Puis par différence de score décroissante
            }
            // En cas d'égalité, tri par niveau initial (plus bas est meilleur) puis par nom
            if (a.teamObject.level !== b.teamObject.level) return a.teamObject.level - b.teamObject.level;
            return a.teamObject.name.localeCompare(b.teamObject.name);
        });
        return sortedRankings;
    }

    // --- Fonctions de Rendu des Pages (Vues) ---

    /**
     * Affiche la page d'authentification (connexion/inscription).
     * En mode invité, affiche un message indiquant les limitations.
     */
	function renderAuthPage() {
        APP_CONTAINER.innerHTML = `
            <div class="max-w-md mx-auto mt-10 p-8 bg-white rounded-lg shadow-xl">

                <div id="login-container">
                    <h2 class="text-2xl font-bold text-center mb-6">Connexion</h2>
                    <div class="space-y-4">
                        <div>
                            <label for="authEmail" class="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" id="authEmail" class="mt-1 w-full p-2 border rounded-md" placeholder="votre.email@example.com">
                        </div>
                        <div>
                            <label for="authPassword" class="block text-sm font-medium text-gray-700">Mot de passe</label>
                            <input type="password" id="authPassword" class="mt-1 w-full p-2 border rounded-md" placeholder="********">
                        </div>
                        <button id="loginBtn" class="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition">Se connecter</button>

                        <div class="text-sm text-center pt-2">
                            <p class="mt-4">
                                <a href="#" id="forgotPasswordLink" class="font-medium text-gray-500 hover:text-blue-600 hover:underline">Mot de passe oublié ?</a>
                            </p>
                            <p class="mt-2">
                                Vous n'avez pas encore de compte ?
                                <a href="#" id="showRegisterLink" class="font-medium text-blue-600 hover:underline">Créer un compte</a>
                            </p>
                        </div>
                        </div>
                </div>

                <div id="register-container" class="hidden">
                    <h2 class="text-2xl font-bold text-center mb-6">Créer un Compte</h2>
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="registerFirstName" class="block text-sm font-medium">Prénom</label>
                                <input type="text" id="registerFirstName" class="mt-1 w-full p-2 border rounded-md">
                            </div>
                            <div>
                                <label for="registerLastName" class="block text-sm font-medium">Nom</label>
                                <input type="text" id="registerLastName" class="mt-1 w-full p-2 border rounded-md">
                            </div>
                        </div>
                        <div>
                            <label for="registerClubName" class="block text-sm font-medium">Nom du club</label>
                            <input type="text" id="registerClubName" class="mt-1 w-full p-2 border rounded-md">
                        </div>
                        <div>
                            <label for="registerPhone" class="block text-sm font-medium">Téléphone</label>
                            <input type="tel" id="registerPhone" class="mt-1 w-full p-2 border rounded-md">
                        </div>
                        <div>
                            <label for="registerEmail" class="block text-sm font-medium">Email</label>
                            <input type="email" id="registerEmail" class="mt-1 w-full p-2 border rounded-md">
                        </div>
                        <div>
                            <label for="registerPassword" class="block text-sm font-medium">Mot de passe</label>
                            <input type="password" id="registerPassword" class="mt-1 w-full p-2 border rounded-md">
                        </div>
                        <div>
                            <label for="registerConfirmPassword" class="block text-sm font-medium">Confirmez le mot de passe</label>
                            <input type="password" id="registerConfirmPassword" class="mt-1 w-full p-2 border rounded-md">
                        </div>
                        <button id="registerBtn" class="w-full bg-green-600 text-white p-3 rounded-md hover:bg-green-700 transition">Créer mon compte</button>
                        <p class="text-sm text-center">
                            Déjà un compte ?
                            <a href="#" id="showLoginLink" class="font-medium text-blue-600 hover:underline">Se connecter</a>
                        </p>
                    </div>
                </div>

                <p id="authMessage" class="mt-4 text-sm text-center text-red-500"></p>
            </div>`;
        setupAuthPageLogic();
    }
	/**
     * Affiche la page de gestion du compte utilisateur.
     */
    async function renderAccountPage() {
        if (!window.userId) {
            window.location.hash = '#auth';
            return;
        }

        APP_CONTAINER.innerHTML = `<div class="text-center p-8"><p>Chargement des informations du compte...</p></div>`;

        try {
            const userDocRef = window.doc(window.db, "users", window.userId);
            const docSnap = await window.getDoc(userDocRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                APP_CONTAINER.innerHTML = `
                    <div class="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-xl">
                        <h2 class="text-3xl font-bold text-center mb-6">Mon Compte</h2>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Email (non modifiable)</label>
                                <input type="email" disabled class="mt-1 w-full p-2 border rounded-md bg-gray-100" value="${escapeHtml(userData.email || '')}">
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label for="accountFirstName" class="block text-sm font-medium">Prénom</label>
                                    <input type="text" id="accountFirstName" class="mt-1 w-full p-2 border rounded-md" value="${escapeHtml(userData.firstName || '')}">
                                </div>
                                <div>
                                    <label for="accountLastName" class="block text-sm font-medium">Nom</label>
                                    <input type="text" id="accountLastName" class="mt-1 w-full p-2 border rounded-md" value="${escapeHtml(userData.lastName || '')}">
                                </div>
                            </div>
                            <div>
                                <label for="accountClubName" class="block text-sm font-medium">Nom du club</label>
                                <input type="text" id="accountClubName" class="mt-1 w-full p-2 border rounded-md" value="${escapeHtml(userData.clubName || '')}">
                            </div>
                            <div>
                                <label for="accountPhone" class="block text-sm font-medium">Téléphone</label>
                                <input type="tel" id="accountPhone" class="mt-1 w-full p-2 border rounded-md" value="${escapeHtml(userData.phone || '')}">
                            </div>
                            <p id="accountMessage" class="text-sm text-center text-red-500"></p>
                            <div class="flex flex-col sm:flex-row gap-4 pt-4">
                                <button id="updateProfileBtn" class="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition">Enregistrer les modifications</button>
                                <button id="changePasswordBtn" class="w-full bg-gray-600 text-white p-3 rounded-md hover:bg-gray-700 transition">Changer le mot de passe</button>
                            </div>
                        </div>
                    </div>`;
                setupAccountPageLogic();
            } else {
                APP_CONTAINER.innerHTML = `<p class="text-red-500">Erreur: Impossible de trouver les informations de votre profil.</p>`;
            }
        } catch (error) {
            console.error("Erreur de chargement du profil:", error);
            APP_CONTAINER.innerHTML = `<p class="text-red-500">Une erreur est survenue lors du chargement de votre profil.</p>`;
        }
    }

    /**
     * Attache la logique aux éléments de la page "Mon Compte".
     */
    function setupAccountPageLogic() {
        document.getElementById('updateProfileBtn').addEventListener('click', async () => {
            const newData = {
                firstName: document.getElementById('accountFirstName').value.trim(),
                lastName: document.getElementById('accountLastName').value.trim(),
                clubName: document.getElementById('accountClubName').value.trim(),
                phone: document.getElementById('accountPhone').value.trim()
            };

            if (!newData.firstName || !newData.lastName || !newData.clubName) {
                showToast("Le nom, prénom et nom du club ne peuvent pas être vides.", "error");
                return;
            }

            try {
                const userDocRef = window.doc(window.db, "users", window.userId);
                await window.updateDoc(userDocRef, newData);
                showToast("Profil mis à jour avec succès !", "success");
            } catch (error) {
                showToast("Erreur lors de la mise à jour du profil.", "error");
                console.error("Erreur de mise à jour du profil:", error);
            }
        });

        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            const userEmail = window.auth.currentUser.email;

            const modalContent = document.createElement('div');
            modalContent.innerHTML = `
                <p class="text-gray-700 mb-4">Un e-mail pour changer votre mot de passe va être envoyé à : <span class="font-bold">${escapeHtml(userEmail)}</span>.</p>
                <p class="text-sm text-gray-500">N'hésitez pas à regarder vos courriers indésirables (spam) si vous ne voyez pas le mail dans votre boite de réception.</p>
            `;

            showModal('Changer le mot de passe', modalContent, async () => {
                try {
                    await window.sendPasswordResetEmail(window.auth, userEmail);
                    showToast("Email envoyé ! Veuillez consulter votre boîte de réception.", "success");
                } catch (error) {
                    showToast("Erreur : " + error.message, "error");
                }
            });
        });
    }

    /**
     * Logique de la page d'authentification.
     */
    function setupAuthPageLogic() {
        const loginContainer = document.getElementById('login-container');
        const registerContainer = document.getElementById('register-container');
        const showRegisterLink = document.getElementById('showRegisterLink');
        const showLoginLink = document.getElementById('showLoginLink');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        const authMessage = document.getElementById('authMessage');

        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (loginContainer) loginContainer.classList.add('hidden');
                if (registerContainer) registerContainer.classList.remove('hidden');
                if (authMessage) authMessage.textContent = '';
            });
        }

        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (registerContainer) registerContainer.classList.add('hidden');
                if (loginContainer) loginContainer.classList.remove('hidden');
                if (authMessage) authMessage.textContent = '';
            });
        }

        const loginBtn = document.getElementById('loginBtn');
			if (loginBtn) {
				loginBtn.addEventListener('click', async () => {
				const email = document.getElementById('authEmail').value.trim();
				const password = document.getElementById('authPassword').value.trim();
				if (!email || !password) {
				authMessage.textContent = "Veuillez entrer un email et un mot de passe.";
				return;
				}
				try {
				await window.signInWithEmailAndPassword(window.auth, email, password);
				showToast("Connexion réussie !", "success", 2000); // On affiche le toast plus brièvement

				// --- NOUVELLE LOGIQUE DE REDIRECTION ---

				// 1. On attend de récupérer la liste des tournois de l'utilisateur qui vient de se connecter.
				await fetchUserTournamentsList();

				// 2. On vérifie si l'utilisateur a des tournois.
				if (AppState.auth.allUserTournaments.length > 0) {
				// OUI, il a des tournois : on le renvoie à la page d'où il vient.
				const redirectPath = sessionStorage.getItem('loginRedirect');
				sessionStorage.removeItem('loginRedirect');
				window.location.hash = redirectPath || '#home'; // Redirige, avec '#home' comme sécurité.
				} else {
				// NON, il n'a pas de tournoi : on l'envoie sur la page de création/gestion de tournois.
				sessionStorage.removeItem('loginRedirect'); // On nettoie au cas où.
				window.location.hash = '#tournaments';
				}

			} catch (error) {
			authMessage.textContent = "Erreur de connexion : L'email ou le mot de passe est incorrect.";
			}
			});
		}

        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.addEventListener('click', async () => {
                const firstName = document.getElementById('registerFirstName').value.trim();
                const lastName = document.getElementById('registerLastName').value.trim();
                const clubName = document.getElementById('registerClubName').value.trim();
                const phone = document.getElementById('registerPhone').value.trim();
                const email = document.getElementById('registerEmail').value.trim();
                const password = document.getElementById('registerPassword').value.trim();
                const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();

                if (!firstName || !lastName || !clubName || !email || !password || !confirmPassword) {
                    authMessage.textContent = "Veuillez remplir tous les champs.";
                    return;
                }
                if (password.length < 6) {
                    authMessage.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
                    return;
                }
                if (password !== confirmPassword) {
                    authMessage.textContent = "Les mots de passe ne correspondent pas.";
                    return;
                }

                try {
                    const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, password);
                    const user = userCredential.user;

                    const userDocRef = window.doc(window.db, "users", user.uid);
                    const userData = {
                        firstName,
                        lastName,
                        clubName,
                        phone,
                        email: user.email,
                        createdAt: new Date()
                    };
                    await window.setDoc(userDocRef, userData);

                    showToast("Inscription réussie ! Vous êtes maintenant connecté.", "success");
                } catch (error) {
                    if (error.code === 'auth/email-already-in-use') {
                        authMessage.textContent = "Cette adresse e-mail est déjà utilisée.";
                    } else {
                        authMessage.textContent = "Erreur d'inscription: " + error.message;
                    }
                }
            });
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                const emailForReset = document.getElementById('authEmail').value.trim();

                if (!emailForReset) {
                    showToast("Veuillez d'abord entrer votre adresse e-mail dans le champ 'Email'.", "error");
                    return;
                }

                const modalContent = document.createElement('div');
                modalContent.innerHTML = `
                    <p class="text-gray-700 mb-4">Un e-mail pour réinitialiser votre mot de passe va être envoyé à : <span class="font-bold">${escapeHtml(emailForReset)}</span>.</p>
                    <p class="text-sm text-gray-500">N'hésitez pas à regarder vos courriers indésirables (SPAM) si vous ne voyez pas l'e-mail.</p>
                `;

                showModal('Confirmer la réinitialisation', modalContent, async () => {
                    try {
                        await window.sendPasswordResetEmail(window.auth, emailForReset);
                        showToast("Email de réinitialisation envoyé ! Veuillez consulter votre boîte de réception.", "success");
                    } catch (error) {
                        showToast("Erreur : " + error.message, "error");
                    }
                });
            });
        }
    }

    /**
     * Affiche la page d'accueil du tournoi.
     */
    function renderHomePage() {
    APP_CONTAINER.innerHTML = `
        <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <h1 class="text-4xl font-extrabold text-center text-blue-700 mb-8 leading-tight">
                Marre des casse-têtes<img src="Images/explosion.png" alt="emoji casse-tête" class="inline-block w-12 h-12 align-middle mx-1">pour organiser vos tournois ?<br>
                Cette App est là pour simplifier la vie des organisateurs de tournois !<img src="Images/content.png" alt="emoji casse-tête" class="inline-block w-15 h-12 align-middle mx-1">
            </h1>

            <p class="text-xl text-gray-700 text-center mb-12">
                Gagnez du temps, réduisez les erreurs et offrez une expérience fluide à vos participants.
                Concentrez-vous sur le jeu, on s'occupe du reste.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div class="bg-blue-50 p-6 rounded-lg shadow-md border border-blue-200">
                    <h2 class="text-2xl font-semibold text-blue-800 mb-3 flex items-center">
                        <i class="fas fa-users mr-3 text-blue-600"></i> Gestion Simplifiée
                    </h2>
                    <p class="text-blue-700">
                        Ajoutez, modifiez ou supprimez vos équipes et définissez leurs niveaux initiaux.
                        Importez facilement vos listes depuis un fichier Excel.
                    </p>
                </div>
                <div class="bg-green-50 p-6 rounded-lg shadow-md border border-green-200">
                    <h2 class="text-2xl font-semibold text-green-800 mb-3 flex items-center">
                        <i class="fas fa-sitemap mr-3 text-green-600"></i> Organisation des Phases
                    </h2>
                    <p class="text-green-700">
                        Créez et suivez vos phases de brassage et éliminatoires.
                        L'application vous guide à chaque étape, des poules aux matchs finaux.
                    </p>
                </div>
                <div class="bg-purple-50 p-6 rounded-lg shadow-md border border-purple-200">
                    <h2 class="text-2xl font-semibold text-purple-800 mb-3 flex-center">
                        <i class="fas fa-list-ol mr-3 text-purple-600"></i> Classements Automatiques
                    </h2>
                    <p class="text-purple-700">
                        Saisissez les scores et laissez l'application calculer les classements en temps réel.
                        Visualisez les performances des équipes tout au long du tournoi.
                    </p>
                </div>
                <div class="bg-yellow-50 p-6 rounded-lg shadow-md border border-yellow-200">
                    <h2 class="text-2xl font-semibold text-yellow-800 mb-3 flex items-center">
                        <i class="fas fa-tools mr-3 text-yellow-600"></i> Flexibilité des Brassages
                    </h2>
                    <p class="text-yellow-700">
                        Choisissez entre un brassage basé sur les niveaux initiaux des équipes,
                        ou sur les résultats cumulés des phases précédentes pour une progression équitable.
                    </p>
                </div>

                <div class="bg-orange-50 p-6 rounded-lg shadow-md border border-orange-200 md:col-span-2">
                    <h2 class="text-2xl font-semibold text-orange-800 mb-3 flex items-center">
                        <i class="fas fa-mobile-alt mr-3 text-orange-600"></i> Arbitrage Simplifié
                    </h2>
                    <p class="text-orange-700">
                        Générez des liens uniques pour chaque poule ou match éliminatoire et partagez-les. Les arbitres ou les équipes saisissent les scores en direct sur leur smartphone via une interface simple, vous libérant de cette tâche pour mieux vous concentrer sur l'organisation générale.
                    </p>
                </div>
                </div>

            <div class="bg-gray-100 p-6 rounded-lg shadow-inner border border-gray-300 text-gray-800 max-w-2xl mx-auto">
                <h3 class="text-xl font-bold mb-4 text-center">Comment ça Marche ? (Les Règles du Jeu)</h3>
                <ul class="list-disc list-inside space-y-2 mb-4">
                    <li>
                        <strong class="text-blue-700">Système de Points :</strong>
                        <ul class="list-disc list-inside ml-4 mt-1 text-sm">
                            <li>Équipe gagnante : <b>8 points.</b></li>
                            <li>Équipe perdante (écart de 1 à 3 pts) : <b>4 points.</b></li>
                            <li>Équipe perdante (écart de 4 à 6 pts) : <b>3 points.</b></li>
                            <li>Équipe perdante (écart de 7 à 9 pts) : <b>2 points.</b></li>
                            <li>Équipe perdante (écart de 10+ pts) : <b>1 point.</b></li>
                        </ul>
                        <p class="text-sm italic text-gray-600 mt-2 ml-4">
                            Ce système de points permet de faire un classement plus précis et surtout de <b>récompenser "les bons perdants"</b>, ceux qui se donnent à fond et ne baissent pas les bras même s'ils perdent.
                        </p>
                    </li>
                    <li>
                        <strong class="text-blue-700">Phases de Brassage :</strong> Tous les points et scores de tous les matchs joués dans les phases de brassage précédentes pourraient être <strong class="bg-gray-100">intégralement pris en compte</strong> pour la génération des poules des phases de brassage suivantes et pour le classement général.
                    </li>
                    <li>
                        <strong class="text-blue-700">Classement Éliminatoire :</strong> Le classement utilisé pour la phase éliminatoire est basé sur le <strong class="bg-gray-100">cumul de tous les points et scores</strong> des phases de brassage initiales et secondaires terminées, assurant une progression juste des meilleures équipes.
                    </li>
                </ul>
                <p class="text-sm text-center italic text-gray-600 mt-4">
                    Notre objectif est de rendre l'organisation transparente et efficace !
                </p>
            </div>
			<div class="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-xl border border-teal-200 mt-12 text-center">
                    <h2 class="text-3xl font-bold text-teal-700 mb-4">Un Tournoi à la Mêlée ?</h2>
                    <p class="text-lg text-gray-700 mb-6">
                        Envie d'un tournoi où les joueurs sont mélangés à chaque tour ?<br>
                        
                    </p>
                    <a href="#melee" class="inline-block bg-teal-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-teal-700 transition duration-300 ease-in-out shadow-lg">
                        <i class="fas fa-random mr-2"></i> C'est par ici ...
                    </a>
                </div>
			</div>     
                <p class="text-2xl text-center font-extrabold text-blue-700 mt-12">
                    Prêt(e) à révolutionner vos tournois ? Accroche-toi, l'aventure commence maintenant ! <img src="Images/voila.png" alt="emoji casse-tête" class="inline-block w-12 h-12 align-middle mx-1">
                </p>
            </div>
			
		`;
	}

    function renderEquipesPage() {
        let levelCounts = {};
        AppState.teamTournament.allTeams.forEach(team => {
            levelCounts[team.level] = (levelCounts[team.level] || 0) + 1;
        });

        let levelCountsHtml = '';
        if (Object.keys(levelCounts).length > 0) {
            levelCountsHtml += '<div class="mt-2 text-sm text-gray-600 space-y-1">';
            Object.keys(levelCounts).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
                const count = levelCounts[level];
                levelCountsHtml += `<p>Niveau ${escapeHtml(level)}: <span class="font-bold">${count}</span> équipe${count > 1 ? 's' : ''}</p>`;
            });
            levelCountsHtml += '</div>';
        } else {
            levelCountsHtml = '<p class="mt-2 text-sm text-gray-600">Aucun niveau d\'équipe défini.</p>';
        }

        const guestModeWarning = AppState.isGuestMode ? `
            <div class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
                <p class="font-semibold mb-2">Mode Invité Actif :</p>
                <p>Vous êtes en mode invité. Vous pouvez gérer jusqu'à ${GUEST_MODE_MAX_TEAMS} équipes. Les données sont sauvegardées localement dans votre navigateur.</p>
                <p class="mt-2">Pour des tournois plus importants et une sauvegarde sécurisée, veuillez vous <a href="#auth" class="text-blue-700 hover:underline">connecter ou créer un compte</a>.</p>
            </div>
        ` : '';

        APP_CONTAINER.innerHTML = `
            <h1 class="text-3xl font-bold text-center text-gray-800 mb-8">Gestion des Équipes</h1>

            ${guestModeWarning}

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">Ajouter une Nouvelle Équipe</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label for="teamName" class="block text-sm font-medium text-gray-700 mb-1">Nom de l'équipe</label>
                        <input type="text" id="teamName" placeholder="Nom de l'équipe"
                               class="w-96 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                    </div>
                    <div>
                        <label for="teamLevel" class="block text-sm font-medium text-gray-700 mb-1">Niveau (1-10)</label>
                        <input type="number" id="teamLevel" min="1" max="10" value="5"
                               class="w-96 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                    </div>
                    <div class="md:col-span-2">
                        <button id="addTeamBtn"
                                class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                            Ajouter l'équipe
                        </button>
                    </div>
                </div>
                <p id="message" class="mt-3 text-sm text-center"></p>
            </section>

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">Importer des Équipes depuis Excel</h2>
                <div class="flex flex-col sm:flex-row items-center gap-4">
                    <input type="file" id="excelFileInput" accept=".xlsx, .xls" class="block w-full text-sm text-gray-700
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100" />
                    <button id="importTeamsBtn"
                            class="w-full sm:w-auto bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                        Importer les équipes
                    </button>
                </div>
                <p class="text-xs text-gray-600 mt-2">
                    - Le fichier Excel doit contenir deux colonnes : "Nom" (pour le nom de l'équipe) et "Niveau" (pour le niveau de l'équipe, de 1 à 10).
                </p>
				<p class="text-xs text-gray-600 mt-2">
                    - Selon le nombre d'équipes que vous souhaitez mettre dans chaque poule des brassages, ajustez les niveaux des équipes dans le fichier Excel: Pour N équipes par poule, attribuez des niveaux de 1 à N, en veillant à avoir le même nombre d'équipes de chaque niveau.
                </p>
                <p id="importMessage" class="mt-3 text-sm text-center"></p>
            </section>

            <section class="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">
                    Équipes Actuelles (<span id="teamCountDisplay">0</span>)
                </h2>
                ${levelCountsHtml} <div id="teamsList" class="space-y-4">
                    </div>
                <div class="mt-6 text-center">
                    <button id="clearTeamsBtn"
                            class="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                        Effacer toutes les équipes
                    </button>
                </div>
            </section>
        `;
        setupEquipesPageLogic();
    }

    function setupEquipesPageLogic() {
        const teamNameInput = document.getElementById('teamName');
        const teamLevelInput = document.getElementById('teamLevel');
        const addTeamBtn = document.getElementById('addTeamBtn');
        const teamsListDiv = document.getElementById('teamsList');
        const clearTeamsBtn = document.getElementById('clearTeamsBtn');
        const excelFileInput = document.getElementById('excelFileInput');
        const importTeamsBtn = document.getElementById('importTeamsBtn');
        const teamCountDisplay = document.getElementById('teamCountDisplay');

        function renderTeams() {
            teamsListDiv.innerHTML = '';
            teamCountDisplay.textContent = AppState.teamTournament.allTeams.length.toString();

            let levelCounts = {};
            AppState.teamTournament.allTeams.forEach(team => {
                levelCounts[team.level] = (levelCounts[team.level] || 0) + 1;
            });

            let levelCountsHtml = '';
            if (Object.keys(levelCounts).length > 0) {
                levelCountsHtml += '<div class="mt-2 text-sm text-gray-600 space-y-1">';
                Object.keys(levelCounts).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
                    const count = levelCounts[level];
                    levelCountsHtml += `<p>Niveau ${escapeHtml(level)}: <span class="font-bold">${count}</span> équipe${count > 1 ? 's' : ''}</p>`;
                });
                levelCountsHtml += '</div>';
            } else {
                levelCountsHtml = '<p class="mt-2 text-sm text-gray-600">Aucun niveau d\'équipe défini.</p>';
            }

            const existingLevelCountsDiv = document.querySelector('section.p-6.bg-gray-50.rounded-lg.border.border-gray-200 div.mt-2.text-sm.text-gray-600.space-y-1');
            if (existingLevelCountsDiv) {
                 existingLevelCountsDiv.outerHTML = levelCountsHtml;
            } else {
                const section = document.querySelector('section.p-6.bg-gray-50.rounded-lg.border.border-gray-200');
                const h2 = section.querySelector('h2');
                h2.insertAdjacentHTML('afterend', levelCountsHtml);
            }

            if (AppState.teamTournament.allTeams.length === 0) {
                teamsListDiv.innerHTML = '<p class="text-gray-500 text-center">Aucune équipe n\'a été ajoutée pour le moment.</p>';
                return;
            }

            AppState.teamTournament.allTeams.forEach(team => {
                const teamDiv = document.createElement('div');
                teamDiv.className = 'flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md shadow-sm';
                teamDiv.innerHTML = `
                    <span class="text-gray-800 font-medium flex-grow">${escapeHtml(team.name)} (Niveau: ${escapeHtml(team.level.toString())})</span>
                    <div class="flex space-x-2 ml-4">
                        <button data-id="${team.id}" class="edit-team-btn bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 text-sm transition duration-150">Éditer</button>
                        <button data-id="${team.id}" class="delete-team-btn bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 text-sm transition duration-150">Supprimer</button>
                    </div>
                `;
                teamsListDiv.appendChild(teamDiv);
            });

            document.querySelectorAll('.edit-team-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const teamId = event.target.dataset.id;
                    const teamToEdit = AppState.teamTournament.allTeams.find(t => t.id === teamId);
                    if (teamToEdit) {
                        const formDiv = document.createElement('div');
                        formDiv.innerHTML = `
                            <div class="mb-4">
                                <label for="editTeamName" class="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                                <input type="text" id="editTeamName" class="w-full p-2 border border-gray-300 rounded-md" value="${escapeHtml(teamToEdit.name)}">
                            </div>
                            <div>
                                <label for="editTeamLevel" class="block text-sm font-medium text-gray-700 mb-1">Niveau (1-10)</label>
                                <input type="number" id="editTeamLevel" class="w-full p-2 border border-gray-300 rounded-md" min="1" max="10" value="${escapeHtml(teamToEdit.level.toString())}">
                            </div>
                        `;
                        showModal('Éditer l\'équipe', formDiv, () => {
                            const newName = document.getElementById('editTeamName').value.trim();
                            const newLevel = parseInt(document.getElementById('editTeamLevel').value);

                            if (!newName) {
                                showToast("Le nom de l'équipe ne peut pas être vide.", "error");
                                return;
                            }
                            if (teamExists(newName) && newName.toLowerCase() !== teamToEdit.name.toLowerCase()) {
                                showToast(`Une équipe nommée "${escapeHtml(newName)}" existe déjà.`, "error");
                                return;
                            }
                            if (isNaN(newLevel) || newLevel < 1 || newLevel > 10) {
                                showToast("Le niveau doit être un nombre entre 1 et 10.", "error");
                                return;
                            }

                            teamToEdit.name = newName;
                            teamToEdit.level = newLevel;
                            saveAllData();
                            showToast(`Équipe "${escapeHtml(newName)}" mise à jour.`, "success");
                        });
                    }
                });
            });

            document.querySelectorAll('.delete-team-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const teamId = event.target.dataset.id;
                    deleteTeam(teamId);
                });
            });
        }

        addTeamBtn.addEventListener('click', () => {
            const name = teamNameInput.value.trim();
            const level = parseInt(teamLevelInput.value);
            addTeam(name, level);
            teamNameInput.value = '';
            teamLevelInput.value = '5';
        });

        clearTeamsBtn.addEventListener('click', () => {
            const messageContent = document.createElement('p');
            messageContent.textContent = "Êtes-vous sûr de vouloir supprimer TOUTES les équipes ? Cette action est irréversible.";
            messageContent.className = 'text-gray-700';

            showModal('Confirmer la suppression de toutes les équipes', messageContent, () => {
                AppState.teamTournament.allTeams = [];
                AppState.teamTournament.eliminatedTeams.clear();
                saveAllData();
                showToast("Toutes les équipes ont été supprimées.", "success");
            }, true);
        });

		importTeamsBtn.addEventListener('click', () => {
            const file = excelFileInput.files[0];
            if (!file) {
                showToast("Veuillez sélectionner un fichier Excel.", "error");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                const limit = AppState.isGuestMode ? GUEST_MODE_MAX_TEAMS : (AppState.teamTournament.currentData ? AppState.teamTournament.currentData.numTeamsAllowed : 0);
                const currentTeamCount = AppState.teamTournament.allTeams.length;
                if (currentTeamCount + json.length > limit) {
                    showToast(`L'import de ${json.length} équipes dépasserait la limite de ${limit} équipes pour ce tournoi.`, "error");
                    if (AppState.isGuestMode) showLoginRequiredModal();
                    return;
                }

                let importedCount = 0;
                let failedCount = 0;
                let newTeams = [];
                let skippedNames = [];

                json.forEach(row => {
                    const name = row['Nom'];
                    const level = parseInt(row['Niveau']);

                    if (name && !isNaN(level) && level >= 1 && level <= 10) {
                        if (teamExists(name)) {
                            skippedNames.push(name);
                            failedCount++;
                        } else {
                            newTeams.push({
                                id: 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
                                name: name,
                                level: level
                            });
                            importedCount++;
                        }
                    } else {
                        failedCount++;
                    }
                });

                if (importedCount > 0) {
                    AppState.teamTournament.allTeams.push(...newTeams);
                    saveAllData();
                    let successMsg = `${importedCount} équipe(s) importée(s) avec succès.`;
                    if (failedCount > 0) {
                        successMsg += ` ${failedCount} ligne(s) ignorée(s).`;
                    }
                    showToast(successMsg, "success");
                } else {
                    showToast("Aucune nouvelle équipe valide trouvée dans le fichier.", "error");
                }
                excelFileInput.value = '';
            };
            reader.readAsArrayBuffer(file);
        });
        renderTeams();
    }

    // --- Fonctions de Logique de Brassage (à ajouter) ---

    function updatePoolGenerationBasisUI() {
        const basisHelpText = document.getElementById('basisHelpText');
        const numberOfGlobalPhasesInput = document.getElementById('numberOfGlobalPhases');
        const labelInitial = document.querySelector("label[for='basisInitialLevels']");
        const labelPrevious = document.querySelector("label[for='basisPreviousResults']");

        if (!basisHelpText || !numberOfGlobalPhasesInput || !labelInitial || !labelPrevious) return;

        numberOfGlobalPhasesInput.disabled = false;
        numberOfGlobalPhasesInput.type = 'number';
        numberOfGlobalPhasesInput.classList.remove('bg-gray-200', 'cursor-not-allowed', 'text-sm', 'text-gray-500');

        if (AppState.teamTournament.poolGenerationBasis === 'initialLevels') {
            document.getElementById('basisInitialLevels').checked = true;
            document.getElementById('basisPreviousResults').checked = false;
            labelInitial.classList.add('font-bold');
            labelPrevious.classList.remove('font-bold');
            numberOfGlobalPhasesInput.value = 1;
            basisHelpText.textContent = "Crée des phases en utilisant les niveaux initiaux des équipes. Vous pouvez créer plusieurs phases si nécessaire.";
        } else { // 'previousResults'
            document.getElementById('basisInitialLevels').checked = false;
            document.getElementById('basisPreviousResults').checked = true;
            labelInitial.classList.remove('font-bold');
            labelPrevious.classList.add('font-bold');
            numberOfGlobalPhasesInput.value = 1;
            basisHelpText.innerHTML = "Crée une phase en utilisant les résultats cumulés des brassages précédents.<br>Les phases suivantes ne peuvent pas être générées si les phases précédentes ne sont pas encore terminées.";
        }
    }

    function _performSecondaryGroupsPreview() {
        const numberOfSecondaryGroupsInput = document.getElementById('numberOfSecondaryGroups');
        const numGroups = parseInt(numberOfSecondaryGroupsInput.value);

        if (isNaN(numGroups) || (numGroups !== 2 && numGroups !== 3)) {
            showToast("Veuillez choisir 2 ou 3 groupes.", "error");
            return;
        }

        const globalRankings = getGlobalRankings(AppState.teamTournament.allTeams, AppState.teamTournament.allBrassagePhases);
        if (globalRankings.length === 0) {
            showToast("Aucune équipe classée disponible pour créer les groupes.", "error");
            return;
        }

        AppState.teamTournament.currentSecondaryGroupsPreview = {};
        const groupNamesMap = { 2: ["Principale", "Consolante"], 3: ["Principale", "Consolante", "Super Consolante"] };
        const selectedGroupNames = groupNamesMap[numGroups];
        const teamsToDistribute = [...globalRankings];
        const totalTeams = teamsToDistribute.length;
        const baseGroupSize = Math.floor(totalTeams / numGroups);
        let remainder = totalTeams % numGroups;
        let currentTeamIndex = 0;

        for (let i = 0; i < numGroups; i++) {
            const groupName = selectedGroupNames[i];
            AppState.teamTournament.currentSecondaryGroupsPreview[groupName] = [];
            const currentSize = baseGroupSize + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder--;

            for (let j = 0; j < currentSize; j++) {
                if (teamsToDistribute[currentTeamIndex]) {
                    const teamForPreview = {
                        ...teamsToDistribute[currentTeamIndex].teamObject,
                        totalPoints: teamsToDistribute[currentTeamIndex].totalPoints,
                        totalDiffScore: teamsToDistribute[currentTeamIndex].totalDiffScore,
                        previewGroup: groupName
                    };
                    AppState.teamTournament.currentSecondaryGroupsPreview[groupName].push(teamForPreview);
                }
                currentTeamIndex++;
            }
        }

        saveAllData();
        renderSecondaryGroupsPreview(selectedGroupNames);
        showToast(`Prévisualisation des ${numGroups} groupes créée.`, "success");
    }

    function previewSecondaryGroupsWithWarning() {
        if (Object.keys(AppState.teamTournament.currentSecondaryGroupsPreview).length > 0) {
            const p = document.createElement('p');
            p.textContent = 'Recréer les groupes écrasera la configuration actuelle. Continuer ?';
            showModal('Confirmer la re-création', p, _performSecondaryGroupsPreview, true);
        } else {
            _performSecondaryGroupsPreview();
        }
    }

    function updateSecondaryGroupsPreviewDisplayOnly() {
        if (Object.keys(AppState.teamTournament.currentSecondaryGroupsPreview).length === 0) {
            showToast("Aucun groupe à actualiser.", "info");
            return;
        }
        const latestGlobalRankings = getGlobalRankings(AppState.teamTournament.allTeams, AppState.teamTournament.allBrassagePhases);
        const rankingsMap = new Map(latestGlobalRankings.map(r => [r.teamObject.id, r]));

        Object.values(AppState.teamTournament.currentSecondaryGroupsPreview).forEach(group => {
            group.forEach(teamInPreview => {
                const latestRank = rankingsMap.get(teamInPreview.id);
                if (latestRank) {
                    teamInPreview.totalPoints = latestRank.totalPoints;
                    teamInPreview.totalDiffScore = latestRank.totalDiffScore;
                }
            });
            group.sort((a, b) => b.totalPoints - a.totalPoints || b.totalDiffScore - a.totalDiffScore);
        });

        saveAllData();
        const numGroups = Object.keys(AppState.teamTournament.currentSecondaryGroupsPreview).length;
        const groupNamesMap = { 2: ["Principale", "Consolante"], 3: ["Principale", "Consolante", "Super Consolante"] };
        renderSecondaryGroupsPreview(groupNamesMap[numGroups]);
        showToast("Scores des groupes mis à jour.", "success");
    }

    function isBrassagePhaseComplete(phase) {
        if (!phase || !phase.generated || !phase.pools) return false;
        for (const pool of phase.pools) {
            if (!pool.matches) return false;
            for (const match of pool.matches) {
                if (match.score1 === null || match.score2 === null || isNaN(match.score1) || isNaN(match.score2) || !match.winnerId) {
                    return false;
                }
            }
        }
        return true;
    }

	// --- Fonctions de Gestion des Groupes Secondaires ---

    function renderSecondaryGroupsPreview(groupNames) {
        const secondaryGroupsPreviewDisplay = document.getElementById('secondaryGroupsPreviewDisplay');
        const validateSecondaryGroupsBtn = document.getElementById('validateSecondaryGroupsBtn');
        const generateSecondaryBrassagesBtn = document.getElementById('generateSecondaryBrassagesBtn');
        const refreshSecondaryGroupScoresBtn = document.getElementById('refreshSecondaryGroupScoresBtn');

        secondaryGroupsPreviewDisplay.innerHTML = '';

        if (Object.keys(AppState.teamTournament.currentSecondaryGroupsPreview).length === 0) {
            secondaryGroupsPreviewDisplay.innerHTML = '<p class="text-gray-500 text-center w-full md:col-span-2 lg:col-span-3">Créez les groupes ici après avoir cliqué sur "Créer les groupes".</p>';
            validateSecondaryGroupsBtn.classList.add('hidden');
            generateSecondaryBrassagesBtn.classList.add('hidden');
            refreshSecondaryGroupScoresBtn.classList.add('hidden');
            return;
        }

        validateSecondaryGroupsBtn.classList.remove('hidden');
        generateSecondaryBrassagesBtn.classList.remove('hidden');
        refreshSecondaryGroupScoresBtn.classList.remove('hidden');

        groupNames.forEach(groupName => {
            const teamsInGroup = AppState.teamTournament.currentSecondaryGroupsPreview[groupName] || [];
            const groupDiv = document.createElement('div');
            groupDiv.className = 'bg-white p-4 rounded-lg shadow-md border border-gray-200';
            groupDiv.innerHTML = `<h3 class="text-xl font-semibold text-gray-800 mb-3">${escapeHtml(groupName)} (${teamsInGroup.length} équipes)</h3><ul class="space-y-2"></ul>`;
            const teamList = groupDiv.querySelector('ul');

            teamsInGroup.forEach(team => {
                const listItem = document.createElement('li');
                const isEliminated = AppState.teamTournament.eliminatedTeams.has(team.id);
                listItem.className = `draggable-team block w-full text-left py-2 px-3 rounded-md font-medium hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${isEliminated ? 'bg-red-50 text-red-800' : 'bg-blue-100 text-blue-800'}`;

                listItem.innerHTML = `<span class="${isEliminated ? 'line-through' : ''}">${escapeHtml(team.name)} (Pts: ${team.totalPoints}, Diff: ${team.totalDiffScore})</span>${isEliminated ? '<span class="ml-2 text-red-500 text-sm">(Éliminée)</span>' : ''}`;

                listItem.addEventListener('click', () => {
                    showTeamOptionsModal(team.id, team.name, team.totalPoints, team.totalDiffScore, groupName, groupNames);
                });
                teamList.appendChild(listItem);
            });
            secondaryGroupsPreviewDisplay.appendChild(groupDiv);
        });
    }

    function showTeamOptionsModal(teamId, teamName, totalPoints, totalDiffScore, currentGroup, allGroupNames) {
        const isCurrentlyEliminated = AppState.teamTournament.eliminatedTeams.has(teamId);
        const teamStatusText = isCurrentlyEliminated ? 'Actuellement **Éliminée**' : 'Actuellement **En Jeu**';
        const toggleEliminationAction = isCurrentlyEliminated ? 'Remettre en jeu' : 'Éliminer';
        const toggleEliminationColor = isCurrentlyEliminated ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

        const modalContentDiv = document.createElement('div');
        modalContentDiv.className = 'space-y-4 text-gray-700';
        modalContentDiv.innerHTML = `
            <p class="text-md">Options pour <span class="font-bold">${escapeHtml(teamName)}</span> (Pts: ${totalPoints}, Diff: ${totalDiffScore})</p>
            <p class="text-sm font-semibold">${teamStatusText}</p>
            <div class="flex flex-col space-y-2 mt-4">
                <button id="moveTeamOptionBtn" class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Déplacer l'équipe</button>
                <button id="toggleEliminationOptionBtn" class="${toggleEliminationColor} text-white py-2 px-4 rounded-md">${toggleEliminationAction}</button>
            </div>`;

        showModal(`Gérer l'équipe : ${escapeHtml(teamName)}`, modalContentDiv, () => hideModal());

        modalContentDiv.querySelector('#moveTeamOptionBtn').addEventListener('click', () => {
            hideModal();
            showMoveTeamModal(teamId, teamName, currentGroup, totalPoints, totalDiffScore, allGroupNames);
        });

        modalContentDiv.querySelector('#toggleEliminationOptionBtn').addEventListener('click', () => {
            if (AppState.teamTournament.eliminatedTeams.has(teamId)) {
                AppState.teamTournament.eliminatedTeams.delete(teamId);
                showToast(`${escapeHtml(teamName)} a été remise en jeu.`, "info");
            } else {
                AppState.teamTournament.eliminatedTeams.add(teamId);
                showToast(`${escapeHtml(teamName)} a été éliminée.`, "info");
            }
            saveAllData();
            hideModal();
        });
    }

    function showMoveTeamModal(teamId, teamName, currentGroup, totalPoints, totalDiffScore, allGroupNames) {
        const formDiv = document.createElement('div');
        formDiv.innerHTML = `
            <p class="text-gray-700">Déplacer l'équipe <span class="font-bold">${escapeHtml(teamName)}</span> vers :</p>
            <select id="moveTeamGroupSelect" class="w-full mt-2 p-2 border border-gray-300 rounded-md"></select>`;

        const groupSelect = formDiv.querySelector('#moveTeamGroupSelect');
        allGroupNames.forEach(groupName => {
            const option = document.createElement('option');
            option.value = groupName;
            option.textContent = groupName;
            if (groupName === currentGroup) option.selected = true;
            groupSelect.appendChild(option);
        });

        showModal('Déplacer l\'équipe', formDiv, () => {
            const newGroup = groupSelect.value;
            if (newGroup !== currentGroup) {
                moveTeamBetweenSecondaryGroups(teamId, currentGroup, newGroup);
            }
        });
    }

    function moveTeamBetweenSecondaryGroups(teamId, fromGroup, toGroup) {
        let teamToMove = null;
        const fromGroupArray = AppState.teamTournament.currentSecondaryGroupsPreview[fromGroup];
        const teamIndex = fromGroupArray.findIndex(team => team.id === teamId);

        if (teamIndex > -1) {
            teamToMove = fromGroupArray.splice(teamIndex, 1)[0];
        }

        if (teamToMove) {
            teamToMove.previewGroup = toGroup;
            if (!AppState.teamTournament.currentSecondaryGroupsPreview[toGroup]) {
                AppState.teamTournament.currentSecondaryGroupsPreview[toGroup] = [];
            }
            AppState.teamTournament.currentSecondaryGroupsPreview[toGroup].push(teamToMove);
            AppState.teamTournament.currentSecondaryGroupsPreview[toGroup].sort((a, b) => b.totalPoints - a.totalPoints || b.totalDiffScore - a.totalDiffScore);

            saveAllData();
            showToast(`Équipe ${escapeHtml(teamToMove.name)} déplacée vers ${escapeHtml(toGroup)}.`, "success");
        }
    }

    function deletePhaseById(phaseIdToDelete) {
        const phaseName = AppState.teamTournament.allBrassagePhases.find(p => p.id === phaseIdToDelete)?.name || "inconnue";
        AppState.teamTournament.allBrassagePhases = AppState.teamTournament.allBrassagePhases.filter(phase => phase.id !== phaseIdToDelete);

        saveAllData();
        renderPhaseHistory();

        if (AppState.teamTournament.currentDisplayedPhaseId === phaseIdToDelete) {
            const poolsDisplay = document.getElementById('poolsDisplay');
            const currentPhaseTitle = document.getElementById('currentPhaseTitle');
            if(poolsDisplay && currentPhaseTitle) {
                poolsDisplay.innerHTML = '<p class="text-gray-500 text-center md:col-span-2">Les poules de la phase sélectionnée s\'afficheront ici.</p>';
                currentPhaseTitle.textContent = 'Poules de la Phase Actuelle';
                AppState.teamTournament.currentDisplayedPhaseId = null;
            }
        }
        showToast(`La phase "${escapeHtml(phaseName)}" a été supprimée.`, "success");
    }

function renderPools(pools, phaseName = "Poules Actuelles", phaseId = null, showRepeats = false) {
    const poolsDisplay = document.getElementById('poolsDisplay');
    const currentPhaseTitle = document.getElementById('currentPhaseTitle');
    const scoreCounter = document.getElementById('scoreCounter');
    if (!poolsDisplay || !currentPhaseTitle || !scoreCounter) return;

    let totalMatches = 0;
    let completedMatches = 0;
    if (pools && Array.isArray(pools)) {
        pools.forEach(pool => {
            if (pool.matches && Array.isArray(pool.matches)) {
                totalMatches += pool.matches.length;
                pool.matches.forEach(match => {
                    if (match.score1 !== null && match.score2 !== null && !isNaN(match.score1) && !isNaN(match.score2)) {
                        completedMatches++;
                    }
                });
            }
        });
    }

    currentPhaseTitle.textContent = 'Poules de ' + phaseName;

    if (totalMatches > 0) {
        scoreCounter.textContent = `Scores saisis : ${completedMatches} / ${totalMatches}`;
    } else {
        scoreCounter.textContent = '';
    }

    AppState.teamTournament.currentDisplayedPhaseId = phaseId;
    poolsDisplay.innerHTML = '';

    if (!pools || pools.length === 0) {
        poolsDisplay.innerHTML = '<p class="text-gray-500 text-center md:col-span-2">Aucune poule générée pour cette phase.</p>';
        return;
    }

    pools.forEach(pool => {
        const poolCard = document.createElement('div');
        poolCard.className = 'bg-white p-4 rounded-lg shadow-md border border-gray-200';
        
        let teamsListHtml = pool.teams.map(team => {
             const teamDetail = team.totalPoints !== undefined ? `Pts: ${team.totalPoints}, Diff: ${team.totalDiffScore}` : `Niveau ${team.level}`;
             return `<li>${escapeHtml(team.name)} (${teamDetail})</li>`;
        }).join('');

        let matchesHtml = '';
        if (pool.matches && pool.matches.length > 0) {
            matchesHtml = pool.matches.map((match, matchIndex) => {
                let team1Class = 'text-gray-700';
                let team2Class = 'text-gray-700';
                if (match.winnerId === match.team1Id) {
                    team1Class = 'font-bold text-green-700';
                    team2Class = 'text-red-700';
                } else if (match.winnerId === match.team2Id) {
                    team2Class = 'font-bold text-green-700';
                    team1Class = 'text-red-700';
                }
                const isRepeat = isMatchRepeated(match.team1Id, match.team2Id, phaseId);
                const repeatIndicatorHtml = isRepeat ? `<button class="repeated-match-indicator-btn text-red-500 font-bold ml-2 text-sm focus:outline-none ${showRepeats ? '' : 'hidden'}" data-team1-id="${match.team1Id}" data-team2-id="${match.team2Id}" data-team1-name="${escapeHtml(match.team1Name)}" data-team2-name="${escapeHtml(match.team2Name)}">(Répété)</button>` : '';
                return `
                    <div class="flex flex-col sm:flex-row items-center justify-between p-2 border-b border-gray-200 last:border-b-0 space-y-2 sm:space-y-0 sm:space-x-2">
                        <span data-team-role="team1-name" class="${team1Class} w-full sm:w-auto text-center sm:text-left">${escapeHtml(match.team1Name)}</span>
                        <div class="flex items-center space-x-1">
                            <select data-pool-id="${pool.id}" data-match-index="${matchIndex}" data-team="1" class="score-select w-20 p-1 border border-gray-300 rounded-md text-center text-sm">${generateScoreOptions(40, match.score1)}</select>
                            <span class="text-gray-600">-</span>
                            <select data-pool-id="${pool.id}" data-match-index="${matchIndex}" data-team="2" class="score-select w-20 p-1 border border-gray-300 rounded-md text-center text-sm">${generateScoreOptions(40, match.score2)}</select>
                        </div>
                        <span data-team-role="team2-name" class="${team2Class} w-full sm:w-auto text-center sm:text-right">${escapeHtml(match.team2Name)}</span>
                        ${repeatIndicatorHtml}
                    </div>`;
            }).join('');
        } else {
            matchesHtml = '<p class="text-gray-500 text-sm mt-2">Aucune rencontre générée pour cette poule.</p>';
        }

        const arbitreLink = `${window.location.origin}${window.location.pathname}arbitre.html?tournoi=${AppState.auth.activeTeamTournamentId}&phase=${phaseId}&poule=${pool.id}`;

        poolCard.innerHTML = `
            <div class="flex justify-between items-start">
                 <h3 class="text-xl font-semibold text-gray-800 mb-3">${escapeHtml(pool.name)}</h3>
                 <button class="arbitre-link-btn text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300" data-link="${arbitreLink}">
                     <i class="fas fa-link mr-1"></i> Lien Arbitre
                 </button>
            </div>
            <div class="mb-4"><h4 class="font-semibold text-gray-700 mb-2">Équipes:</h4><ul class="list-disc list-inside space-y-1 text-gray-700">${teamsListHtml}</ul></div>
            <div class="mt-4 border-t border-gray-200 pt-4"><h4 class="font-semibold text-gray-700 mb-2">Rencontres:</h4>${matchesHtml}</div>
        `;
        poolsDisplay.appendChild(poolCard);
    });

    poolsDisplay.querySelectorAll('.arbitre-link-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const link = event.currentTarget.dataset.link;
            navigator.clipboard.writeText(link).then(() => {
                showToast('Lien copié dans le presse-papiers !');
            }, () => {
                showToast('Erreur lors de la copie du lien.', 'error');
            });
            
            const messageContent = document.createElement('div');
            messageContent.innerHTML = `<p class="text-gray-700">Partagez ce lien avec l'arbitre de la poule :</p><input type="text" readonly class="w-full p-2 mt-2 bg-gray-100 border rounded" value="${link}">`;
            
            showModal('Lien de Saisie pour l\'Arbitre', messageContent, () => {}, false, false);
            document.getElementById('modalConfirmBtn').textContent = 'OK';
        });
    });

    poolsDisplay.querySelectorAll('.score-select').forEach(select => {
        select.addEventListener('change', (event) => {
            const poolId = event.target.dataset.poolId;
            const matchIndex = parseInt(event.target.dataset.matchIndex);
            const scoreSelects = event.target.closest('.flex.items-center.space-x-1').parentElement.querySelectorAll('.score-select');
            let score1 = parseInt(scoreSelects[0].value);
            let score2 = parseInt(scoreSelects[1].value);
            if (isNaN(score1)) score1 = null;
            if (isNaN(score2)) score2 = null;

            const phase = AppState.teamTournament.allBrassagePhases.find(p => p.id === AppState.teamTournament.currentDisplayedPhaseId);
            if (phase) {
                const pool = phase.pools.find(p => p.id === poolId);
                const match = pool.matches[matchIndex];
                match.score1 = score1;
                match.score2 = score2;
                match.winnerId = null;
                if (score1 !== null && score2 !== null) {
                    if (score1 > score2) match.winnerId = match.team1Id;
                    else if (score2 > score1) match.winnerId = match.team2Id;
                }

                saveAllData();
                renderPools(phase.pools, phase.name, phase.id, document.getElementById('toggleRepeatedMatchesDisplay').checked);
            }
        });
    });

    poolsDisplay.querySelectorAll('.repeated-match-indicator-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const { team1Id, team2Id, team1Name, team2Name } = event.currentTarget.dataset;
            showRepeatedMatchDetailsModal(team1Name, team2Name, team1Id, team2Id, AppState.teamTournament.currentDisplayedPhaseId);
        });
    });
}
	
	function renderPhaseHistory() {
        const phaseHistoryDisplay = document.getElementById('phaseHistoryDisplay');
        if (!phaseHistoryDisplay) return;

        phaseHistoryDisplay.innerHTML = '';
        const brassagePhasesForHistory = AppState.teamTournament.allBrassagePhases.filter(p => p.type !== PHASE_TYPE_ELIMINATION_SEEDING).sort((a, b) => a.timestamp - b.timestamp);
        const toggleRepeatedMatchesDisplay = document.getElementById('toggleRepeatedMatchesDisplay');

        if (brassagePhasesForHistory.length === 0) {
            phaseHistoryDisplay.innerHTML = '<p class="text-gray-500 text-center w-full">Aucune phase de brassage générée pour le moment.</p>';
        } else {
            brassagePhasesForHistory.forEach(phase => {
                const phaseEntry = document.createElement('div');
                phaseEntry.className = 'flex items-center space-x-2 w-full bg-gray-100 rounded-lg p-2 mb-2 shadow-sm';

                const phaseButton = document.createElement('button');
                phaseButton.textContent = phase.name;
                phaseButton.className = 'flex-grow bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 text-sm text-left';
                phaseButton.onclick = () => renderPools(phase.pools, phase.name, phase.id, toggleRepeatedMatchesDisplay.checked);

                const actionButton = document.createElement('button');
                if (phase.generated) {
                    actionButton.textContent = 'Afficher';
                    actionButton.className = 'bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm';
                    actionButton.onclick = () => renderPools(phase.pools, phase.name, phase.id, toggleRepeatedMatchesDisplay.checked);
                } else {
                    actionButton.textContent = 'Générer';
                    actionButton.className = 'bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm';
                    actionButton.onclick = () => generatePoolsForPhase(phase.id);
                }

                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '&times;';
                deleteButton.className = 'bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-md text-xl hover:bg-red-600';
                deleteButton.onclick = () => {
                    const p = document.createElement('p');
                    p.textContent = `Êtes-vous sûr de vouloir supprimer la phase "${escapeHtml(phase.name)}" ?`;
                    showModal('Confirmer la suppression', p, () => deletePhaseById(phase.id), true);
                };

                phaseEntry.append(phaseButton, actionButton, deleteButton);
                phaseHistoryDisplay.appendChild(phaseEntry);
            });
        }
        updateRepeatedMatchesCountDisplay();
    }

    function renderBrassagesPage() {
        APP_CONTAINER.innerHTML = `
            <h1 class="text-3xl font-bold text-center text-gray-800 mb-8">Génération des Poules de Brassage</h1>

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">1. Choisir la Méthode de Génération des Poules</h2>
                <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <div class="flex items-center">
                        <input type="radio" id="basisInitialLevels" name="poolGenerationBasis" value="initialLevels" class="form-radio h-4 w-4 text-blue-600">
                        <label for="basisInitialLevels" class="ml-2 text-gray-700">Base sur les niveaux initiaux des équipes</label>
                    </div>
                    <div class="flex items-center">
                        <input type="radio" id="basisPreviousResults" name="poolGenerationBasis" value="previousResults" class="form-radio h-4 w-4 text-blue-600">
                        <label for="basisPreviousResults" class="ml-2 text-gray-700">Base sur les résultats cumulés des brassages précédents</label>
                    </div>
                </div>
                <p class="text-sm text-gray-600 mt-3" id="basisHelpText">
                    Choisissez how les équipes seront réparties dans les poules.
                </p>
                <p id="basisMessage" class="mt-3 text-sm text-center"></p>
            </section>

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">2. Créer de Nouvelles Phases de Brassage</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label for="teamsPerPool" class="block text-sm font-medium text-gray-700 mb-1">Nombre d'équipes par poule</label>
                        <input type="number" id="teamsPerPool" min="1" value="3" max="10"
                               class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                    </div>
                    <div>
                        <label for="numberOfGlobalPhases" class="block text-sm font-medium text-gray-700 mb-1">Nombre de phases de brassage initial à créer</label>
                        <input type="number" id="numberOfGlobalPhases" min="1" value="1"
                               class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                    </div>
                    <div class="md:col-span-2">
                        <button id="createGlobalPhasesStructureBtn"
                                class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                            Créer les phases de brassage
                        </button>
                    </div>
                </div>
                <p id="message" class="mt-3 text-sm text-center"></p>
            </section>

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">3. Ajuster les Groupes de Brassage Supplémentaires (Optionnel)</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label for="numberOfSecondaryGroups" class="block text-sm font-medium text-gray-700 mb-1">Nombre de groupes de niveau à former (2 ou 3)</label>
                        <select id="numberOfSecondaryGroups"
                                class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                            <option value="2">2 Groupes (Principale, Consolante)</option>
                            <option value="3">3 Groupes (Principale, Consolante, Super Consolante)</option>
                        </select>
                    </div>
                    <div>
                        <button id="previewSecondaryGroupsBtn"
                                class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                            Créer les groupes
                        </button>
                    </div>
                </div>
                <p id="secondaryPreviewMessage" class="mt-3 text-sm text-center"></p>

                <div id="secondaryGroupsPreviewDisplay" class="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <p class="text-gray-500 text-center w-full md:col-span-2 lg:col-span-3">Gérez les groupes ici après avoir cliqué sur "Créer les groupes".</p>
                </div>
                <div class="flex justify-center mt-6">
                    <button id="refreshSecondaryGroupScoresBtn"
                            class="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 shadow-md transition ease-in-out duration-150 hidden">
                        Actualiser les scores des groupes secondaires
                    </button>
                </div>


                <div class="mt-6 text-center">
                    <button id="validateSecondaryGroupsBtn"
                            class="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150 hidden">
                        Valider la répartition des groupes pour la phase éliminatoire
                    </button>
                    <button id="generateSecondaryBrassagesBtn"
                            class="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150 ml-2 hidden">
                        Générer les brassages des groupes secondaires
                    </button>
                </div>
            </section>

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">4. Passer Directement à la Phase Éliminatoire (Si pas de brassage secondaire)</h2>
                <p class="text-gray-600 mb-4">
                    Après avoir fini de saisir les scores des phases de brassage, si vous n'avez pas besoin de phases de brassage secondaires, vous pouvez valider les équipes
                    pour la phase éliminatoire en vous basant sur leur classement général actuel.
                    <br>
                    <strong>Attention :</strong> Cette action écrasera toute configuration de groupes secondaires préalablement validée.
                </p>
                <div class="text-center flex justify-center items-center gap-4">
					<button id="goToEliminationSelectionFromBrassageBtn"
						class="bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 shadow-md transition ease-in-out duration-150">
							Sélectionner des équipes à éliminer
					</button>
					<button id="validateForDirectEliminationBtn"
						class="bg-purple-600 text-white py-2 px-6 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
						Valider les équipes pour la phase éliminatoire
				</div>
                <p id="directEliminationMessage" class="mt-3 text-sm text-center"></p>
            </section>

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">Historique des Phases de Brassage</h2>
                <div class="mt-4 flex items-center justify-end">
                    <input type="checkbox" id="toggleRepeatedMatchesDisplay" class="form-checkbox h-4 w-4 text-blue-600 mr-2">
                    <label for="toggleRepeatedMatchesDisplay" class="text-gray-700 text-sm">Afficher les rencontres répétées</label>
                    <span id="repeatedMatchesCount" class="text-sm text-gray-500 ml-2"></span>
                </div>
                <div id="phaseHistoryDisplay" class="flex flex-col space-y-2 items-center">
                    <p class="text-gray-500 text-center w-full">Aucune phase de brassage générée pour le moment.</p>
                </div>
                <div class="mt-4 text-center">
                    <button id="clearAllPhasesBtn"
                            class="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                        Effacer toutes les Phases
                    </button>
                </div>
            </section>

            <section class="p-6 bg-gray-50 rounded-lg border border-gray-200">
               <div class="flex justify-between items-center mb-4">
				<h2 id="currentPhaseTitle" class="text-2xl font-semibold text-gray-700">Poules de la Phase Actuelle</h2>
					<span id="scoreCounter" class="text-sm text-gray-600 font-medium"></span>
				</div>
				<div id="poolsDisplay" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <p class="text-gray-500 text-center md:col-span-2">Les poules de la phase sélectionnée s\'afficheront ici.</p>
                </div>
            </section>
        `;
        setupBrassagesPageLogic();
    }

   function setupBrassagesPageLogic() {
    const poolsDisplay = document.getElementById('poolsDisplay');
    const phaseHistoryDisplay = document.getElementById('phaseHistoryDisplay');
    const createGlobalPhasesStructureBtn = document.getElementById('createGlobalPhasesStructureBtn');
    const clearAllPhasesBtn = document.getElementById('clearAllPhasesBtn');
    const currentPhaseTitle = document.getElementById('currentPhaseTitle');
    const basisInitialLevelsRadio = document.getElementById('basisInitialLevels');
    const basisPreviousResultsRadio = document.getElementById('basisPreviousResults');
    const previewSecondaryGroupsBtn = document.getElementById('previewSecondaryGroupsBtn');
    const validateSecondaryGroupsBtn = document.getElementById('validateSecondaryGroupsBtn');
    const generateSecondaryBrassagesBtn = document.getElementById('generateSecondaryBrassagesBtn');
    const refreshSecondaryGroupScoresBtn = document.getElementById('refreshSecondaryGroupScoresBtn');
    const validateForDirectEliminationBtn = document.getElementById('validateForDirectEliminationBtn');
    const toggleRepeatedMatchesDisplay = document.getElementById('toggleRepeatedMatchesDisplay');
    const secondaryGroupsPreviewDisplay = document.getElementById('secondaryGroupsPreviewDisplay');
	const goToEliminationSelectionFromBrassageBtn = document.getElementById('goToEliminationSelectionFromBrassageBtn');
    const numberOfGlobalPhasesInput = document.getElementById('numberOfGlobalPhases');

    createGlobalPhasesStructureBtn.addEventListener('click', () => {
        if (AppState.teamTournament.allTeams.length === 0) {
            showToast("Veuillez d'abord ajouter des équipes.", "error");
            return;
        }
        const numPhases = parseInt(numberOfGlobalPhasesInput.value);
        if (isNaN(numPhases) || numPhases < 1) {
            showToast("Nombre de phases invalide.", "error");
            return;
        }

        const existingBrassagePhases = AppState.teamTournament.allBrassagePhases.filter(p => p.type === PHASE_TYPE_INITIAL || p.type === PHASE_TYPE_SECONDARY_BRASSAGE);
        const nextPhaseNumber = existingBrassagePhases.length + 1;

        for (let i = 0; i < numPhases; i++) {
            AppState.teamTournament.allBrassagePhases.push({
                id: `${PHASE_TYPE_INITIAL}_${Date.now()}_${i}`,
                type: PHASE_TYPE_INITIAL,
                name: `Phase Globale ${nextPhaseNumber + i}`,
                pools: [],
                generated: false,
                timestamp: Date.now() + i
            });
        }

        saveAllData();
        renderPhaseHistory();
        poolsDisplay.innerHTML = '<p class="text-gray-500 text-center md:col-span-2">Les poules de la phase sélectionnée s\'afficheront ici.</p>';
        currentPhaseTitle.textContent = 'Poules de la Phase Actuelle';
        AppState.teamTournament.currentDisplayedPhaseId = null;
        showToast(`${numPhases} phase(s) créée(s) avec succès.`, "success");
    });

    clearAllPhasesBtn.addEventListener('click', () => {
        const p = document.createElement('p');
        p.textContent = "Supprimer TOUTES les phases de brassage ?";
        showModal('Confirmer la suppression', p, () => {
            AppState.teamTournament.allBrassagePhases = AppState.teamTournament.allBrassagePhases.filter(p => p.type === PHASE_TYPE_ELIMINATION_SEEDING);
            AppState.teamTournament.currentSecondaryGroupsPreview = {};
            saveAllData();
            renderPhaseHistory();
            poolsDisplay.innerHTML = '<p class="text-gray-500 text-center md:col-span-2">Les poules de la phase sélectionnée s\'afficheront ici.</p>';
            currentPhaseTitle.textContent = 'Poules de la Phase Actuelle';
            secondaryGroupsPreviewDisplay.innerHTML = '<p class="text-gray-500 text-center w-full md:col-span-2 lg:col-span-3">Créez les groupes ici.</p>';
            validateSecondaryGroupsBtn.classList.add('hidden');
            generateSecondaryBrassagesBtn.classList.add('hidden');
            refreshSecondaryGroupScoresBtn.classList.add('hidden');
            showToast("Toutes les phases de brassage ont été supprimées.", "success");
        }, true);
    });

    basisInitialLevelsRadio.addEventListener('change', () => {
        if (basisInitialLevelsRadio.checked) {
            AppState.teamTournament.poolGenerationBasis = 'initialLevels';
            saveAllData();
            updatePoolGenerationBasisUI();
        }
    });

    basisPreviousResultsRadio.addEventListener('change', () => {
        if (basisPreviousResultsRadio.checked) {
            AppState.teamTournament.poolGenerationBasis = 'previousResults';
            saveAllData();
            updatePoolGenerationBasisUI();
        }
    });

    previewSecondaryGroupsBtn.addEventListener('click', previewSecondaryGroupsWithWarning);
    validateSecondaryGroupsBtn.addEventListener('click', validateSecondaryGroupsForElimination);

    generateSecondaryBrassagesBtn.addEventListener('click', () => {
        const p = document.createElement('p');
        p.textContent = "Générer les phases de brassage pour ces groupes ?";
        showModal('Confirmer la génération', p, generateSecondaryBrassagePhases);
    });

    refreshSecondaryGroupScoresBtn.addEventListener('click', updateSecondaryGroupsPreviewDisplayOnly);
    validateForDirectEliminationBtn.addEventListener('click', validateForDirectElimination);

    toggleRepeatedMatchesDisplay.addEventListener('change', () => {
        if (AppState.teamTournament.currentDisplayedPhaseId) {
            const currentPhase = AppState.teamTournament.allBrassagePhases.find(p => p.id === AppState.teamTournament.currentDisplayedPhaseId);
            if (currentPhase) {
                renderPools(currentPhase.pools, currentPhase.name, currentPhase.id, toggleRepeatedMatchesDisplay.checked);
            }
        }
    });

	goToEliminationSelectionFromBrassageBtn.addEventListener('click', () => {
        window.location.hash = '#elimination-selection';
	});

    renderPhaseHistory();
    updatePoolGenerationBasisUI();

    if (AppState.teamTournament.currentDisplayedPhaseId) {
        const initialPhase = AppState.teamTournament.allBrassagePhases.find(p => p.id === AppState.teamTournament.currentDisplayedPhaseId);
        if (initialPhase) renderPools(initialPhase.pools, initialPhase.name, initialPhase.id);
    }

    if (Object.keys(AppState.teamTournament.currentSecondaryGroupsPreview).length > 0) {
        const numGroupsInPreview = Object.keys(AppState.teamTournament.currentSecondaryGroupsPreview).length;
        const groupNamesMap = { 2: ["Principale", "Consolante"], 3: ["Principale", "Consolante", "Super Consolante"] };
        renderSecondaryGroupsPreview(groupNamesMap[numGroupsInPreview]);
    }
}
    function renderEliminationSelectionPage() {
        APP_CONTAINER.innerHTML = `
            <h1 class="text-3xl font-bold text-center text-gray-800 mb-8">Sélection des Équipes Éliminées</h1>

            <section class="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <p class="text-gray-700 mb-4">Cochez les équipes qui seront exclues des phases éliminatoires. Elles n'apparaîtront pas dans les arbres de tournoi.</p>
                <div id="eliminationTeamsList" class="space-y-3">
                </div>
                <div class="mt-6 text-center">
                    <button id="saveEliminationSelectionBtn"
                            class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                        Sauvegarder la Sélection
                    </button>
                    <p id="eliminationSelectionMessage" class="mt-3 text-sm text-center"></p>
                </div>
            </section>
        `;
        setupEliminationSelectionPageLogic();
    }

    function setupEliminationSelectionPageLogic() {
        const eliminationTeamsList = document.getElementById('eliminationTeamsList');
        const saveEliminationSelectionBtn = document.getElementById('saveEliminationSelectionBtn');

        function renderTeamsForEliminationSelection() {
            eliminationTeamsList.innerHTML = '';

            if (AppState.teamTournament.allTeams.length === 0) {
                eliminationTeamsList.innerHTML = '<p class="text-gray-500 text-center">Aucune équipe enregistrée.</p>';
                return;
            }

            const globalRankings = getGlobalRankings(AppState.teamTournament.allTeams, AppState.teamTournament.allBrassagePhases);
            const teamScoresMap = new Map();
            globalRankings.forEach(rankEntry => {
                teamScoresMap.set(rankEntry.teamObject.id, {
                    points: rankEntry.totalPoints,
                    diffScore: rankEntry.totalDiffScore
                });
            });

            const sortedTeamsForDisplay = [...AppState.teamTournament.allTeams].sort((a, b) => {
                const scoreA = teamScoresMap.get(a.id) || { points: 0, diffScore: 0 };
                const scoreB = teamScoresMap.get(b.id) || { points: 0, diffScore: 0 };
                if (scoreB.points !== scoreA.points) return scoreB.points - scoreA.points;
                if (scoreB.diffScore !== scoreA.diffScore) return scoreB.diffScore - scoreA.diffScore;
                return a.name.localeCompare(b.name);
            });

            sortedTeamsForDisplay.forEach(team => {
                const teamDiv = document.createElement('div');
                const isChecked = AppState.teamTournament.eliminatedTeams.has(team.id);
                const scores = teamScoresMap.get(team.id) || { points: 0, diffScore: 0 };

                teamDiv.className = `flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer ${isChecked ? 'bg-red-50' : ''}`;
                teamDiv.innerHTML = `
                    <label class="flex items-center flex-grow cursor-pointer">
                        <input type="checkbox" data-team-id="${team.id}" class="form-checkbox h-5 w-5 text-red-600 mr-3" ${isChecked ? 'checked' : ''}>
                        <span class="text-lg font-medium text-gray-800 ${isChecked ? 'line-through text-red-600' : ''}">
                            ${escapeHtml(team.name)} (Pts: ${scores.points}, Diff: ${scores.diffScore})
                        </span>
                    </label>
                `;
                eliminationTeamsList.appendChild(teamDiv);

                const checkbox = teamDiv.querySelector('input[type="checkbox"]');
                const teamNameSpan = teamDiv.querySelector('span');
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        teamDiv.classList.add('bg-red-50');
                        teamNameSpan.classList.add('line-through', 'text-red-600');
                    } else {
                        teamDiv.classList.remove('bg-red-50');
                        teamNameSpan.classList.remove('line-through', 'text-red-600');
                    }
                });
            });
        }

        saveEliminationSelectionBtn.addEventListener('click', () => {
            AppState.teamTournament.eliminatedTeams.clear();
            document.querySelectorAll('#eliminationTeamsList input[type="checkbox"]:checked').forEach(checkbox => {
                AppState.teamTournament.eliminatedTeams.add(checkbox.dataset.teamId);
            });
            saveAllData();
            showToast("Sélection des équipes éliminées sauvegardée !", "success");
            window.history.back();
        });

        renderTeamsForEliminationSelection();
    }


    function renderEliminatoiresPage() {
        APP_CONTAINER.innerHTML = `
            <h1 class="text-3xl font-bold text-center text-gray-800 mb-8">Phase Éliminatoire</h1>

            <section class="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">Génération des phases éliminatoires</h2>
                <p class="text-gray-600 mb-4">
                    Les phases éliminatoires seront générées pour les groupes "Principale", "Consolante" et "Super Consolante"
                    (si ces groupes existent et contiennent au moins 2 équipes) validés sur la page Brassages. Les matchs seront appariés 1er contre dernier, 2ème contre avant-dernier, etc.
                </p>
                <div class="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                    <button id="goToEliminationSelectionBtn"
                            class="bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                        Sélectionner des équipes à éliminer
                    </button>
                    <button id="generateEliminationPhasesBtn"
                            class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                        Générer les phases éliminatoires
                    </button>
                    <button id="resetAllEliminationPhasesBtn"
                            class="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md transition ease-in-out duration-150">
                        Réinitialiser toutes les phases éliminatoires
                    </button>
                </div>
                <p id="eliminationMessage" class="mt-3 text-sm text-center"></p>
            </section>

            <div id="eliminationBracketsDisplay" class="space-y-8 mt-8">
                <p class="text-gray-500 text-center">Cliquez sur "Générer les Phases Éliminatoires" pour afficher les tournois.</p>
            </div>
        `;
        setupEliminatoiresPageLogic();
    }

    function setupEliminatoiresPageLogic() {
        const eliminationBracketsDisplay = document.getElementById('eliminationBracketsDisplay');
        const generateEliminationPhasesBtn = document.getElementById('generateEliminationPhasesBtn');
        const resetAllEliminationPhasesBtn = document.getElementById('resetAllEliminationPhasesBtn');
        const goToEliminationSelectionBtn = document.getElementById('goToEliminationSelectionBtn');

        function getTeamsGroupedBySecondaryPhase() {
            const latestEliminationSeedingPhase = AppState.teamTournament.allBrassagePhases
                .filter(p => p.type === PHASE_TYPE_ELIMINATION_SEEDING)
                .sort((a, b) => b.timestamp - a.timestamp)[0];

            if (latestEliminationSeedingPhase && latestEliminationSeedingPhase.groupedTeams) {
                console.log("DEBUG: Secondary ranking phases found:", latestEliminationSeedingPhase.groupedTeams);
                return latestEliminationSeedingPhase.groupedTeams;
            } else {
                showToast("Aucune phase de classement secondaire (Principale, Consolante, Super Consolante) n'a été validée sur la page 'Brassages'. Veuillez les générer et les valider d'abord.", "error");
                return null;
            }
        }

        function getRoundNameFromTeamsCount(numTeamsInRound) {
            if (numTeamsInRound === 2) return 'Finale';
            if (numTeamsInRound === 4) return 'Demi-Finales';
            if (numTeamsInRound === 8) return 'Quart de Finale';
            if (numTeamsInRound === 16) return '8ème de Finale';
            if (numTeamsInRound === 32) return '16ème de Finale';
            if (numTeamsInRound === 64) return '32ème de Finale';
            return `Tour Éliminatoire (${numTeamsInRound} équipes)`;
        }

        function generateBracketData(teams, groupType) {
            const eligibleTeamsInGroup = teams.filter(team => !AppState.teamTournament.eliminatedTeams.has(team.id));

            if (eligibleTeamsInGroup.length < 2) {
                return { bracket: [], message: `Pas assez d'équipes éligibles dans le groupe ${groupType} pour un tournoi à élimination (${eligibleTeamsInGroup.length} équipe(s) restante(s)).` };
            }

            let currentParticipants = [...eligibleTeamsInGroup];
            let rounds = [];

            currentParticipants.sort((a, b) => {
                const pointsA = a.totalPoints || 0;
                const pointsB = b.totalPoints || 0;
                const diffA = a.totalDiffScore || 0;
                const diffB = b.totalDiffScore || 0;
                if (pointsB !== pointsA) return pointsB - pointsA;
                if (diffB !== diffA) return diffB - diffA;
                return a.name.localeCompare(b.name);
            });

            let bracketSize = 2;
            while (bracketSize < currentParticipants.length) {
                bracketSize *= 2;
            }
            const numberOfByes = bracketSize - currentParticipants.length;
            let teamsAdvancingToNextRound = [];

            if (numberOfByes > 0) {
                const byeTeams = currentParticipants.slice(0, numberOfByes);
                teamsAdvancingToNextRound.push(...byeTeams.map(team => ({
                    id: team.id,
                    name: team.name,
                    isBye: true
                })));
                currentParticipants = currentParticipants.slice(numberOfByes);
            }

            let roundMatches = [];
            let currentRoundPlayers = [...currentParticipants];

            for (let i = 0; i < Math.ceil(currentRoundPlayers.length / 2); i++) {
                const team1 = currentRoundPlayers[i];
                const team2 = currentRoundPlayers[currentRoundPlayers.length - 1 - i];

                if (team1 && team2) {
                    roundMatches.push({
                        id: `elim_match_${groupType}_R0_M${roundMatches.length}`,
                        team1: team1,
                        team2: team2,
                        score1: null, score2: null, winnerId: null, loserId: null, nextMatchId: null
                    });
                }
            }

            if (roundMatches.length > 0) {
                rounds.push({ roundName: getRoundNameFromTeamsCount(currentRoundPlayers.length), matches: roundMatches });
            }

            let prevRoundMatches = roundMatches;
            let roundIdx = 1;

            while (true) {
                let teamsForNextRound = [];
                if (roundIdx === 1 && numberOfByes > 0) {
                    teamsForNextRound.push(...teamsAdvancingToNextRound);
                }

                prevRoundMatches.forEach(match => {
                    if (match.winnerId) {
                        teamsForNextRound.push(AppState.teamTournament.allTeams.find(t => t.id === match.winnerId) || match.team1 || match.team2);
                    } else {
                        teamsForNextRound.push({ id: null, name: 'À déterminer' });
                    }
                });

                if (teamsForNextRound.length <= 1) break;

                let nextRoundMatches = [];
                const numMatchesInThisRound = Math.floor(teamsForNextRound.length / 2);

                for (let i = 0; i < numMatchesInThisRound; i++) {
                    const team1 = teamsForNextRound[i];
                    const team2 = teamsForNextRound[teamsForNextRound.length - 1 - i];
                    const match = {
                        id: `elim_match_${groupType}_R${roundIdx}_M${i}`,
                        team1: team1, team2: team2, score1: null, score2: null, winnerId: null, loserId: null,
                        prevMatch1Id: prevRoundMatches[i*2] ? prevRoundMatches[i*2].id : null,
                        prevMatch2Id: prevRoundMatches[i*2 + 1] ? prevRoundMatches[i*2 + 1].id : null,
                        nextMatchId: null
                    };
                    nextRoundMatches.push(match);

                    if (prevRoundMatches[i*2]) prevRoundMatches[i*2].nextMatchId = match.id;
                    if (prevRoundMatches[i*2 + 1]) prevRoundMatches[i*2 + 1].nextMatchId = match.id;
                }

                rounds.push({ roundName: getRoundNameFromTeamsCount(teamsForNextRound.length), matches: nextRoundMatches });
                prevRoundMatches = nextRoundMatches;
                roundIdx++;

                if (nextRoundMatches.length === 1) break;
            }

            const semiFinalRound = rounds.find(r => r.roundName === 'Demi-Finales');
            if (semiFinalRound && semiFinalRound.matches.length === 2) {
                const petiteFinaleMatch = {
                    id: `elim_match_petite_finale_${groupType}`,
                    roundName: 'Petite Finale',
                    team1: { id: null, name: 'À déterminer' },
                    team2: { id: null, name: 'À déterminer' },
                    score1: null, score2: null, winnerId: null, loserId: null,
                    prevMatch1LoserId: semiFinalRound.matches[0].id,
                    prevMatch2LoserId: semiFinalRound.matches[1].id
                };
                rounds.push({ roundName: 'Petite Finale', matches: [petiteFinaleMatch] });
            }

            return {
                id: `elim_bracket_${groupType}`,
                groupType: groupType,
                timestamp: Date.now(),
                bracket: rounds
            };
        }

		function renderBracket(bracketData, containerElement) {
            if (!bracketData || !bracketData.bracket || bracketData.bracket.length === 0) {
                containerElement.innerHTML = `<p class="text-gray-500 text-center">Aucun tournoi à afficher pour le groupe ${escapeHtml(bracketData.groupType || '')}.</p>`;
                return;
            }

            containerElement.innerHTML = `
                <h3 class="2xl font-semibold text-gray-700 mb-4 text-center">Tournoi ${escapeHtml(bracketData.groupType)}</h3>
                <div class="flex flex-col sm:flex-row justify-center gap-4 p-4 bg-white rounded-lg shadow-md overflow-x-auto">
                    </div>
                <div class="text-center mt-4">
                    <button data-group-type="${escapeHtml(bracketData.groupType)}" class="reset-group-btn bg-yellow-500 text-white py-1 px-3 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 shadow-sm text-sm">
						Réinitialiser ce groupe
					</button>
                </div>
            `;
            const bracketContainer = containerElement.querySelector('.flex.flex-col.sm\\:flex-row');

            bracketData.bracket.forEach((round, roundIndex) => {
                const roundDiv = document.createElement('div');
                roundDiv.className = 'bracket-round flex flex-col items-center p-2 border border-gray-100 rounded-lg';
                roundDiv.innerHTML = `<h4 class="font-bold text-lg text-gray-800 mb-4">${escapeHtml(round.roundName)}</h4>`;

                round.matches.forEach(match => {
                    const matchFrame = document.createElement('div');
                    matchFrame.className = 'match-frame bg-gray-50 border border-gray-300 rounded-lg p-3 mb-4 shadow-sm w-full';
                    matchFrame.dataset.matchId = match.id;

                    let team1Name = escapeHtml(match.team1 ? match.team1.name : 'N/A');
                    let team2Name = escapeHtml(match.team2 ? match.team2.name : 'N/A');
                    let team1Class = 'team-name';
                    let team2Class = 'team-name';
                    let inputDisabled = false;

                    if (!match.team1 || match.team1.id === null || match.team1.id === 'BYE' ||
                        !match.team2 || match.team2.id === null || match.team2.id === 'BYE') {
                        inputDisabled = true;
                    }

                    if (match.team1 && match.team1.id === 'BYE') match.score1 = 0;
                    if (match.team2 && match.team2.id === 'BYE') match.score2 = 0;

                    if (match.winnerId) {
                        if (match.winnerId === (match.team1 ? match.team1.id : null)) {
                            team1Class += ' winner-team';
                            team2Class += ' loser-team';
                        } else if (match.winnerId === (match.team2 ? match.team2.id : null)) {
                            team2Class += ' winner-team';
                            team1Class += ' loser-team';
                        }
                    }

					const arbitreLink = `${window.location.origin}${window.location.pathname}arbitre.html?tournoi=${AppState.auth.activeTeamTournamentId}&groupe=${bracketData.groupType}&match=${match.id}`;

					matchFrame.innerHTML = `
						<div class="flex justify-end mb-2">
							<button class="arbitre-link-btn text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300" data-link="${arbitreLink}">
								<i class="fas fa-link mr-1"></i> Lien Arbitre
							</button>
						</div>
						<div class="match-teams w-full text-center">
							<div class="${team1Class}">${team1Name}</div>
							
							<div class="flex flex-col items-center gap-1 my-1">
								<select data-match-id="${match.id}" data-team="1" class="team-score-select score-input w-20 p-1 border border-gray-300 rounded-md text-center text-sm" ${inputDisabled ? 'disabled' : ''}>
									${generateScoreOptions(40, match.score1)}
								</select>
								<select data-match-id="${match.id}" data-team="2" class="team-score-select score-input w-20 p-1 border border-gray-300 rounded-md text-center text-sm" ${inputDisabled ? 'disabled' : ''}>
									${generateScoreOptions(40, match.score2)}
								</select>
							</div>
							<div class="${team2Class}">${team2Name}</div>
						</div>
					`;
                    roundDiv.appendChild(matchFrame);
                });
                bracketContainer.appendChild(roundDiv);
            });

            containerElement.querySelectorAll('.match-frame .score-input').forEach(select => {
                select.addEventListener('change', updateMatchScoreAndWinner);
            });
        }

        function updateMatchScoreAndWinner(event) {
            const matchId = event.target.dataset.matchId;
            const teamNum = event.target.dataset.team;
            let score = parseInt(event.target.value);

            if (isNaN(score)) {
                score = null;
            }

            let targetBracket = null;
            let targetMatch = null;

            for (const groupType in AppState.teamTournament.eliminationPhases) {
                const bracket = AppState.teamTournament.eliminationPhases[groupType];
                for (const round of bracket.bracket) {
                    for (const match of round.matches) {
                        if (match.id === matchId) {
                            targetBracket = bracket;
                            targetMatch = match;
                            break;
                        }
                    }
                    if (targetMatch) break;
                }
                if (targetMatch) break;
            }

            if (!targetMatch) {
                console.error(`Match with ID ${matchId} not found.`);
                return;
            }

            if ((!targetMatch.team1 || targetMatch.team1.id === null || targetMatch.team1.id === 'BYE') ||
                (!targetMatch.team2 || targetMatch.team2.id === null || targetMatch.team2.id === 'BYE')) {
                showToast("Ce match est un BYE ou ses équipes ne sont pas encore déterminées. Les scores ne peuvent pas être saisis.", "error");
                event.target.value = (teamNum === '1' ? targetMatch.score1 : targetMatch.score2) || '';
                return;
            }

            if (teamNum === '1') {
                targetMatch.score1 = score;
            } else {
                targetMatch.score2 = score;
            }

            targetMatch.winnerId = null;
            targetMatch.loserId = null;

            if (targetMatch.score1 !== null && targetMatch.score2 !== null && targetMatch.score1 >= 0 && targetMatch.score2 >= 0) {
                if (targetMatch.score1 > targetMatch.score2) {
                    targetMatch.winnerId = targetMatch.team1.id;
                    targetMatch.loserId = targetMatch.team2.id;
                } else if (targetMatch.score2 > targetMatch.score1) {
                    targetMatch.winnerId = targetMatch.team2.id;
                    targetMatch.loserId = targetMatch.team1.id;
                } else {
                    showToast("Un match ne peut pas être un match nul. Veuillez entrer un vainqueur.", "error");
                }
            }

            saveAllData();

            const matchElement = document.querySelector(`[data-match-id="${matchId}"]`);
            if (matchElement) {
                const team1NameSpan = matchElement.querySelector('.team-name:first-of-type');
                const team2NameSpan = matchElement.querySelector('.team-name:last-of-type');
                team1NameSpan.classList.remove('winner-team', 'loser-team');
                team2NameSpan.classList.remove('winner-team', 'loser-team');

                if (targetMatch.winnerId === (targetMatch.team1 ? targetMatch.team1.id : null)) {
					team1NameSpan.classList.add('winner-team');
					team2NameSpan.classList.add('loser-team');
				} else if (targetMatch.winnerId === (targetMatch.team2 ? targetMatch.team2.id : null)) {
					team2NameSpan.classList.add('winner-team');
					team1NameSpan.classList.add('loser-team');
                }
            }

            propagateWinnerLoser(targetMatch.id, targetMatch.winnerId, targetMatch.loserId, targetBracket);
            renderBracket(targetBracket, document.getElementById(targetBracket.groupType.toLowerCase() + 'Bracket'));
        }

        function propagateWinnerLoser(sourceMatchId, winnerId, loserId, bracket) {
            const sourceMatch = bracket.bracket.flatMap(r => r.matches).find(m => m.id === sourceMatchId);
            if (!sourceMatch) return;

            const winningTeamObject = AppState.teamTournament.allTeams.find(t => t.id === winnerId) || { id: winnerId, name: 'À déterminer' };
            const losingTeamObject = AppState.teamTournament.allTeams.find(t => t.id === loserId) || { id: loserId, name: 'À déterminer' };

            bracket.bracket.forEach(round => {
                round.matches.forEach(match => {
                    if (match.prevMatch1Id === sourceMatchId) {
                        match.team1 = { ...winningTeamObject };
                        if (match.team1.id && match.team2?.id && match.team1.id !== 'À déterminer' && match.team2.id !== 'À déterminer' && match.team1.id !== 'BYE' && match.team2.id !== 'BYE') {
                           if (match.score1 !== null || match.score2 !== null || match.winnerId !== null) {
                                match.score1 = null; match.score2 = null; match.winnerId = null; match.loserId = null;
                           }
                        }
                    }
                    if (match.prevMatch2Id === sourceMatchId) {
                        match.team2 = { ...winningTeamObject };
                        if (match.team1.id && match.team2?.id && match.team1.id !== 'À déterminer' && match.team2.id !== 'À déterminer' && match.team1.id !== 'BYE' && match.team2.id !== 'BYE') {
                           if (match.score1 !== null || match.score2 !== null || match.winnerId !== null) {
                                match.score1 = null; match.score2 = null; match.winnerId = null; match.loserId = null;
                           }
                        }
                    }

                    if (match.roundName === 'Petite Finale') {
                        const semiFinalMatch1 = bracket.bracket.flatMap(r => r.matches).find(m => m.id === match.prevMatch1LoserId);
                        const semiFinalMatch2 = bracket.bracket.flatMap(r => r.matches).find(m => m.id === match.prevMatch2LoserId);

                        if (sourceMatch.id === semiFinalMatch1?.id && semiFinalMatch1.loserId) {
                            const actualLoserTeam = AppState.teamTournament.allTeams.find(t => t.id === semiFinalMatch1.loserId);
                            if (actualLoserTeam) {
                                match.team1 = { id: actualLoserTeam.id, name: actualLoserTeam.name };
                                if (match.team1.id && match.team2?.id && (match.score1 !== null || match.score2 !== null || match.winnerId !== null)) {
                                    match.score1 = null; match.score2 = null; match.winnerId = null; match.loserId = null;
                                }
                            }
                        }
                        if (sourceMatch.id === semiFinalMatch2?.id && semiFinalMatch2.loserId) {
                            const actualLoserTeam = AppState.teamTournament.allTeams.find(t => t.id === semiFinalMatch2.loserId);
                            if (actualLoserTeam) {
                                match.team2 = { id: actualLoserTeam.id, name: actualLoserTeam.name };
                                if (match.team1?.id && match.team2.id && (match.score1 !== null || match.score2 !== null || match.winnerId !== null)) {
                                    match.score1 = null; match.score2 = null; match.winnerId = null; match.loserId = null;
                                }
                            }
                        }
                    }
                });
            });
            saveAllData();
        }

        function generateAllEliminationPhases() {
            eliminationBracketsDisplay.innerHTML = '';
            showToast("Génération des tournois éliminatoires...", "info");

            const groupedTeams = getTeamsGroupedBySecondaryPhase();
            if (!groupedTeams) return;

            AppState.teamTournament.eliminationPhases = {};

            const orderedGroupTypes = ["Principale", "Consolante", "Super Consolante"];
            orderedGroupTypes.forEach(groupType => {
                const teamsInGroup = groupedTeams[groupType];
                if (teamsInGroup) {
                    const bracketData = generateBracketData(teamsInGroup, groupType);
                    if (bracketData.bracket.length > 0) {
                        AppState.teamTournament.eliminationPhases[groupType] = bracketData;
                        const groupContainer = document.createElement('div');
                        groupContainer.id = groupType.toLowerCase() + 'Bracket';
                        groupContainer.className = 'bg-white p-4 rounded-lg shadow-xl';
                        eliminationBracketsDisplay.appendChild(groupContainer);
                        renderBracket(bracketData, groupContainer);
                    } else {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'bg-white p-4 rounded-lg shadow-md text-center text-gray-500';
                        messageDiv.textContent = bracketData.message || `Pas assez d'équipes éligibles dans le groupe ${escapeHtml(groupType)} pour générer un tournoi à élimination.`;
                        eliminationBracketsDisplay.appendChild(messageDiv);
                    }
                } else {
                     const messageDiv = document.createElement('div');
                    messageDiv.className = 'bg-white p-4 rounded-lg shadow-md text-center text-gray-500';
                    messageDiv.textContent = `Le groupe "${escapeHtml(groupType)}" n'est pas configuré.`;
                    eliminationBracketsDisplay.appendChild(messageDiv);
                }
            });
            saveAllData();
            showToast("Phases éliminatoires générées avec succès !", "success");
        }

        function resetAllEliminationPhases() {
            const messageContent = document.createElement('p');
            messageContent.textContent = "Êtes-vous sûr de vouloir réinitialiser TOUTES les phases éliminatoires ? Cette action est irréversible.";
            messageContent.className = 'text-gray-700';

            showModal('Confirmer la réinitialisation complète', messageContent, () => {
                AppState.teamTournament.eliminationPhases = {};
                saveAllData();
                eliminationBracketsDisplay.innerHTML = '<p class="text-gray-500 text-center">Cliquez sur "Générer les Phases Éliminatoires" pour afficher les tournois.</p>';
                showToast("Toutes les phases éliminatoires ont été réinitialisées.", "success");
            }, true);
        }

        function resetGroupEliminationPhase(groupType) {
            const messageContent = document.createElement('p');
            messageContent.textContent = `Êtes-vous sûr de vouloir réinitialiser la phase éliminatoire pour le groupe "${escapeHtml(groupType)}" ? Cette action est irréversible.`;
            messageContent.className = 'text-gray-700';

            showModal(`Confirmer la réinitialisation du groupe ${escapeHtml(groupType)}`, messageContent, () => {
                const groupedTeams = getTeamsGroupedBySecondaryPhase();
                if (groupedTeams && groupedTeams[groupType]) {
                    const eligibleTeamsInGroup = groupedTeams[groupType].filter(team => !AppState.teamTournament.eliminatedTeams.has(team.id));
                    if (eligibleTeamsInGroup.length >= 2) {
                        const newBracketData = generateBracketData(eligibleTeamsInGroup, groupType);
                        AppState.teamTournament.eliminationPhases[groupType] = newBracketData;
                        saveAllData();
                        renderBracket(newBracketData, document.getElementById(groupType.toLowerCase() + 'Bracket'));
                        showToast(`Phase éliminatoire pour le groupe "${escapeHtml(groupType)}" réinitialisée.`, "success");
                    } else {
                        showToast(`Impossible de réinitialiser le groupe "${escapeHtml(groupType)}" : pas assez d'équipes éligibles (${eligibleTeamsInGroup.length} restante(s)) ou données manquantes.`, "error");
                        const groupContainer = document.getElementById(groupType.toLowerCase() + 'Bracket');
                        if (groupContainer) {
                             groupContainer.innerHTML = `<p class="text-gray-500 text-center">Aucun tournoi à afficher pour le groupe ${escapeHtml(groupType)}.</p>`;
                        }
                    }
                } else {
                     showToast(`Impossible de réinitialiser le groupe "${escapeHtml(groupType)}" : groupe non configuré.`, "error");
                }
            }, true);
        }

        if (Object.keys(AppState.teamTournament.eliminationPhases).length > 0) {
            eliminationBracketsDisplay.innerHTML = '';
            const orderedGroupTypes = ["Principale", "Consolante", "Super Consolante"];
            orderedGroupTypes.forEach(groupType => {
                const bracketData = AppState.teamTournament.eliminationPhases[groupType];
                if (bracketData) {
                    const groupContainer = document.createElement('div');
                    groupContainer.id = groupType.toLowerCase() + 'Bracket';
                    groupContainer.className = 'bg-white p-4 rounded-lg shadow-xl';
                    eliminationBracketsDisplay.appendChild(groupContainer);
                    renderBracket(bracketData, groupContainer);
                } else {
                     const messageDiv = document.createElement('div');
                    messageDiv.className = 'bg-white p-4 rounded-lg shadow-md text-center text-gray-500';
                    messageDiv.textContent = `Le groupe "${escapeHtml(groupType)}" n'a aucun tournoi enregistré.`;
                    eliminationBracketsDisplay.appendChild(messageDiv);
                }
            });

        } else {
            eliminationBracketsDisplay.innerHTML = '<p class="text-gray-500 text-center">Cliquez sur "Générer les Phases Éliminatoires" pour afficher les tournois.</p>';
        }

        generateEliminationPhasesBtn.addEventListener('click', generateAllEliminationPhases);
        resetAllEliminationPhasesBtn.addEventListener('click', resetAllEliminationPhases);
        goToEliminationSelectionBtn.addEventListener('click', () => {
            window.location.hash = '#elimination-selection';
        });

		eliminationBracketsDisplay.addEventListener('click', (event) => {
			// Logique existante pour le bouton de réinitialisation
			if (event.target.classList.contains('reset-group-btn')) {
				const groupType = event.target.dataset.groupType;
				resetGroupEliminationPhase(groupType);
			}

			// Logique pour le bouton "Lien Arbitre"
			const arbitreBtn = event.target.closest('.arbitre-link-btn');
			if (arbitreBtn) {
				const link = arbitreBtn.dataset.link;
				navigator.clipboard.writeText(link).then(() => {
					showToast('Lien copié dans le presse-papiers !');
				}, () => {
					showToast('Erreur lors de la copie du lien.', 'error');
				});
				
				const messageContent = document.createElement('div');
				messageContent.innerHTML = `<p class="text-gray-700">Partagez ce lien avec l'arbitre du match :</p><input type="text" readonly class="w-full p-2 mt-2 bg-gray-100 border rounded" value="${link}">`;
				
				showModal('Lien de Saisie pour l\'Arbitre', messageContent, () => {}, false, false);
				document.getElementById('modalConfirmBtn').textContent = 'OK';
			}
			
		});
    }

    function renderClassementsPage() {
        APP_CONTAINER.innerHTML = `
            <h1 class="text-3xl font-bold text-center text-gray-800 mb-8">Classements du Tournoi</h1>

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">Classement Général des Équipes</h2>
                <p class="text-gray-600 mb-4">Ce classement est basé sur les points accumulés et la différence de score de toutes les phases de brassage (initiales et secondaires).</p>

                <div id="rankingsDisplay" class="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-100">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-lg">Rang</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom de l'équipe</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points Totaux</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-lg">Diff. Score Totale</th>
                            </tr>
                        </thead>
                        <tbody id="rankingsTableBody" class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td colspan="4" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                    Aucune donnée de classement disponible. Générez et complétez les phases de brassage.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p id="rankingsMessage" class="mt-3 text-sm text-center text-gray-600"></p>
            </section>

            <section class="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">Détails des Scores par Phase de Brassage</h2>
                <div class="mb-4 flex items-center justify-start space-x-2">
                    <input type="checkbox" id="togglePhaseDetails" class="form-checkbox h-4 w-4 text-blue-600">
                    <label for="togglePhaseDetails" class="text-gray-700 text-sm">Afficher les détails par phase</label>
                </div>
                <div id="phaseDetailsDisplay" class="space-y-6">
                    <p class="text-gray-500 text-center">Activez "Afficher les détails par phase" pour voir les scores par phase.</p>
                </div>
            </section>
        `;
        setupClassementsPageLogic();
    }
    function setupClassementsPageLogic() {
        const rankingsTableBody = document.getElementById('rankingsTableBody');
        const rankingsMessage = document.getElementById('rankingsMessage');
        const togglePhaseDetailsCheckbox = document.getElementById('togglePhaseDetails');
        const phaseDetailsDisplay = document.getElementById('phaseDetailsDisplay');

        function renderRankings() {
            const globalRankings = getGlobalRankings(AppState.teamTournament.allTeams, AppState.teamTournament.allBrassagePhases);

            if (globalRankings.length === 0) {
                rankingsTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            Aucune donnée de classement disponible. Générez et complétez les phases de brassage.
                        </td>
                    </tr>
                `;
                rankingsMessage.textContent = "Aucune équipe classée pour le moment.";
                return;
            }

            rankingsTableBody.innerHTML = globalRankings.map((rankEntry, index) => {
                const teamName = escapeHtml(rankEntry.teamObject.name);
                const isEliminated = AppState.teamTournament.eliminatedTeams.has(rankEntry.teamObject.id);
                const teamClass = isEliminated ? 'line-through text-red-600' : 'text-gray-900';
                const eliminatedText = isEliminated ? ' (Éliminée)' : '';

                return `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${index + 1}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm ${teamClass}">${teamName}${eliminatedText}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${rankEntry.totalPoints}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${rankEntry.totalDiffScore}</td>
                    </tr>
                `;
            }).join('');

            rankingsMessage.textContent = `Classement général des ${globalRankings.length} équipes.`;

            renderPhaseDetailsSection(globalRankings);
        }

        function renderPhaseDetailsSection(globalRankings) {
            phaseDetailsDisplay.innerHTML = '';
            if (!togglePhaseDetailsCheckbox.checked) {
                phaseDetailsDisplay.innerHTML = '<p class="text-gray-500 text-center">Activez "Afficher les détails par phase" pour voir les scores par phase.</p>';
                return;
            }

            const relevantPhases = AppState.teamTournament.allBrassagePhases.filter(p => p.type === PHASE_TYPE_INITIAL || p.type === PHASE_TYPE_SECONDARY_BRASSAGE);

            if (relevantPhases.length === 0) {
                phaseDetailsDisplay.innerHTML = '<p class="text-gray-500 text-center">Aucune phase de brassage avec des détails à afficher.</p>';
                return;
            }

            relevantPhases.sort((a, b) => a.timestamp - b.timestamp);

            relevantPhases.forEach(phase => {
                const phaseDiv = document.createElement('div');
                phaseDiv.className = 'bg-white p-4 rounded-lg shadow-md border border-gray-200';
                phaseDiv.innerHTML = `
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">${escapeHtml(phase.name)}</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Équipe</th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diff. Score</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                </tbody>
                        </table>
                    </div>
                `;
                const tbody = phaseDiv.querySelector('tbody');

                const teamsInPhase = globalRankings.filter(rankEntry => rankEntry.detailsByPhase[phase.id]);

                if (teamsInPhase.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="3" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                Aucune équipe n'a participé ou n'a de score dans cette phase.
                            </td>
                        </tr>
                    `;
                } else {
                    teamsInPhase.sort((a, b) => {
                        const statsA = a.detailsByPhase[phase.id] || { points: 0, diffScore: 0 };
                        const statsB = b.detailsByPhase[phase.id] || { points: 0, diffScore: 0 };
                        if (statsB.points !== statsA.points) return statsB.points - statsA.points;
                        return statsB.diffScore - statsA.diffScore;
                    });

                    tbody.innerHTML = teamsInPhase.map(rankEntry => {
                        const stats = rankEntry.detailsByPhase[phase.id] || { points: 0, diffScore: 0 };
                        const teamName = escapeHtml(rankEntry.teamObject.name);
                        return `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${teamName}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${stats.points}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${stats.diffScore}</td>
                            </tr>
                        `;
                    }).join('');
                }
                phaseDetailsDisplay.appendChild(phaseDiv);
            });
        }

        togglePhaseDetailsCheckbox.addEventListener('change', renderPhaseDetailsSection.bind(null, getGlobalRankings(AppState.teamTournament.allTeams, AppState.teamTournament.allBrassagePhases)));
        renderRankings();
    }

    function renderTournamentDashboard() {
		if (AppState.isGuestMode) {
			window.location.hash = '#home';
			return;
		}
		APP_CONTAINER.innerHTML = `
			<div class="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md mt-10">
				<h1 class="text-3xl font-bold text-center text-gray-800 mb-6">Mes Tournois</h1>

				<section class="mb-8 p-6 bg-gray-50 rounded-lg border">
					<h2 class="text-2xl font-semibold text-gray-700 mb-4">Créer un Nouveau Tournoi</h2>

					<div class="mb-4">
						<label class="block text-sm font-medium text-gray-700 mb-2">Type de Tournoi</label>
						<div class="flex gap-4" id="tournament-type-selector">
							<label class="flex items-center"><input type="radio" name="tournamentType" value="equipe" class="form-radio" checked> <span class="ml-2">Par Équipes</span></label>
							<label class="flex items-center"><input type="radio" name="tournamentType" value="melee" class="form-radio"> <span class="ml-2">À la Mêlée</span></label>
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
						<div>
							<label for="newTournamentName" class="block text-sm font-medium">Nom du Tournoi</label>
							<input type="text" id="newTournamentName" class="w-full p-2 border rounded-md">
						</div>
						<div>
							<label for="newTournamentDate" class="block text-sm font-medium">Date</label>
							<input type="date" id="newTournamentDate" class="w-full p-2 border rounded-md">
						</div>

						<div id="numTeams-input-container" class="md:col-span-2">
							<label for="newTournamentNumTeams" class="block text-sm font-medium text-gray-700 mb-1">Nombre d'équipes prévues</label>
							<input type="number" id="newTournamentNumTeams" min="2" value="10" placeholder="Nombre d'équipes"
								   class="w-full p-2 border border-gray-300 rounded-md shadow-sm">
						</div>

						<div class="md:col-span-2">
							<button id="createTournamentBtn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Créer le Tournoi</button>
						</div>
					</div>
				</section>

				<section class="p-6 bg-gray-50 rounded-lg border">
					<h2 class="text-2xl font-semibold text-gray-700 mb-4">Tournois par Équipes</h2>
					<div id="teamTournamentsList" class="space-y-3"></div>
					<hr class="my-6">
					<h2 class="text-2xl font-semibold text-gray-700 mb-4">Tournois à la Mêlée</h2>
					<div id="meleeTournamentsList" class="space-y-3"></div>
				</section>
			</div>`;
		setupTournamentDashboardLogic();
	}

    function showEditTournamentModal(tournament) {
        const formDiv = document.createElement('div');
        const currentTeamCount = tournament.allTeams ? tournament.allTeams.length : 0;

        formDiv.innerHTML = `
            <div class="space-y-4">
                <div>
                    <label for="editTournamentName" class="block text-sm font-medium text-gray-700">Nom du Tournoi</label>
                    <input type="text" id="editTournamentName" class="mt-1 w-full p-2 border rounded-md" value="${escapeHtml(tournament.name)}">
                </div>
                <div>
                    <label for="editTournamentDate" class="block text-sm font-medium text-gray-700">Date</label>
                    <input type="date" id="editTournamentDate" class="mt-1 w-full p-2 border rounded-md" value="${escapeHtml(tournament.date)}">
                </div>
                <div>
                    <label for="editNumTeamsAllowed" class="block text-sm font-medium text-gray-700">Nombre d'équipes maximum</label>
                    <input type="number" id="editNumTeamsAllowed" min="${currentTeamCount}" class="mt-1 w-full p-2 border rounded-md" value="${escapeHtml(tournament.numTeamsAllowed || currentTeamCount)}">
                    <p class="text-xs text-gray-500 mt-1">Ne peut pas être inférieur au nombre d'équipes déjà inscrites (${currentTeamCount}).</p>
                </div>
            </div>
        `;

        showModal(`Modifier le tournoi "${escapeHtml(tournament.name)}"`, formDiv, () => {
            const newName = document.getElementById('editTournamentName').value.trim();
            const newDate = document.getElementById('editTournamentDate').value;
            const newNumTeams = parseInt(document.getElementById('editNumTeamsAllowed').value);

            updateTournamentDetails(tournament.id, newName, newDate, newNumTeams);
        });
    }

	async function updateTournamentDetails(tournamentId, newName, newDate, newNumTeams) {
        const tournamentRef = getTournamentDataRef(tournamentId);
        const tournamentToUpdate = AppState.auth.allUserTournaments.find(t => t.id === tournamentId);
        const currentTeamCount = tournamentToUpdate?.allTeams?.length || 0;

        if (!newName || !newDate || isNaN(newNumTeams) || newNumTeams < currentTeamCount) {
            showToast("Données invalides. Assurez-vous que tous les champs sont remplis et que le nombre d'équipes n'est pas inférieur au nombre actuel.", "error");
            return;
        }

        try {
            await window.updateDoc(tournamentRef, {
                name: newName,
                date: newDate,
                numTeamsAllowed: newNumTeams
            });
            showToast("Tournoi mis à jour avec succès !", "success");

            if (tournamentToUpdate) {
                tournamentToUpdate.name = newName;
                tournamentToUpdate.date = newDate;
                tournamentToUpdate.numTeamsAllowed = newNumTeams;
            }
            renderTournamentsList();

        } catch (error) {
            console.error("Erreur de mise à jour du tournoi :", error);
            showToast("Une erreur est survenue lors de la mise à jour.", "error");
        }
    }
    function setupTournamentDashboardLogic() {
		const newTournamentNameInput = document.getElementById('newTournamentName');
		const newTournamentDateInput = document.getElementById('newTournamentDate');
		const createTournamentBtn = document.getElementById('createTournamentBtn');
		const numTeamsInputContainer = document.getElementById('numTeams-input-container');
		const newTournamentNumTeamsInput = document.getElementById('newTournamentNumTeams');
		const tournamentTypeSelector = document.getElementById('tournament-type-selector');

		tournamentTypeSelector.addEventListener('change', (event) => {
			if (event.target.value === 'equipe') {
				numTeamsInputContainer.classList.remove('hidden');
			} else {
				numTeamsInputContainer.classList.add('hidden');
			}
		});

		if (!createTournamentBtn) return;

		createTournamentBtn.addEventListener('click', () => {
			const name = newTournamentNameInput.value.trim();
			const date = newTournamentDateInput.value;
			const type = document.querySelector('input[name="tournamentType"]:checked').value;

			let numTeams = null;
			if (type === 'equipe') {
				numTeams = parseInt(newTournamentNumTeamsInput.value);
			}
			createNewTournament(name, date, type, numTeams);
		});

		renderTournamentsList();
	}

	function renderTournamentsList() {
		const teamListDiv = document.getElementById('teamTournamentsList');
		const meleeListDiv = document.getElementById('meleeTournamentsList');
		if (!teamListDiv || !meleeListDiv) return;

		const teamTournaments = AppState.auth.allUserTournaments.filter(t => t.type === 'equipe');
		const meleeTournaments = AppState.auth.allUserTournaments.filter(t => t.type === 'melee');

		const drawList = (container, list, activeId) => {
			container.innerHTML = '';
			if (list.length === 0) {
				container.innerHTML = '<p class="text-gray-500 text-center">Aucun tournoi de ce type.</p>';
				return;
			}

			list.forEach(tournament => {
				const isSelected = tournament.id === activeId;
				const tourneyDiv = document.createElement('div');
				tourneyDiv.className = `flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-white border rounded-md shadow-sm ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`;

				tourneyDiv.innerHTML = `
					<div class="flex-grow">
						<p class="text-lg font-medium text-gray-800">${tournament.name} ${isSelected ? '<span class="text-blue-600 text-sm ml-2">(Actif)</span>' : ''}</p>
						<p class="text-sm text-gray-600">Date: ${tournament.date}</p>
					</div>
					<div class="flex space-x-2 mt-3 sm:mt-0">
						<button data-id="${tournament.id}" data-type="${tournament.type}" class="select-tournament-btn bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 text-sm transition ${isSelected ? 'opacity-50 cursor-not-allowed' : ''}" ${isSelected ? 'disabled' : ''}>
							Sélectionner
						</button>
						<button data-id="${tournament.id}" class="edit-tournament-btn bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 text-sm transition">Éditer</button>
						<button data-id="${tournament.id}" class="delete-tournament-btn bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 text-sm transition">Supprimer</button>
					</div>
				`;
				container.appendChild(tourneyDiv);
			});
		};

		drawList(teamListDiv, teamTournaments, AppState.auth.activeTeamTournamentId);
		drawList(meleeListDiv, meleeTournaments, AppState.auth.activeMeleeTournamentId);

		document.querySelectorAll('.select-tournament-btn').forEach(button => {
			button.addEventListener('click', (event) => {
				const { id, type } = event.target.dataset;
				selectTournament(id, type);
			});
		});

		document.querySelectorAll('.edit-tournament-btn').forEach(button => {
			button.addEventListener('click', (event) => {
				const tournamentToEdit = AppState.auth.allUserTournaments.find(t => t.id === event.target.dataset.id);
				if (tournamentToEdit) showEditTournamentModal(tournamentToEdit);
			});
		});

		document.querySelectorAll('.delete-tournament-btn').forEach(button => {
			button.addEventListener('click', (event) => deleteTournament(event.target.dataset.id));
		});
	}

    // --- Routage et Initialisation ---

   /**
	 * Gère les changements de hash dans l'URL pour la navigation.
	 */
	function handleLocationHash() {
		const path = window.location.hash.substring(1) || 'home';

		if (path.startsWith('melee')) {
			return;
		}

		updateNavLinksVisibility();
		updateTournamentDisplay();

		if (window.userId) {
			if (!AppState.auth.activeTeamTournamentId && !path.startsWith('tournaments') && !path.startsWith('account')) {
				window.location.hash = '#tournaments';
				return;
			}
		}

		switch (path) {
			case 'home': renderHomePage(); break;
			case 'equipes': renderEquipesPage(); break;
			case 'brassages': renderBrassagesPage(); break;
			case 'eliminatoires': renderEliminatoiresPage(); break;
			case 'classements': renderClassementsPage(); break;
			case 'elimination-selection': renderEliminationSelectionPage(); break;
			case 'tournaments': renderTournamentDashboard(); break;
			case 'account': renderAccountPage(); break;
			case 'auth':
				renderAuthPage(); // On appelle simplement la fonction qui affiche la page
				break;
			default:
				window.location.hash = AppState.isGuestMode ? '#home' : '#tournaments';
		}
	}

   // --- Initialisation de l'Application ---
	document.addEventListener('DOMContentLoaded', () => {
        window.onFirebaseReady = loadAllData;

        document.getElementById('logout-btn').addEventListener('click', async () => {
            if (window.signOut && window.auth) {
                await window.signOut(window.auth);
                showToast("Déconnexion réussie.", "info");
            }
        });

        document.getElementById('select-tournament-btn').addEventListener('click', () => {
            window.location.hash = '#tournaments';
        });

        document.getElementById('my-account-btn').addEventListener('click', () => {
            window.location.hash = '#account';
        });

        document.getElementById('modalCancelBtn').addEventListener('click', hideModal);

        window.addEventListener('hashchange', handleLocationHash);

		logoutBtn.addEventListener('click', async () => {
			if (typeof window.cleanupFirestoreListeners === 'function') {
				window.cleanupFirestoreListeners();
			}

			try {
				if (window.auth && window.signOut) {
					await window.signOut(window.auth);
				}
			} catch (error) {
				console.error("Erreur de déconnexion:", error);
				showToast("Erreur lors de la déconnexion.", "error");
			}
		});
    });

    onAuthStateChanged(auth, (user) => {
        console.log("État d'authentification changé. Utilisateur:", user ? user.uid : "aucun");
        loadAllData();
    });

    // Fonctions pour que les autres modules puissent lire l'état actuel
    window.getActiveTeamTournamentId = () => AppState.auth.activeTeamTournamentId;
    window.getActiveMeleeTournamentId = () => AppState.auth.activeMeleeTournamentId;
    window.getCurrentTournamentData = () => AppState.teamTournament.currentData;
	window.loadTournamentDataById = fetchAndListenToTournamentData;

})();

