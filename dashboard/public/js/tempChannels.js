document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing temp channels page...');
    initializeTempChannelsSystem();
    initializeSaveBar();
    updateTempChannelsStats();
});

function initializeTempChannelsSystem() {
    const systemToggle = document.getElementById('tempchannels-enabled');
    if (systemToggle) {
        systemToggle.addEventListener('change', () => {
            showSaveBar();
            updateTempChannelsStats();
        });
    }

    const inputs = document.querySelectorAll('input:not([type="checkbox"])');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            showSaveBar();
            updateTempChannelsStats();
        });
    });

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            showSaveBar();
            updateTempChannelsStats();
        });
    });

    const singleSelects = document.querySelectorAll('select:not([multiple])');
    singleSelects.forEach(select => {
        select.addEventListener('change', () => {
            showSaveBar();
            updateTempChannelsStats();
        });
    });

    const multiSelects = document.querySelectorAll('select[multiple]');
    multiSelects.forEach(select => {
        select.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'OPTION') {
                e.preventDefault(); // Prevent default selection behavior
                
                const option = e.target;
                const isCtrlPressed = e.ctrlKey || e.metaKey;
                
                if (!isCtrlPressed) {
                    Array.from(select.options).forEach(opt => {
                        if (opt !== option) opt.selected = false;
                    });
                }
                
                option.selected = !option.selected;
                
                select.dispatchEvent(new Event('change'));
                return false;
            }
        });

        select.addEventListener('change', () => {
            showSaveBar();
            updateTempChannelsStats();
        });
    });

    const resetBtn = document.getElementById('resetTempChannelsSettings');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all temporary channels settings?')) {
                window.location.reload();
            }
        });
    }

    const saveBtn = document.getElementById('saveTempChannelsSettings');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveTempChannelsSettings);
    }
}

function collectTempChannelsSettings() {
    return {
        enabled: document.getElementById('tempchannels-enabled')?.checked || false,
        parentChannelId: document.getElementById('tempchannels-parent-channel')?.value || '',
        category: document.getElementById('tempchannels-category')?.value || '',
        defaultName: document.getElementById('tempchannels-default-name')?.value || '🔊 {user}\'s Channel',
        defaultUserLimit: parseInt(document.getElementById('tempchannels-user-limit')?.value || '0'),
        multipleAllowed: document.getElementById('tempchannels-multiple-allowed')?.checked || false,
        fullPermissions: document.getElementById('tempchannels-full-permissions')?.checked || false,
        deleteWhenEmpty: document.getElementById('tempchannels-delete-empty')?.checked || false,
        deleteDelay: parseInt(document.getElementById('tempchannels-delete-delay')?.value || '5') * 1000,
        permissions: {
            enabledRoleIds: Array.from(document.getElementById('tempchannels-allowed-roles')?.selectedOptions || [])
                .map(option => option.value),
            disabledRoleIds: Array.from(document.getElementById('tempchannels-blacklisted-roles')?.selectedOptions || [])
                .map(option => option.value)
        },
        userPermissions: {
            manage: [
                "ManageChannels",
                "ManageRoles",
                "MuteMembers",
                "DeafenMembers",
                "MoveMembers",
                "PrioritySpeaker",
                "Stream",
                "Connect",
                "Speak",
                "UseVAD",
                "ViewChannel"
            ]
        }
    };
}

async function saveTempChannelsSettings() {
    try {
        const settings = collectTempChannelsSettings();
        
        const response = await fetch('/api/tempchannels/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to save settings');

        const result = await response.json();
        if (result.success) {
            showToast('Temporary channels settings saved successfully', 'success');
            hideSaveBar();
        } else {
            throw new Error(result.error || 'Failed to save settings');
        }
    } catch (error) {
        console.error('Error saving temp channels settings:', error);
        showToast('Failed to save temporary channels settings', 'error');
    }
}

function updateTempChannelsStats() {
    document.getElementById('activeChannels').textContent = '0';

    document.getElementById('totalUsers').textContent = '0';

    document.getElementById('avgDuration').textContent = '0m';

    document.getElementById('totalCreated').textContent = '0';
}

function initializeSaveBar() {
    const saveBar = document.getElementById('saveBar');
    if (!saveBar) return;

    saveBar.classList.remove('show');

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const saveBtn = document.getElementById('saveTempChannelsSettings');
            if (saveBtn && saveBar.classList.contains('show')) {
                saveBtn.click();
            }
        }
    });
}

function showSaveBar() {
    const saveBar = document.getElementById('saveBar');
    if (saveBar) {
        saveBar.classList.add('show');
    }
}

function hideSaveBar() {
    const saveBar = document.getElementById('saveBar');
    if (saveBar) {
        saveBar.classList.remove('show');
    }
}

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
