console.log('Protection.js loading...');

document.addEventListener('DOMContentLoaded', () => {
    if (window.utils && window.utils.onPage) {
        utils.onPage('/protection', () => {
            console.log('Protection.js loaded');
            initializeProtectionToggles();
            initializeProtectionSliders();
            initializeProtectionButtons();
            initializeInputListeners();
            initializeRoleSelectors();
            initializeChannelSelectors();
            initializeWhitelistedBots();
            initializeActionTypes();
            initializeRealTimeUpdates();
            updateProtectionStats();
            initializeRangeSliderValueDisplays();
        });
    } else {
        if (window.location.pathname === '/protection') {
            console.log('Protection.js loaded');
            initializeProtectionToggles();
            initializeProtectionSliders();
            initializeProtectionButtons();
            initializeInputListeners();
            initializeRoleSelectors();
            initializeChannelSelectors();
            initializeWhitelistedBots();
            initializeActionTypes();
            initializeRealTimeUpdates();
            updateProtectionStats();
            initializeRangeSliderValueDisplays();
        }
    }
});

function initializeRangeSliderValueDisplays() {
    const sliders = document.querySelectorAll('input[type="range"]');
    if (!sliders || sliders.length === 0) return;
    
    sliders.forEach(slider => {
        if (!slider) return;
        slider.addEventListener('input', () => {
            const valueId = slider.id + '-value';
            const valueDisplay = document.getElementById(valueId);
            if (valueDisplay) {
                let displayValue = slider.value;
                if (slider.id.includes('timeWindow')) {
                    displayValue += 's';
                }
                valueDisplay.textContent = displayValue;
            }
        });
    });
}

function initializeProtectionToggles() {
    const toggles = document.querySelectorAll('.protection-toggle');
    if (!toggles || toggles.length === 0) {
        console.log('No protection toggles found');
        return;
    }
    
    console.log('Found protection toggles:', toggles.length);

    toggles.forEach(toggle => {
        if (!toggle) return;
        toggle.addEventListener('change', async (e) => {
            const section = e.target.dataset.section;
            const enabled = e.target.checked;
            console.log('Toggling protection:', section, enabled);

            try {
                const response = await fetch('/api/protection/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        section: section,
                        settings: { enabled: enabled }
                    })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to update protection');

                showToast(`${section} protection ${enabled ? 'enabled' : 'disabled'}`, 'success');
                updateProtectionStats();
            } catch (error) {
                console.error('Failed to toggle protection:', error);
                e.target.checked = !enabled;
                
                if (window.utils && utils.showToast) {
                    utils.showToast('error', 'Failed to toggle protection');
                } else {
                    showToast('Failed to toggle protection', 'error');
                }
            }
        });
    });
}

function initializeProtectionSliders() {
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        const valueDisplay = document.getElementById(`${slider.id}-value`);
        if (valueDisplay) {
            valueDisplay.textContent = slider.id.includes('timeWindow') ? 
                `${slider.value}s` : slider.value;
        }

        slider.addEventListener('input', (e) => {
            const valueId = `${e.target.id}-value`;
            const valueDisplay = document.getElementById(valueId);
            if (valueDisplay) {
                let displayValue = e.target.value;
                if (e.target.id.includes('timeWindow')) {
                    displayValue += 's';
                }
                valueDisplay.textContent = displayValue;
            }
            showSaveBar();
            updateProtectionStats();
        });
    });
}

function initializeProtectionButtons() {
    const saveButton = document.getElementById('saveProtectionSettings');
    if (saveButton) {
        saveButton.addEventListener('click', saveProtectionSettings);
    }

    const resetButton = document.getElementById('resetProtectionSettings');
    if (resetButton) {
        resetButton.addEventListener('click', resetProtectionSettings);
    }
}

function collectProtectionLimits(section) {
    const limits = {};
    const limitInputs = document.querySelectorAll(`[id^="${section}-"][id$="Limit"]`);
    
    limitInputs.forEach(input => {
        const limitName = input.id.replace(`${section}-`, '');
        limits[limitName] = parseInt(input.value);
    });

    const timeWindow = document.getElementById(`${section}-timeWindow`);
    if (timeWindow) {
        limits.timeWindow = parseInt(timeWindow.value) * 1000;
    }

    return limits;
}

function collectActionSettings(section) {
    const action = {
        type: document.getElementById(`${section}-actionType`)?.value || 'timeout',
        reason: `${section.charAt(0).toUpperCase() + section.slice(1)} Protection Triggered`,
        color: '#ff0000'
    };

    if (action.type === 'timeout') {
        const duration = document.getElementById(`${section}-duration`)?.value || 5;
        action.duration = parseInt(duration) * 60000;
    }

    const roleSelector = document.getElementById(`${section}-ignoredRoles`);
    if (roleSelector) {
        const selectedRoles = roleSelector.querySelectorAll('.selected-role');
        action.ignoredRoles = Array.from(selectedRoles).map(role => role.dataset.roleId);
    }
    if (section === 'role') {
        const protectedSelector = document.getElementById('role-protectedRoles');
        action.protectedRoles = Array.from(protectedSelector?.querySelectorAll('.selected-role') || [])
            .map(role => role.dataset.roleId);
        action.protectedRoleRemoveLimit = Math.max(1, parseInt(document.getElementById('role-protectedRoleRemoveLimit')?.value || '4', 10));
    }

    if (section === 'antibot') {
        const botsList = document.getElementById('whitelisted-bots-list');
        if (botsList) {
            const botItems = botsList.querySelectorAll('.bot-item');
        }
    }

    return action;
}

