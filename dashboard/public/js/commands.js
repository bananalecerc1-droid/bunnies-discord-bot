console.log('Commands.js loaded'); // Debug log

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded'); // Debug log
    initializeToggles();
    initializeModals();
    initializeSearch();
});

function initializeToggles() {
    const toggles = document.querySelectorAll('.command-toggle');
    console.log('Found toggles:', toggles.length);

    toggles.forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const commandName = e.target.dataset.command;
            const enabled = e.target.checked;
            console.log('Toggling command:', commandName, enabled);

            try {
                const response = await fetch('/api/commands/toggle', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        command: commandName,
                        enabled: enabled
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to update command status');
                }

                console.log('Toggle response:', data);

                e.target.checked = data.settings.enabled;

                showToast(
                    data.settings.enabled ? 'Command enabled' : 'Command disabled',
                    'success'
                );

            } catch (error) {
                console.error('Toggle error:', error);
                e.target.checked = !enabled;
                showToast('Failed to update command status', 'error');
            }
        });
    });
}

function initializeModals() {
    const closeButtons = document.querySelectorAll('[data-modal-close]');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            closePermissionsModal();
        });
    });

    const saveButtons = document.querySelectorAll('[data-modal-save]');
    saveButtons.forEach(button => {
        button.addEventListener('click', () => {
            savePermissions();
        });
    });
}

function initializeSearch() {
    const searchInput = document.getElementById('commandSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const commandCards = document.querySelectorAll('.command-card');
        
        commandCards.forEach(card => {
            const commandName = card.dataset.command.toLowerCase();
            const description = card.querySelector('p').textContent.toLowerCase();
            const aliases = Array.from(card.querySelectorAll('.bg-blue-100'))
                .map(alias => alias.textContent.trim().toLowerCase());
            
            const matchesQuery = 
                commandName.includes(query) || 
                description.includes(query) || 
                aliases.some(alias => alias.includes(query));
            
            card.style.display = matchesQuery ? 'block' : 'none';
        });
    });
}

let currentCommand = null;
let currentAliases = [];

async function openPermissionsModal(commandName) {
    console.log('Opening modal for:', commandName);
    currentCommand = commandName;
    const modal = document.getElementById('permissionsModal');
    
    if (!modal) {
        console.error('Modal element not found');
        return;
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const modalCommandName = document.getElementById('modalCommandName');
    if (modalCommandName) {
        modalCommandName.textContent = commandName;
    }

    try {
        await loadRoles();
        
        const response = await fetch(`/api/commands/${commandName}/settings`);
        const settings = await response.json();
        
        currentAliases = settings.aliases || [];
        updateAliasesList();
        
        const enabledRoles = document.getElementById('enabledRoles');
        const disabledRoles = document.getElementById('disabledRoles');
        
        if (enabledRoles && settings.permissions) {
            Array.from(enabledRoles.options).forEach(option => {
                option.selected = settings.permissions.enabledRoleIds.includes(option.value);
            });
        }
        
        if (disabledRoles && settings.permissions) {
            Array.from(disabledRoles.options).forEach(option => {
                option.selected = settings.permissions.disabledRoleIds.includes(option.value);
            });
        }
    } catch (error) {
        console.error('Error loading command settings:', error);
        showToast('Failed to load command settings', 'error');
    }
}

async function loadRoles() {
    try {
        const response = await fetch('/api/roles');
        const roles = await response.json();
        
        const enabledSelect = document.getElementById('enabledRoles');
        const disabledSelect = document.getElementById('disabledRoles');
        
        if (!enabledSelect || !disabledSelect) {
            console.error('Role select elements not found');
            return;
        }

        enabledSelect.innerHTML = '';
        disabledSelect.innerHTML = '';
        
        roles.forEach(role => {
            const option1 = new Option(role.name, role.id);
            const option2 = new Option(role.name, role.id);
            
            if (role.color !== null && role.color !== undefined) {
                const hexColor = '#' + role.color.toString(16).padStart(6, '0');
                option1.style.color = hexColor;
                option2.style.color = hexColor;
                option1.dataset.roleColor = hexColor;
                option2.dataset.roleColor = hexColor;
            }
            
            enabledSelect.add(option1);
            disabledSelect.add(option2);
        });
    } catch (error) {
        console.error('Error loading roles:', error);
        showToast('Failed to load roles', 'error');
    }
}

function updateAliasesList() {
    const aliasesList = document.getElementById('aliasesList');
    if (!aliasesList) return;

    aliasesList.innerHTML = '';
    
    currentAliases.forEach(alias => {
        const tag = document.createElement('div');
        tag.className = 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm flex items-center';
        tag.innerHTML = `
            ${alias}
            <button onclick="removeAlias('${alias}')" class="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200">
                <i class="fas fa-times"></i>
            </button>
        `;
        aliasesList.appendChild(tag);
    });
}

function addAlias() {
    const input = document.getElementById('newAlias');
    const alias = input.value.trim();
    
    if (alias && !currentAliases.includes(alias)) {
        currentAliases.push(alias);
        updateAliasesList();
        input.value = '';
    }
}

function removeAlias(alias) {
    currentAliases = currentAliases.filter(a => a !== alias);
    updateAliasesList();
}

async function savePermissions() {
    if (!currentCommand) return;

    const enabledRoles = Array.from(document.getElementById('enabledRoles').selectedOptions).map(o => o.value);
    const disabledRoles = Array.from(document.getElementById('disabledRoles').selectedOptions).map(o => o.value);

    try {
        const response = await fetch(`/api/commands/${currentCommand}/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                aliases: currentAliases,
                permissions: {
                    enabledRoleIds: enabledRoles,
                    disabledRoleIds: disabledRoles
                }
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save settings');

        showToast('Settings saved successfully', 'success');
        closePermissionsModal();
        
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        console.error('Save settings error:', error);
        showToast('Failed to save settings', 'error');
    }
}

function closePermissionsModal() {
    const modal = document.getElementById('permissionsModal');
    if (!modal) return;
    
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    currentCommand = null;
    currentAliases = [];
}

window.openPermissionsModal = openPermissionsModal;
window.closePermissionsModal = closePermissionsModal;
window.savePermissions = savePermissions;
window.addAlias = addAlias;
window.removeAlias = removeAlias;

document.addEventListener('DOMContentLoaded', () => {
    initializeToggles();
    
    const modal = document.getElementById('permissionsModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closePermissionsModal();
            }
        });
    }
});

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    } transition-all transform translate-y-0 opacity-100 z-50`;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
