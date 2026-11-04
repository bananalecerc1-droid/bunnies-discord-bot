document.addEventListener('DOMContentLoaded', () => {
    initializeAutoReplySystem();
    updateStatistics();
});

function initializeAutoReplySystem() {
    const elements = {
        enabled: document.getElementById('autoreply-enabled'),
        mentionUser: document.getElementById('autoreply-mention-user'),
        replyToMessage: document.getElementById('autoreply-reply-to-message'),
        caseSensitive: document.getElementById('autoreply-case-sensitive'),
        matchType: document.getElementById('autoreply-match-type'),
        chance: document.getElementById('autoreply-chance'),
        cooldown: document.getElementById('autoreply-cooldown'),
        addSection: document.getElementById('add-section-btn'),
        saveSettings: document.getElementById('saveAutoReplySettings'),
        resetSettings: document.getElementById('resetAutoReplySettings')
    };

    elements.enabled?.addEventListener('change', showSaveBar);
    elements.mentionUser?.addEventListener('change', showSaveBar);
    elements.replyToMessage?.addEventListener('change', showSaveBar);
    elements.caseSensitive?.addEventListener('change', showSaveBar);
    elements.matchType?.addEventListener('change', showSaveBar);
    elements.chance?.addEventListener('input', updateChanceValue);
    elements.chance?.addEventListener('change', showSaveBar);
    elements.cooldown?.addEventListener('change', showSaveBar);

    elements.addSection?.addEventListener('click', addNewSection);
    initializeSectionManagement();

    elements.saveSettings?.addEventListener('click', saveSettings);
    elements.resetSettings?.addEventListener('click', resetSettings);
}

function updateChanceValue() {
    const value = document.getElementById('autoreply-chance')?.value || '0';
    const chanceValue = document.getElementById('chance-value');
    if (chanceValue) {
        chanceValue.textContent = value + '%';
        showSaveBar();
    }
}

function showSaveBar() {
    const saveBar = document.getElementById('saveBar');
    saveBar?.classList.add('show');
}

function hideSaveBar() {
    const saveBar = document.getElementById('saveBar');
    saveBar?.classList.remove('show');
}

function initializeSectionManagement() {
    document.querySelectorAll('[data-section]').forEach(section => {
        if (section.dataset.handlersBound === 'true') return;
        section.dataset.handlersBound = 'true';
        try {
            section.querySelector('.section-enabled')?.addEventListener('change', showSaveBar);
            
            section.querySelector('.section-name')?.addEventListener('change', showSaveBar);
            
            section.querySelector('.delete-section')?.addEventListener('click', () => deleteSection(section));
            
            section.querySelector('.add-trigger')?.addEventListener('click', () => addTrigger(section));
            section.querySelectorAll('.remove-trigger').forEach(btn => {
                btn?.addEventListener('click', e => removeTrigger(e.target.closest('.trigger-item')));
            });
            
            section.querySelector('.add-response')?.addEventListener('click', () => addResponse(section));
            section.querySelectorAll('.remove-response').forEach(btn => {
                btn?.addEventListener('click', e => removeResponse(e.target.closest('.response-item')));
            });
        } catch (error) {
            console.error('Error initializing section:', error);
        }
    });
}

