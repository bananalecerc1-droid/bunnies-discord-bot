document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing giveaway page...');
    initializeGiveawaySystem();
    initializeSaveBar();
    updateGiveawayStats();
});

function initializeGiveawaySystem() {
    const systemToggle = document.getElementById('giveaway-enabled');
    if (systemToggle) {
        systemToggle.addEventListener('change', () => {
            showSaveBar();
            updateGiveawayStats();
        });
    }

    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            showSaveBar();
            updateGiveawayStats();
        });
    });

    const resetBtn = document.getElementById('resetGiveawaySettings');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all giveaway settings?')) {
                window.location.reload();
            }
        });
    }

    const saveBtn = document.getElementById('saveGiveawaySettings');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveGiveawaySettings);
    }
}

function collectGiveawaySettings() {
    return {
        enabled: document.getElementById('giveaway-enabled')?.checked || false,
        interaction: 'buttons',
        defaultDuration: parseInt(document.getElementById('giveaway-default-duration')?.value || '1') * 3600000,
        maxDuration: parseInt(document.getElementById('giveaway-max-duration')?.value || '1') * 86400000,
        minWinners: parseInt(document.getElementById('giveaway-min-winners')?.value || '1'),
        maxWinners: parseInt(document.getElementById('giveaway-max-winners')?.value || '10'),
        buttons: {
            enter: document.getElementById('giveaway-button-enter')?.value || 'Enter Giveaway',
            leave: document.getElementById('giveaway-button-leave')?.value || 'Leave Giveaway',
            reroll: document.getElementById('giveaway-button-reroll')?.value || 'Reroll Winners',
            end: document.getElementById('giveaway-button-end')?.value || 'End Giveaway'
        },
        embed: {
            color: document.getElementById('giveaway-embed-color')?.value || '#FF69B4',
            thumbnail: document.getElementById('giveaway-embed-thumbnail')?.value || '',
            footer: document.getElementById('giveaway-embed-footer')?.value || ''
        },
        allowedChannels: Array.from(document.getElementById('giveaway-allowed-channels')?.selectedOptions || [])
            .map(option => option.value),
        blacklistedChannels: Array.from(document.getElementById('giveaway-blacklisted-channels')?.selectedOptions || [])
            .map(option => option.value),
        allowedRoles: Array.from(document.getElementById('giveaway-allowed-roles')?.selectedOptions || [])
            .map(option => option.value),
        blacklistedRoles: Array.from(document.getElementById('giveaway-blacklisted-roles')?.selectedOptions || [])
            .map(option => option.value),
        minimumAccountAge: parseInt(document.getElementById('giveaway-min-account-age')?.value || '0') * 86400000,
        minimumGuildAge: parseInt(document.getElementById('giveaway-min-guild-age')?.value || '0') * 86400000
    };
}

async function saveGiveawaySettings() {
    try {
        const settings = collectGiveawaySettings();
        
        const response = await fetch('/api/giveaway/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to save settings');

        showToast('Giveaway settings saved successfully', 'success');
        hideSaveBar();
    } catch (error) {
        console.error('Error saving giveaway settings:', error);
        showToast('Failed to save giveaway settings', 'error');
    }
}

function updateGiveawayStats() {
    document.getElementById('activeGiveaways').textContent = '0';

    document.getElementById('totalWinners').textContent = '0';

    const defaultDuration = parseInt(document.getElementById('giveaway-default-duration')?.value || '24');
    document.getElementById('avgDuration').textContent = `${defaultDuration}h`;

    document.getElementById('totalParticipants').textContent = '0';
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