function collectProtectionSettings(section) {
    const settings = {
        enabled: document.getElementById(`${section}-enabled`)?.checked || false,
        limits: collectProtectionLimits(section),
        action: collectActionSettings(section),
        logChannel: document.getElementById(`${section}-logChannel`)?.value || ''
    };

    if (section === 'antibot') {
        settings.whitelistedBots = Array.from(
            document.getElementById('whitelisted-bots-list')?.querySelectorAll('.bot-item') || []
        ).map(item => item.dataset.botId);
    }

    return settings;
}

async function saveProtectionSettings() {
    try {
        const settings = {};
        settings.logChannelId = document.getElementById('protection-logChannel')?.value || '';

        const sections = ['antispam', 'server', 'antibot', 'role', 'channel', 'timeout', 'moderation'];

        sections.forEach(section => {
            settings[section] = {
                enabled: document.getElementById(`${section}-enabled`)?.checked || false,
                limits: collectProtectionLimits(section),
                action: collectActionSettings(section),
            };

            if (section === 'antispam') {
                const channelSelector = document.getElementById('antispam-ignoredChannels');
                if (channelSelector) {
                    const selectedChannels = channelSelector.querySelectorAll('.selected-channel');
                    settings[section].action.ignoredChannels = Array.from(selectedChannels).map(channel => channel.dataset.channelId);
                }
            }

            if (section === 'antibot') {
                const botsList = document.getElementById('whitelisted-bots-list');
                if (botsList) {
                    settings[section].whitelistedBots = Array.from(botsList.querySelectorAll('.bot-item'))
                        .map(item => item.dataset.botId);
                }
            }
        });

        console.log('Saving settings:', settings);

        const response = await fetch('/api/protection/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!response.ok) {
            throw new Error(`Failed to save settings: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            showToast('Settings saved successfully', 'success');
            hideSaveBar();
        } else {
            throw new Error(data.error || 'Failed to save settings');
        }
    } catch (error) {
        console.error('Save error:', error);
        showToast('Failed to save settings: ' + error.message, 'error');
    }
}

function resetProtectionSettings() {
    if (confirm('Are you sure you want to discard all unsaved changes?')) {
        window.location.reload();
    }
}

function updateProtectionStats() {
    const sections = ['antispam', 'server', 'antibot', 'role', 'channel', 'timeout', 'moderation'];
    
    const activeCount = sections.filter(section => 
        document.getElementById(`${section}-enabled`)?.checked
    ).length;
    document.getElementById('activeProtections').textContent = activeCount;

    const ignoredRoles = new Set();
    sections.forEach(section => {
        const roleSelector = document.getElementById(`${section}-ignoredRoles`);
        if (roleSelector) {
            const selectedRoles = roleSelector.querySelectorAll('.selected-role');
            selectedRoles.forEach(role => ignoredRoles.add(role.dataset.roleId));
        }
    });
    const totalRoles = document.querySelectorAll('.role-option').length;
    document.getElementById('protectedRoles').textContent = totalRoles - ignoredRoles.size;

    const whitelistedBots = document.getElementById('whitelisted-bots-list')?.querySelectorAll('.bot-item').length || 0;
    document.getElementById('whitelistedBots').textContent = whitelistedBots;

    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const valueDisplay = document.getElementById(`${slider.id}-value`);
        if (valueDisplay) {
            valueDisplay.textContent = slider.id.includes('timeWindow') ? 
                `${slider.value}s` : slider.value;
        }
    });
}

function showSaveBar() {
    document.getElementById('saveBar')?.classList.add('show');
}

function hideSaveBar() {
    document.getElementById('saveBar')?.classList.remove('show');
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

function handleActionTypeChange(section) {
    const actionType = document.getElementById(`${section}-actionType`).value;
    const durationContainer = document.getElementById(`${section}-duration-container`);
    const deleteDaysContainer = document.getElementById(`${section}-deleteDays-container`);

    if (durationContainer) {
        durationContainer.style.display = actionType === 'timeout' ? 'block' : 'none';
    }
    if (deleteDaysContainer) {
        deleteDaysContainer.style.display = actionType === 'ban' ? 'block' : 'none';
    }
}

function initializeActionTypes() {
    const sections = ['antispam', 'server', 'role', 'channel', 'timeout', 'moderation'];
    sections.forEach(section => {
        const actionSelect = document.getElementById(`${section}-actionType`);
        if (actionSelect) {
            actionSelect.addEventListener('change', () => {
                handleActionTypeChange(section);
                showSaveBar();
            });
            handleActionTypeChange(section);
        }
    });
}

function initializeInputListeners() {
    document.querySelectorAll('input, select').forEach(input => {
        ['input', 'change'].forEach(eventType => {
            input.addEventListener(eventType, () => {
                showSaveBar();
                updateProtectionStats();
            });
        });
    });

    document.querySelectorAll('select[multiple]').forEach(select => {
        select.addEventListener('change', () => {
            showSaveBar();
            updateProtectionStats();
        });
    });

    document.querySelectorAll('.role-selector').forEach(selector => {
        const observer = new MutationObserver(() => {
            showSaveBar();
            updateProtectionStats();
        });
        observer.observe(selector.querySelector('.selected-roles'), { 
            childList: true, 
            subtree: true 
        });
    });

    const botsList = document.getElementById('whitelisted-bots-list');
    if (botsList) {
        const observer = new MutationObserver(() => {
            showSaveBar();
            updateProtectionStats();
        });
        observer.observe(botsList, { 
            childList: true, 
            subtree: true 
        });
    }
}

function initializeRoleSelectors() {
    document.querySelectorAll('.role-selector').forEach(selector => {
        const selectedRoles = selector.querySelector('.selected-roles');
        
        selector.addEventListener('click', () => {
            selector.classList.toggle('active');
        });

        selector.querySelectorAll('.role-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const roleId = option.dataset.roleId;
                const roleName = option.dataset.roleName;
                
                const existingRole = selectedRoles.querySelector(`[data-role-id="${roleId}"]`);
                if (!existingRole) {
                    const roleElement = document.createElement('div');
                    roleElement.className = 'selected-role';
                    roleElement.dataset.roleId = roleId;
                    roleElement.innerHTML = `
                        <span>${roleName}</span>
                        <i class="fas fa-times remove-role"></i>
                    `;
                    selectedRoles.appendChild(roleElement);
                }
                selector.classList.remove('active');
                showSaveBar();
                updateProtectionStats();
            });
        });

        selectedRoles.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-role')) {
                e.target.closest('.selected-role').remove();
                showSaveBar();
                updateProtectionStats();
            }
        });
    });
}

function initializeWhitelistedBots() {
    const botIdInput = document.getElementById('bot-id-input');
    const addBotBtn = document.getElementById('add-bot-btn');
    const botsList = document.getElementById('whitelisted-bots-list');
    
    if (!botIdInput || !addBotBtn || !botsList) {
        console.log('Whitelisted bots elements not found');
        return;
    }
    
    addBotBtn.addEventListener('click', () => {
        const botIds = botIdInput.value.split(',').map(id => id.trim()).filter(id => id);
        
        if (botIds.length === 0) return;
        
        botIds.forEach(botId => {
            if (document.querySelector(`.bot-item[data-bot-id="${botId}"]`)) return;
            
            const botItem = document.createElement('div');
            botItem.className = 'bot-item';
            botItem.dataset.botId = botId;
            botItem.innerHTML = `
                <span>${botId}</span>
                <i class="fas fa-times remove-bot"></i>
            `;
            
            botsList.appendChild(botItem);
            
            botItem.querySelector('.remove-bot').addEventListener('click', () => {
                botItem.remove();
                showSaveBar();
            });
        });
        
        botIdInput.value = '';
        
        showSaveBar();
    });
    
    document.querySelectorAll('.bot-item .remove-bot').forEach(removeBtn => {
        if (!removeBtn) return;
        
        removeBtn.addEventListener('click', () => {
            const botItem = removeBtn.closest('.bot-item');
            if (botItem) {
                botItem.remove();
                showSaveBar();
            }
        });
    });
}

function initializeRealTimeUpdates() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', updateProtectionStats);
        input.addEventListener('change', updateProtectionStats);
    });
}

function initializeChannelSelectors() {
    document.querySelectorAll('.channel-selector').forEach(selector => {
        const selectedChannels = selector.querySelector('.selected-channels');
        
        selector.addEventListener('click', () => {
            selector.classList.toggle('active');
        });

        selector.querySelectorAll('.channel-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const channelId = option.dataset.channelId;
                const channelName = option.dataset.channelName;
                
                const existingChannel = selectedChannels.querySelector(`[data-channel-id="${channelId}"]`);
                if (!existingChannel) {
                    const channelElement = document.createElement('div');
                    channelElement.className = 'selected-channel';
                    channelElement.dataset.channelId = channelId;
                    channelElement.innerHTML = `
                        <span>${channelName}</span>
                        <i class="fas fa-times remove-channel"></i>
                    `;
                    selectedChannels.appendChild(channelElement);
                }
                selector.classList.remove('active');
                showSaveBar();
                updateProtectionStats();
            });
        });

        selectedChannels.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-channel')) {
                e.target.closest('.selected-channel').remove();
                showSaveBar();
                updateProtectionStats();
            }
        });
    });
} 
