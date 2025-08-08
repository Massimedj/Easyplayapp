// Contenu de : src/melee/pages/joueurs.js

// --- IMPORTATIONS ---
import { players, addPlayer, deletePlayer, updatePlayer, playerExists, clearAllPlayers, saveData } from '../shared/data.js';
import { showModal, showToast } from '../shared/ui.js';

// Référence au conteneur principal de l'application
const APP_CONTAINER = document.getElementById('app-container');

// Variables d'état pour le tri du tableau
let sortColumn = 'lastName'; // Colonne de tri par défaut
let sortDirection = 'asc';    // Direction par défaut : 'asc' ou 'desc'

/**
 * Fonction principale exportée, appelée par le routeur pour afficher la page.
 */
export function render() {
	const isLoggedIn = !!window.userId;
    const activeMeleeId = window.getActiveMeleeTournamentId ? window.getActiveMeleeTournamentId() : null;

    // Si on est connecté mais qu'aucun tournoi mêlée n'est actif, on redirige.
    if (isLoggedIn && !activeMeleeId) {
        window.location.hash = '#melee/accueil';
        return;
    }
    APP_CONTAINER.innerHTML = `
        <main class="p-8">
            <h2 class="text-3xl font-bold mb-6">Gestion des Joueurs</h2>

            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 class="text-2xl font-semibold text-gray-700 mb-4">Ajouter un Joueur</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label for="playerFirstName" class="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                        <input type="text" id="playerFirstName" placeholder="Prénom" class="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label for="playerLastName" class="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                        <input type="text" id="playerLastName" placeholder="Nom" class="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label for="playerGender" class="block text-sm font-medium text-gray-700 mb-1">Sexe</label>
                        <select id="playerGender" class="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            <option>Homme</option>
                            <option>Femme</option>
                            <option>Autre</option>
                        </select>
                    </div>
                    <div>
                        <label for="playerLevel" class="block text-sm font-medium text-gray-700 mb-1">Niveau (1-10)</label>
                        <input type="number" id="playerLevel" min="1" max="10" value="5" class="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div class="md:col-span-4">
                        <button id="addPlayerBtn" class="w-full bg-teal-600 text-white py-2 px-4 rounded-md hover:bg-teal-700 shadow-md">
                            Ajouter le joueur
                        </button>
                    </div>
                </div>
            </section>
            
            <section class="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 class="text-2xl font-semibold text-gray-700 mb-4">Importer des Joueurs depuis Excel</h3>
                <div class="flex flex-col sm:flex-row items-center gap-4">
                    <input type="file" id="excelFileInput" accept=".xlsx, .xls" class="block w-full text-sm text-gray-700
                        file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                        file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700
                        hover:file:bg-teal-100" />
                    <button id="importPlayersBtn" class="w-full sm:w-auto bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 shadow-md">
                        Importer les joueurs
                    </button>
                </div>
                <p class="text-xs text-gray-600 mt-2">
                    Le fichier doit contenir les colonnes : "Prénom", "Nom", "Sexe", "Niveau".
                </p>
            </section>

            <section class="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div class="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
                    <h3 class="text-2xl font-semibold text-gray-700">
                        Liste des Joueurs (<span id="playerCount">0</span>)
                    </h3>
                    <button id="clearPlayersBtn" class="bg-red-600 text-white py-1 px-3 rounded-md hover:bg-red-700 text-sm self-start md:self-center">
                        Effacer tous les joueurs
                    </button>
                </div>
                
                <div id="playerSummary" class="mb-4 p-4 bg-white rounded-md border text-sm text-gray-700"></div>
                <div id="playersList" class="overflow-x-auto">
                    <p class="text-gray-500 text-center">Aucun joueur ajouté pour le moment.</p>
                </div>
            </section>
        </main>
    `;
    setupLogic();
}

/**
 * Attache les écouteurs d'événements aux éléments de la page.
 */
