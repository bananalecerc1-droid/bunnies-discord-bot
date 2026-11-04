document.addEventListener('DOMContentLoaded', function() {
    if (!window.location.pathname.includes('/settings')) return;

    initializeSettingsPage();
});

function initializeSettingsPage() {
    console.log('Initializing settings page...');
    
    setupLanguageSettings();
    
    setupAutoRolesSettings();
    setupTagRoleSettings();
    
    setupTabs();
}

function setupTagRoleSettings() {
    const saveButton = document.getElementById('saveTagRoleSettings');
    if (!saveButton) return;

    saveButton.addEventListener('click', async () => {
        const roleId = document.getElementById('tagRoleRoleId')?.value || '';
        const enabled = document.getElementById('tagRoleEnabled')?.checked || false;
        if (enabled && !roleId) {
            showToast('Select a role for members displaying the server tag.', 'error');
            return;
        }
        try {
            saveButton.disabled = true;
            const response = await fetch('/api/settings/tagRole', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled, roleId })
            });
            const data = await response.json();
            showToast(data.success ? 'Server Tag Role settings saved.' : (data.error || 'Failed to save settings.'), data.success ? 'success' : 'error');
        } catch (error) {
            console.error('Error saving Server Tag Role settings:', error);
            showToast('An error occurred while saving Server Tag Role settings.', 'error');
        } finally {
            saveButton.disabled = false;
        }
    });
}

function setupLanguageSettings() {
    const saveButton = document.getElementById('saveLanguageSettings');
    if (!saveButton) return;
    
    saveButton.addEventListener('click', function() {
        const defaultLanguage = document.querySelector('input[name="defaultLanguage"]:checked')?.value || 'en';
        
        const supportedLanguages = Array.from(document.querySelectorAll('input[name="supportedLanguages"]:checked'))
            .map(checkbox => checkbox.value);
        
        if (supportedLanguages.length === 0) {
            showToast('At least one language must be supported', 'error');
            return;
        }
        
        if (!supportedLanguages.includes(defaultLanguage)) {
            showToast('Default language must be included in supported languages', 'error');
            return;
        }
        
        saveLanguageSettings(defaultLanguage, supportedLanguages);
    });
    
    const defaultLangRadios = document.querySelectorAll('input[name="defaultLanguage"]');
    const supportedLangCheckboxes = document.querySelectorAll('input[name="supportedLanguages"]');
    
    defaultLangRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const defaultLang = this.value;
            const supportedLangCheckbox = document.getElementById(`supportLang_${defaultLang}`);
            
            if (supportedLangCheckbox && !supportedLangCheckbox.checked) {
                supportedLangCheckbox.checked = true;
                showToast('Default language automatically added to supported languages', 'info');
            }
        });
    });
    
    supportedLangCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (!this.checked) {
                const lang = this.value;
                const defaultLangRadio = document.getElementById(`defaultLang_${lang}`);
                
                if (defaultLangRadio && defaultLangRadio.checked) {
                    this.checked = true;
                    showToast('Cannot remove the default language from supported languages', 'warning');
                }
            }
        });
    });
}