function addNewSection() {
    const container = document.getElementById('sections-container');
    const locale = window.locale || {};
    const sectionName = locale?.dashboard?.autoReply?.settings?.newSectionDefault || 'New Section';
    const isRTL = document.documentElement.dir === 'rtl';
    
    const section = document.createElement('div');
    section.className = 'bg-gray-800 rounded-lg p-4';
    section.dataset.section = sectionName;
    
    section.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-4">
                <label class="switch-large">
                    <input type="checkbox" class="section-enabled" checked>
                    <span class="slider-large"></span>
                </label>
                <input type="text" class="section-name bg-gray-700 text-gray-300 rounded-lg p-2 border border-gray-600" 
                       value="${sectionName}" placeholder="${locale?.dashboard?.autoReply?.settings?.sectionNamePlaceholder || 'Section Name'}">
            </div>
            <button class="delete-section text-red-500 hover:text-red-600">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-gray-300 mb-2">${locale?.dashboard?.autoReply?.settings?.triggers || 'Triggers'}</label>
                <div class="flex gap-2 mb-2">
                    <input type="text" class="trigger-input flex-1 bg-gray-700 text-gray-300 rounded-lg p-2 border border-gray-600" 
                           placeholder="${locale?.dashboard?.autoReply?.settings?.triggerPlaceholder || 'Enter trigger text'}">
                    <button class="add-trigger px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="triggers-list space-y-2"></div>
            </div>
            <div>
                <label class="block text-gray-300 mb-2">${locale?.dashboard?.autoReply?.settings?.responses || 'Responses'}</label>
                <div class="flex gap-2 mb-2">
                    <input type="text" class="response-input flex-1 bg-gray-700 text-gray-300 rounded-lg p-2 border border-gray-600" 
                           placeholder="${locale?.dashboard?.autoReply?.settings?.responsePlaceholder || 'Enter response text'}">
                    <button class="add-response px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="responses-list space-y-2"></div>
            </div>
        </div>
    `;
    
    container.appendChild(section);
    initializeSectionManagement();
    showSaveBar();
    updateStatistics();
}

function deleteSection(section) {
    section.remove();
    showSaveBar();
    updateStatistics();
}

function addTrigger(section) {
    const input = section.querySelector('.trigger-input');
    const text = input.value.trim();
    if (!text) return;
    
    const triggersList = section.querySelector('.triggers-list');
    const trigger = document.createElement('div');
    trigger.className = 'trigger-item flex items-center justify-between bg-gray-700 p-2 rounded-lg';
    trigger.innerHTML = `
        <span class="text-gray-300">${text}</span>
        <button class="remove-trigger text-red-500 hover:text-red-600">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    trigger.querySelector('.remove-trigger').addEventListener('click', () => removeTrigger(trigger));
    triggersList.appendChild(trigger);
    input.value = '';
    showSaveBar();
    updateStatistics();
}

function removeTrigger(trigger) {
    trigger.remove();
    showSaveBar();
    updateStatistics();
}

function addResponse(section) {
    const input = section.querySelector('.response-input');
    const text = input.value.trim();
    if (!text) return;
    
    const responsesList = section.querySelector('.responses-list');
    const response = document.createElement('div');
    response.className = 'response-item flex items-center justify-between bg-gray-700 p-2 rounded-lg';
    response.innerHTML = `
        <span class="text-gray-300">${text}</span>
        <button class="remove-response text-red-500 hover:text-red-600">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    response.querySelector('.remove-response').addEventListener('click', () => removeResponse(response));
    responsesList.appendChild(response);
    input.value = '';
    showSaveBar();
}

function removeResponse(response) {
    response.remove();
    showSaveBar();
}

function updateStatistics() {
    const sections = document.querySelectorAll('[data-section]');
    const activeSections = Array.from(sections).filter(section => 
        section.querySelector('.section-enabled').checked
    ).length;
    
    let totalTriggers = 0;
    sections.forEach(section => {
        totalTriggers += section.querySelectorAll('.trigger-item').length;
    });
    
    document.getElementById('activeSections').textContent = activeSections;
    document.getElementById('totalTriggers').textContent = totalTriggers;
}

async function saveSettings() {
    try {
        const settings = {
            enabled: document.getElementById('autoreply-enabled').checked,
            mentionUser: document.getElementById('autoreply-mention-user').checked,
            replyToMessage: document.getElementById('autoreply-reply-to-message').checked,
            caseSensitive: document.getElementById('autoreply-case-sensitive').checked,
            matchType: document.getElementById('autoreply-match-type').value,
            chance: parseInt(document.getElementById('autoreply-chance').value),
            cooldown: parseInt(document.getElementById('autoreply-cooldown').value) * 1000,
            sections: {}
        };

        const usedNames = new Set();
        document.querySelectorAll('[data-section]').forEach(section => {
            const baseName = section.querySelector('.section-name').value.trim() || 'New Section';
            let sectionName = baseName;
            let suffix = 2;
            while (usedNames.has(sectionName)) sectionName = `${baseName} ${suffix++}`;
            usedNames.add(sectionName);
            const triggers = Array.from(section.querySelectorAll('.trigger-item span')).map(span => span.textContent);
            const responses = Array.from(section.querySelectorAll('.response-item span')).map(span => span.textContent);
            
            settings.sections[sectionName] = {
                enabled: section.querySelector('.section-enabled').checked,
                triggers,
                responses
            };
        });

        const response = await fetch('/api/autoreply/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to save settings');

        showToast('Settings saved successfully!', 'success');
        hideSaveBar();
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings', 'error');
    }
}

function resetSettings() {
    location.reload();
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
} 