function setupLogic() {
    const playerFirstNameInput = document.getElementById('playerFirstName');
    const playerLastNameInput = document.getElementById('playerLastName');
    const playerGenderInput = document.getElementById('playerGender');
    const playerLevelInput = document.getElementById('playerLevel');
    const addPlayerBtn = document.getElementById('addPlayerBtn');
    const clearPlayersBtn = document.getElementById('clearPlayersBtn');
    const excelFileInput = document.getElementById('excelFileInput');
    const importPlayersBtn = document.getElementById('importPlayersBtn');
    
    addPlayerBtn.addEventListener('click', () => {
        const firstName = playerFirstNameInput.value.trim();
        const lastName = playerLastNameInput.value.trim();
        const gender = playerGenderInput.value;
        const level = parseInt(playerLevelInput.value);

        if (!firstName || !lastName || isNaN(level) || level < 1 || level > 10) {
            showToast("Veuillez remplir tous les champs et choisir un niveau valide.", 'error');
            return;
        }
        if (playerExists(firstName, lastName)) {
            showToast(`Un joueur nommé "${firstName} ${lastName}" existe déjà.`, 'error');
            return;
        }
        
        addPlayer(firstName, lastName, gender, level);
        
        renderPlayersList();
        updatePlayerSummary();
        showToast(`Joueur "${firstName} ${lastName}" ajouté.`, 'success');
		window.updateMeleeNavDisplay();

        playerFirstNameInput.value = '';
        playerLastNameInput.value = '';
        playerLevelInput.value = '5';
        playerFirstNameInput.focus();
    });
    
    clearPlayersBtn.addEventListener('click', () => {
        if (players.length === 0) {
            showToast("La liste est déjà vide.", 'info');
            return;
        }
        const messageContent = document.createElement('p');
        messageContent.textContent = "Êtes-vous sûr de vouloir supprimer TOUS les joueurs ? Cette action est irréversible.";
        messageContent.className = 'text-gray-700';

        showModal('Vider la liste des joueurs', messageContent, () => {
            clearAllPlayers();
            renderPlayersList();
            updatePlayerSummary();
            showToast("Tous les joueurs ont été supprimés.", 'success');
			window.updateMeleeNavDisplay();
        }, true);
    });

    importPlayersBtn.addEventListener('click', () => {
        const file = excelFileInput.files[0];
        if (!file) {
            showToast("Veuillez sélectionner un fichier Excel.", 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                let importedCount = 0;
                let skippedCount = 0;
                let playersToImport = [];

                json.forEach(row => {
                    const firstName = row['Prénom'] || row['prenom'] || row['First Name'];
                    const lastName = row['Nom'] || row['nom'] || row['Last Name'];
                    const gender = row['Sexe'] || row['sexe'] || row['Gender'];
                    const level = parseInt(row['Niveau'] || row['niveau'] || row['Level']);

                    if (firstName && lastName && gender && !isNaN(level) && level >= 1 && level <= 10) {
                        const alreadyExists = playerExists(firstName.trim(), lastName.trim()) || playersToImport.some(p => p.firstName.trim().toLowerCase() === firstName.trim().toLowerCase() && p.lastName.trim().toLowerCase() === lastName.trim().toLowerCase());
                        if (alreadyExists) {
                            skippedCount++;
                        } else {
                            playersToImport.push({ firstName: firstName.trim(), lastName: lastName.trim(), gender, level });
                            importedCount++;
                        }
                    } else {
                        skippedCount++;
                    }
                });

                if (playersToImport.length > 0) {
                    playersToImport.forEach(p => addPlayer(p.firstName, p.lastName, p.gender, p.level));
                }
                
                renderPlayersList();
                updatePlayerSummary();
                const message = `${importedCount} joueur(s) importé(s). ${skippedCount > 0 ? `${skippedCount} ligne(s) ignorée(s).` : ''}`;
                showToast(message, importedCount > 0 ? 'success' : 'info');
				window.updateMeleeNavDisplay();

            } catch (error) {
                console.error("Erreur Excel:", error);
                showToast("Erreur lors de la lecture du fichier.", 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    });

    renderPlayersList();
    updatePlayerSummary();
}

/**
 * Affiche la liste des joueurs dans un tableau triable.
 */
function renderPlayersList() {
    const playersListDiv = document.getElementById('playersList');
    const playerCountSpan = document.getElementById('playerCount');
    playerCountSpan.textContent = players.length;

    if (players.length === 0) {
        playersListDiv.innerHTML = '<p class="text-gray-500 text-center">Aucun joueur ajouté pour le moment.</p>';
        return;
    }

    const sortedPlayers = [...players].sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        const direction = sortDirection === 'asc' ? 1 : -1;

        if (typeof valA === 'string') {
            return valA.localeCompare(valB) * direction;
        } else {
            return (valA - valB) * direction;
        }
    });

    playersListDiv.innerHTML = `
        <table class="min-w-full bg-white border border-gray-200">
            <thead class="bg-gray-100">
                <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200" data-sort="firstName">Prénom <span id="sort-icon-firstName"></span></th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200" data-sort="lastName">Nom <span id="sort-icon-lastName"></span></th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200" data-sort="gender">Sexe <span id="sort-icon-gender"></span></th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200" data-sort="level">Niveau <span id="sort-icon-level"></span></th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                ${sortedPlayers.map(player => `
                    <tr>
                        <td class="px-4 py-2 whitespace-nowrap">${player.firstName}</td>
                        <td class="px-4 py-2 whitespace-nowrap">${player.lastName}</td>
                        <td class="px-4 py-2 whitespace-nowrap">${player.gender}</td>
                        <td class="px-4 py-2 whitespace-nowrap text-center">${player.level}</td>
                        <td class="px-4 py-2 whitespace-nowrap">
                            <button data-id="${player.id}" class="edit-player-btn text-blue-600 hover:text-blue-800 text-sm mr-4">Éditer</button>
                            <button data-id="${player.id}" class="delete-player-btn text-red-600 hover:text-red-800 text-sm">Supprimer</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const iconSpan = document.getElementById(`sort-icon-${sortColumn}`);
    if (iconSpan) {
        iconSpan.innerHTML = sortDirection === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
    }

    attachListEventListeners();
}

/**
 * Met à jour le bloc de résumé (par sexe et niveau).
 */
function updatePlayerSummary() {
    const summaryDiv = document.getElementById('playerSummary');
    if (!summaryDiv) return;
    if (players.length === 0) {
        summaryDiv.innerHTML = "Aucun joueur à résumer.";
        return;
    }
    const genderCounts = { 'Homme': 0, 'Femme': 0, 'Autre': 0 };
    const levelCounts = {};
    players.forEach(player => {
        genderCounts[player.gender] = (genderCounts[player.gender] || 0) + 1;
        levelCounts[player.level] = (levelCounts[player.level] || 0) + 1;
    });
    let summaryHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-2"><div><strong class="font-semibold">Par Sexe:</strong><ul>`;
    for (const gender in genderCounts) {
        if (genderCounts[gender] > 0) summaryHTML += `<li>${gender}: ${genderCounts[gender]}</li>`;
    }
    summaryHTML += `</ul></div><div><strong class="font-semibold">Par Niveau:</strong><ul>`;
    Object.keys(levelCounts).sort((a, b) => a - b).forEach(level => {
        summaryHTML += `<li>Niveau ${level}: ${levelCounts[level]}</li>`;
    });
    summaryHTML += `</ul></div></div>`;
    summaryDiv.innerHTML = summaryHTML;
}

/**
 * Attache les écouteurs pour les boutons et les en-têtes de tri.
 */
function attachListEventListeners() {
    document.querySelectorAll('.delete-player-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const playerId = event.target.dataset.id;
            const player = players.find(p => p.id === playerId);
            if (!player) return;
            const messageContent = document.createElement('p');
            messageContent.textContent = `Êtes-vous sûr de vouloir supprimer le joueur "${player.firstName} ${player.lastName}" ?`;
            messageContent.className = 'text-gray-700';
            showModal('Confirmer la suppression', messageContent, () => {
                deletePlayer(playerId);
                renderPlayersList();
                updatePlayerSummary();
                showToast('Joueur supprimé.', 'success');
				window.updateMeleeNavDisplay();
            }, true);
        });
    });
    
    document.querySelectorAll('.edit-player-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            showEditPlayerModal(event.target.dataset.id);
        });
    });

    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const newSortColumn = header.dataset.sort;
            if (sortColumn === newSortColumn) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = newSortColumn;
                sortDirection = 'asc';
            }
            renderPlayersList();
        });
    });
}