async function saveLanguageSettings(defaultLanguage, supportedLanguages) {
    try {
        showLoadingState('saveLanguageSettings', true);
        
        const response = await fetch('/api/settings/language', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                defaultLanguage,
                supportedLanguages
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Language settings saved successfully', 'success');
        } else {
            showToast(`Failed to save language settings: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error saving language settings:', error);
        showToast('An error occurred while saving language settings', 'error');
    } finally {
        showLoadingState('saveLanguageSettings', false);
    }
}

function setupAutoRolesSettings() {
    const saveButton = document.getElementById('saveAutoRolesSettings');
    if (!saveButton) return;
    
    const memberRolesSelect = document.getElementById('memberRoles');
    const botRolesSelect = document.getElementById('botRoles');
    
    if (memberRolesSelect) {
        memberRolesSelect.addEventListener('change', function() {
            updateSelectedRolesDisplay('member');
        });
    }
    
    if (botRolesSelect) {
        botRolesSelect.addEventListener('change', function() {
            updateSelectedRolesDisplay('bot');
        });
    }
    
    saveButton.addEventListener('click', function() {
        const autoRolesEnabled = document.getElementById('autoRolesEnabled')?.checked || false;
        const memberEnabled = document.getElementById('memberAutoRolesEnabled')?.checked || false;
        const botEnabled = document.getElementById('botAutoRolesEnabled')?.checked || false;
        
        const memberRoleIds = Array.from(memberRolesSelect?.selectedOptions || [])
            .map(option => option.value);
            
        const botRoleIds = Array.from(botRolesSelect?.selectedOptions || [])
            .map(option => option.value);
        
        const settings = {
            enabled: autoRolesEnabled,
            members: {
                enabled: memberEnabled,
                roleIds: memberRoleIds
            },
            bots: {
                enabled: botEnabled,
                roleIds: botRoleIds
            }
        };
        
        saveAutoRolesSettings(settings);
    });
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('[data-tabs-target]');
    const tabContents = document.querySelectorAll('[role="tabpanel"]');
    
    if (!tabButtons.length || !tabContents.length) return;
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });
            
            tabButtons.forEach(btn => {
                btn.classList.remove('active', 'border-purple-500', 'text-purple-500');
                btn.classList.add('border-transparent');
                btn.setAttribute('aria-selected', 'false');
            });
            
            const targetId = button.getAttribute('data-tabs-target');
            const target = document.querySelector(targetId);
            if (target) {
                target.classList.remove('hidden');
            }
            
            button.classList.add('active', 'border-purple-500', 'text-purple-500');
            button.classList.remove('border-transparent');
            button.setAttribute('aria-selected', 'true');
        });
    });
}

function updateSelectedRolesDisplay(type) {
    const selectElement = document.getElementById(`${type}Roles`);
    const displayElement = document.getElementById(`${type}RolesList`);
    
    if (!selectElement || !displayElement) return;
    
    const selectedOptions = Array.from(selectElement.selectedOptions);
    
    displayElement.innerHTML = '';
    
    if (selectedOptions.length === 0) {
        const noRolesMsg = document.createElement('span');
        noRolesMsg.className = 'text-gray-500 dark:text-gray-400 text-sm';
        noRolesMsg.textContent = 'No roles selected';
        displayElement.appendChild(noRolesMsg);
        return;
    }
    
    selectedOptions.forEach(option => {
        const badge = document.createElement('span');
        badge.className = type === 'member' 
            ? 'bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300'
            : 'bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-purple-900 dark:text-purple-300';
        badge.textContent = option.textContent;
        displayElement.appendChild(badge);
    });
}

async function saveAutoRolesSettings(settings) {
    try {
        showLoadingState('saveAutoRolesSettings', true);
        
        const response = await fetch('/api/settings/autoRoles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Auto roles settings saved successfully', 'success');
        } else {
            showToast(`Failed to save auto roles settings: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error saving auto roles settings:', error);
        showToast('An error occurred while saving auto roles settings', 'error');
    } finally {
        showLoadingState('saveAutoRolesSettings', false);
    }
}

function showLoadingState(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
    } else {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-save mr-2"></i>Save Changes';
    }
}

function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col items-end space-y-2';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    let bgColor, textColor, icon;
    
    switch (type) {
        case 'success':
            bgColor = 'bg-green-100 dark:bg-green-800';
            textColor = 'text-green-800 dark:text-green-100';
            icon = 'fa-check-circle text-green-500';
            break;
        case 'error':
            bgColor = 'bg-red-100 dark:bg-red-800';
            textColor = 'text-red-800 dark:text-red-100';
            icon = 'fa-times-circle text-red-500';
            break;
        case 'warning':
            bgColor = 'bg-yellow-100 dark:bg-yellow-800';
            textColor = 'text-yellow-800 dark:text-yellow-100';
            icon = 'fa-exclamation-triangle text-yellow-500';
            break;
        case 'info':
        default:
            bgColor = 'bg-blue-100 dark:bg-blue-800';
            textColor = 'text-blue-800 dark:text-blue-100';
            icon = 'fa-info-circle text-blue-500';
            break;
    }
    
    toast.className = `${bgColor} ${textColor} p-3 rounded-lg shadow-md flex items-center max-w-xs animate-fade-in`;
    toast.innerHTML = `
        <i class="fas ${icon} mr-2"></i>
        <span>${message}</span>
        <button type="button" class="ml-auto text-gray-400 hover:text-gray-500 focus:outline-none">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    const closeButton = toast.querySelector('button');
    closeButton.addEventListener('click', () => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('animate-fade-out');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
} 
