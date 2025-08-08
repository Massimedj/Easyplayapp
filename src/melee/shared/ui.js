// Contenu de : src/melee/shared/ui.js

// --- Références aux éléments de la modale (version complète) ---
const actionModal = document.getElementById('actionModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCancelBtn = document.getElementById('modalCancelBtn');
let modalConfirmBtn = document.getElementById('modalConfirmBtn');


export function showModal(title, bodyContent, confirmCallback, isDelete = false, showCancelBtn = true) {
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

    if (showCancelBtn) {
        modalCancelBtn.classList.remove('hidden');
        modalCancelBtn.onclick = hideModal;
    } else {
        modalCancelBtn.classList.add('hidden');
    }
}

export function hideModal() {
    actionModal.classList.add('hidden');
    modalBody.innerHTML = '';
    if (modalConfirmBtn) modalConfirmBtn.onclick = null;
    if (modalCancelBtn) modalCancelBtn.onclick = null;
}

export function showToast(message, type = 'info', duration = 3000) {
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