/**
 * Affiche la modale pour éditer un joueur.
 */
function showEditPlayerModal(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const formDiv = document.createElement('div');
    formDiv.innerHTML = `
        <div class="space-y-4">
            <div><label class="block text-sm">Prénom</label><input type="text" id="editFirstName" class="w-full p-2 border rounded" value="${player.firstName}"></div>
            <div><label class="block text-sm">Nom</label><input type="text" id="editLastName" class="w-full p-2 border rounded" value="${player.lastName}"></div>
            <div><label class="block text-sm">Sexe</label><select id="editGender" class="w-full p-2 border rounded"><option ${player.gender === 'Homme' ? 'selected' : ''}>Homme</option><option ${player.gender === 'Femme' ? 'selected' : ''}>Femme</option><option ${player.gender === 'Autre' ? 'selected' : ''}>Autre</option></select></div>
            <div><label class="block text-sm">Niveau</label><input type="number" id="editLevel" class="w-full p-2 border rounded" min="1" max="10" value="${player.level}"></div>
        </div>`;
    showModal(`Éditer ${player.firstName} ${player.lastName}`, formDiv, () => {
        const newFirstName = document.getElementById('editFirstName').value.trim();
        const newLastName = document.getElementById('editLastName').value.trim();
        const newGender = document.getElementById('editGender').value;
        const newLevel = parseInt(document.getElementById('editLevel').value);
        if (!newFirstName || !newLastName || isNaN(newLevel) || newLevel < 1 || newLevel > 10) {
            showToast("Veuillez vérifier que tous les champs sont correctement remplis.", 'error');
            return;
        }
        if (playerExists(newFirstName, newLastName, playerId)) {
            showToast(`Un autre joueur nommé "${newFirstName} ${newLastName}" existe déjà.`, 'error');
            return;
        }
        updatePlayer(playerId, { firstName: newFirstName, lastName: newLastName, gender: newGender, level: newLevel });
        renderPlayersList();
        updatePlayerSummary();
        showToast(`Joueur "${newFirstName} ${newLastName}" mis à jour.`, 'success');
		window.updateMeleeNavDisplay();
    });
}
