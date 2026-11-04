document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing rules page...');
    
    initializeRulesSystem();
    initializeEmojiPickers();
    initializeSaveBar();
    initializeDeleteButtons();
    initializeExistingSections();
    updateRulesStats();
    initializeCharacterCounters();
});

function initializeExistingSections() {
    document.querySelectorAll('.rule-section').forEach(sectionDiv => {
        initializeSection(sectionDiv);
    });
}

function initializeSection(sectionDiv) {
    const addRuleBtn = sectionDiv.querySelector('.add-rule');
    if (addRuleBtn) {
        addRuleBtn.addEventListener('click', () => {
            const rulesContainer = sectionDiv.querySelector('.rules-container');
            const ruleDiv = document.createElement('div');
            ruleDiv.className = 'flex items-center gap-2';
            ruleDiv.innerHTML = `
                <textarea class="rule-input input-field flex-1" rows="3" required></textarea>
                <button type="button" class="delete-rule px-2 py-1 text-red-500 hover:text-red-600">
                    <i class="fas fa-times"></i>
                </button>
            `;
            rulesContainer.appendChild(ruleDiv);
            initializeDeleteRuleButtons(ruleDiv);
            showSaveBar();
            updateRulesStats();
        });
    }

    const inputs = sectionDiv.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            showSaveBar();
            updateRulesStats();
        });
    });

    const toggle = sectionDiv.querySelector('.section-toggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            sectionDiv.classList.toggle('opacity-50', !toggle.checked);
            showSaveBar();
            updateRulesStats();
        });
    }

    const deleteBtn = sectionDiv.querySelector('.delete-section');
    if (deleteBtn) {
        const newBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newBtn, deleteBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this section?')) {
                sectionDiv.remove();
                showSaveBar();
                updateRulesStats();
            }
        });
    }

    initializeDeleteRuleButtons(sectionDiv);
}

function loadExistingSections() {
    console.log('Loading existing sections...');
    const rulesContainer = document.getElementById('rulesSections');
    if (!rulesContainer) {
        console.error('Rules container not found!');
        return;
    }

    rulesContainer.innerHTML = '';

    if (!window.settings?.rules?.sections) {
        console.log('No sections found in settings');
        return;
    }

    const sections = window.settings.rules.sections;
    console.log(`Found ${sections.length} sections to load:`, sections);

    sections.forEach((section, index) => {
        if (!section) return;
        
        console.log(`Creating section ${index}:`, section);
        const sectionDiv = createNewSection();
        
        const toggle = sectionDiv.querySelector('.section-toggle');
        if (toggle) {
            toggle.checked = section.enabled !== false;
            sectionDiv.classList.toggle('opacity-50', !toggle.checked);
        }

        const nameInput = sectionDiv.querySelector('.section-name');
        if (nameInput) nameInput.value = section.name || '';

        const emojiInput = sectionDiv.querySelector('.section-emoji');
        if (emojiInput) emojiInput.value = section.emoji || '';

        const descInput = sectionDiv.querySelector('.section-description');
        if (descInput) descInput.value = section.description || '';

        const rulesInput = sectionDiv.querySelector('.rule-input');
        if (rulesInput) {
            rulesInput.value = section.rules || '';
        }

        if (section.embed) {
            const colorInput = sectionDiv.querySelector('.section-embed-color');
            if (colorInput) colorInput.value = section.embed.color || '#777bc9';

            const thumbnailToggle = sectionDiv.querySelector('.section-embed-thumbnail-enabled');
            if (thumbnailToggle) thumbnailToggle.checked = section.embed.thumbnail?.enabled || false;

            const thumbnailUrl = sectionDiv.querySelector('.section-embed-thumbnail-url');
            if (thumbnailUrl) thumbnailUrl.value = section.embed.thumbnail?.url || '';

            const imageToggle = sectionDiv.querySelector('.section-embed-image-enabled');
            if (imageToggle) imageToggle.checked = section.embed.image?.enabled || false;

            const imageUrl = sectionDiv.querySelector('.section-embed-image-url');
            if (imageUrl) imageUrl.value = section.embed.image?.url || '';

            const footerText = sectionDiv.querySelector('.section-embed-footer-text');
            if (footerText) footerText.value = section.embed.footer?.text || '';

            const footerIcon = sectionDiv.querySelector('.section-embed-footer-icon');
            if (footerIcon) footerIcon.value = section.embed.footer?.iconUrl || '';
        }

        rulesContainer.appendChild(sectionDiv);
        
        initializeSection(sectionDiv);
    });

    if (window.settings.rules.mainEmbed) {
        const mainEmbed = window.settings.rules.mainEmbed;
        
        const elements = {
            'rules-embed-title': mainEmbed.title,
            'rules-embed-description': mainEmbed.description,
            'rules-embed-color': mainEmbed.color,
            'rules-embed-thumbnail-enabled': mainEmbed.thumbnail?.enabled,
            'rules-embed-thumbnail-url': mainEmbed.thumbnail?.url,
            'rules-embed-image-enabled': mainEmbed.image?.enabled,
            'rules-embed-image-url': mainEmbed.image?.url,
            'rules-embed-footer-text': mainEmbed.footer?.text,
            'rules-embed-footer-icon': mainEmbed.footer?.iconUrl
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value || false;
                } else {
                    element.value = value || '';
                }
            }
        });
    }

    const systemToggle = document.getElementById('rules-enabled');
    if (systemToggle) {
        systemToggle.checked = window.settings.rules.enabled !== false;
    }

    if (window.settings.rules.interface) {
        const interfaceType = document.getElementById('rules-interface-type');
        const interfaceStyle = document.getElementById('rules-interface-style');
        
        if (interfaceType) interfaceType.value = window.settings.rules.interface.type || 'buttons';
        if (interfaceStyle) interfaceStyle.value = window.settings.rules.interface.style || 'Primary';
    }

    updateRulesStats();
}

function initializeRulesSystem() {
    const systemToggle = document.getElementById('rules-enabled');
    if (systemToggle) {
        systemToggle.addEventListener('change', () => {
            showSaveBar();
            updateRulesStats();
        });
    }

    const interfaceInputs = document.querySelectorAll('#rules-interface-type, #rules-interface-style');
    interfaceInputs.forEach(input => {
        input.addEventListener('change', () => {
            showSaveBar();
            updateRulesStats();
        });
    });

    const embedInputs = document.querySelectorAll('[id^="rules-embed-"]');
    embedInputs.forEach(input => {
        input.addEventListener('change', showSaveBar);
    });

    const addSectionBtn = document.getElementById('addSection');
    if (addSectionBtn) {
        addSectionBtn.addEventListener('click', () => {
            const sectionDiv = createNewSection();
            document.getElementById('rulesSections').appendChild(sectionDiv);
            initializeSection(sectionDiv);
            initializeEmojiPickers();
            initializeCharacterCounters();
            initializeDeleteButtons();
            showSaveBar();
            updateRulesStats();
        });
    }

    const enableAllBtn = document.getElementById('enableAllSections');
    const disableAllBtn = document.getElementById('disableAllSections');

    if (enableAllBtn) {
        enableAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.section-toggle').forEach(toggle => {
                toggle.checked = true;
                showSaveBar();
            });
            updateRulesStats();
        });
    }

    if (disableAllBtn) {
        disableAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.section-toggle').forEach(toggle => {
                toggle.checked = false;
                showSaveBar();
            });
            updateRulesStats();
        });
    }
}

function createNewSection() {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'rule-section bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4';
    sectionDiv.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-4">
                <label class="switch-large">
                    <input type="checkbox" class="section-toggle" checked>
                    <span class="slider-large"></span>
                </label>
                <input type="text" class="section-name input-field w-48" 
                       placeholder="Section Name" required maxlength="15">
                <div class="text-xs text-gray-500 name-counter">0/15</div>
            </div>
            <button class="delete-section text-red-500 hover:text-red-600">
                <i class="fas fa-trash"></i>
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Emoji
                </label>
                <div class="flex items-center gap-2">
                    <input type="text" class="section-emoji input-field flex-1 emoji-picker-input" 
                           required maxlength="2">
                    <button type="button" class="emoji-picker-btn px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                        <i class="fas fa-smile"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                </label>
                <input type="text" class="section-description input-field" 
                       required maxlength="100">
                <div class="text-xs text-gray-500 description-counter">0/100</div>
            </div>
        </div>

        <div class="form-group">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rules
            </label>
            <div class="rules-container">
                <div class="flex items-center gap-2">
                    <textarea class="rule-input input-field flex-1" rows="10" required
                              maxlength="4096" placeholder="Enter rules (one per line)"></textarea>
                </div>
                <div class="text-xs text-gray-500 mt-1 rules-counter">0/4096</div>
            </div>
        </div>

        <div class="embed-settings mt-4">
            <h4 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Embed Settings
            </h4>
            <div class="grid grid-cols-1 gap-4">
                <div class="form-group">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Color
                    </label>
                    <input type="color" class="section-embed-color input-field" value="#777bc9">
                </div>

                <!-- Thumbnail Settings -->
                <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="font-medium text-gray-800 dark:text-white">
                            Thumbnail
                        </h5>
                        <label class="switch">
                            <input type="checkbox" class="section-embed-thumbnail-enabled switch-input">
                            <span class="switch-slider"></span>
                        </label>
                    </div>
                    <input type="text" class="section-embed-thumbnail-url input-field mt-2"
                           placeholder="Thumbnail URL">
                </div>

                <!-- Image Settings -->
                <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="font-medium text-gray-800 dark:text-white">
                            Image
                        </h5>
                        <label class="switch">
                            <input type="checkbox" class="section-embed-image-enabled switch-input">
                            <span class="switch-slider"></span>
                        </label>
                    </div>
                    <input type="text" class="section-embed-image-url input-field mt-2"
                           placeholder="Image URL">
                </div>

                <!-- Footer Settings -->
                <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <h5 class="font-medium text-gray-800 dark:text-white mb-2">
                        Footer
                    </h5>
                    <div class="grid grid-cols-1 gap-4">
                        <div class="form-group">
                            <input type="text" class="section-embed-footer-text input-field"
                                   placeholder="Footer Text" maxlength="2048">
                            <div class="text-xs text-gray-500 mt-1 footer-counter">0/2048</div>
                        </div>
                        <div class="form-group">
                            <input type="text" class="section-embed-footer-icon input-field"
                                   placeholder="Footer Icon URL">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return sectionDiv;
}

function initializeDeleteButtons() {
    document.querySelectorAll('.delete-section').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    document.querySelectorAll('.delete-section').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this section?')) {
                const section = btn.closest('.rule-section');
                if (section) {
                    section.remove();
                    showSaveBar();
                    updateRulesStats();
                }
            }
        });
    });

    document.querySelectorAll('.delete-rule').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    document.querySelectorAll('.delete-rule').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rulesContainer = btn.closest('.rules-container');
            if (rulesContainer && rulesContainer.children.length > 1) {
                btn.closest('.flex').remove();
                showSaveBar();
                updateRulesStats();
            } else {
                showToast('Each section must have at least one rule', 'error');
            }
        });
    });
}

function initializeSaveBar() {
    const saveBtn = document.getElementById('saveRulesSettings');
    const resetBtn = document.getElementById('resetRulesSettings');

    if (saveBtn) {
        saveBtn.addEventListener('click', saveRulesSettings);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all rules settings?')) {
                window.location.reload();
            }
        });
    }
}

function updateRulesStats() {
    const activeSections = document.querySelectorAll('.section-toggle:checked').length;
    document.getElementById('activeSections').textContent = activeSections;

    const totalRules = document.querySelectorAll('.rule-input').length;
    document.getElementById('totalRules').textContent = totalRules;

    const interfaceType = document.getElementById('rules-interface-type')?.value || 'Buttons';
    document.getElementById('interfaceType').textContent = interfaceType;
}

function validateSection(section) {
    const name = section.querySelector('.section-name')?.value.trim();
    const emoji = section.querySelector('.section-emoji')?.value.trim();
    const description = section.querySelector('.section-description')?.value.trim();
    const rules = section.querySelector('.rule-input')?.value.trim();
    const footerText = section.querySelector('.section-embed-footer-text')?.value.trim();

    if (!name || name.length > 15) {
        showToast('Section name is required and must be 15 characters or less', 'error');
        return false;
    }

    if (!emoji || emoji.length > 2) {
        showToast('Section emoji is required and must be a single emoji', 'error');
        return false;
    }

    if (!description || description.length > 100) {
        showToast('Section description is required and must be 100 characters or less', 'error');
        return false;
    }

    if (!rules || rules.length > 4096) {
        showToast('Rules are required and must be 4096 characters or less', 'error');
        return false;
    }

    const ruleLines = rules.split('\n').filter(rule => rule.trim());
    if (ruleLines.length === 0) {
        showToast('At least one rule is required', 'error');
        return false;
    }

    if (footerText && footerText.length > 2048) {
        showToast('Footer text must be 2048 characters or less', 'error');
        return false;
    }

    return true;
}

function collectRulesSettings() {
    return {
        enabled: document.getElementById('rules-enabled')?.checked || false,
        interface: {
            type: document.getElementById('rules-interface-type')?.value || 'buttons',
            style: document.getElementById('rules-interface-style')?.value || 'Primary'
        },
        mainEmbed: {
            title: document.getElementById('rules-embed-title')?.value || '',
            description: document.getElementById('rules-embed-description')?.value || '',
            color: document.getElementById('rules-embed-color')?.value || '#777bc9',
            thumbnail: {
                enabled: document.getElementById('rules-embed-thumbnail-enabled')?.checked || false,
                url: document.getElementById('rules-embed-thumbnail-url')?.value || null
            },
            image: {
                enabled: document.getElementById('rules-embed-image-enabled')?.checked || false,
                url: document.getElementById('rules-embed-image-url')?.value || null
            },
            footer: {
                text: document.getElementById('rules-embed-footer-text')?.value || '',
                iconUrl: document.getElementById('rules-embed-footer-icon')?.value || null
            }
        },
        sections: Array.from(document.querySelectorAll('.rule-section')).map(section => {
            const rulesText = section.querySelector('.rule-input')?.value || '';
            const rules = rulesText.trim();

            return {
                enabled: section.querySelector('.section-toggle')?.checked || false,
                name: section.querySelector('.section-name')?.value || '',
                emoji: section.querySelector('.section-emoji')?.value || '',
                description: section.querySelector('.section-description')?.value || '',
                rules: rules,
                embed: {
                    color: section.querySelector('.section-embed-color')?.value || '#777bc9',
                    thumbnail: {
                        enabled: section.querySelector('.section-embed-thumbnail-enabled')?.checked || false,
                        url: section.querySelector('.section-embed-thumbnail-url')?.value || null
                    },
                    image: {
                        enabled: section.querySelector('.section-embed-image-enabled')?.checked || false,
                        url: section.querySelector('.section-embed-image-url')?.value || null
                    },
                    footer: {
                        text: section.querySelector('.section-embed-footer-text')?.value || '',
                        iconUrl: section.querySelector('.section-embed-footer-icon')?.value || null
                    }
                }
            };
        })
    };
}

async function saveRulesSettings() {
    try {
        const sections = document.querySelectorAll('.rule-section');
        for (const section of sections) {
            if (!validateSection(section)) {
                return;
            }
        }

        const settings = collectRulesSettings();
        
        const response = await fetch('/api/rules/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to save settings');

        showToast('Rules settings saved successfully', 'success');
        hideSaveBar();
    } catch (error) {
        console.error('Error saving rules settings:', error);
        showToast('Failed to save rules settings', 'error');
    }
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

function initializeEmojiPickers() {
    document.querySelectorAll('.emoji-picker-btn').forEach(btn => {
        const clone = btn.cloneNode(true);
        
        const parent = btn.parentNode;
        
        parent.replaceChild(clone, btn);
        
        const formGroup = clone.closest('.form-group');
        const input = formGroup.querySelector('.emoji-picker-input');
        
        if (!input) {
            console.error('Could not find emoji input for button:', clone);
            return;
        }
        
        clone.addEventListener('click', () => {
            document.querySelectorAll('.emoji-mart').forEach(p => p.remove());

            const rect = clone.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            const picker = new EmojiMart.Picker({
                data: async () => {
                    const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
                    return response.json();
                },
                onEmojiSelect: emoji => {
                    input.value = emoji.native;
                    picker.remove();
                    input.dispatchEvent(new Event('change'));
                    showSaveBar();
                },
                theme: 'dark',
                set: 'native',
                showPreview: false,
                showSkinTones: false,
                maxFrequentRows: 2
            });

            document.body.appendChild(picker);
            
            const isRTL = document.dir === 'rtl';
            const pickerRect = picker.getBoundingClientRect();
            
            let top = rect.bottom + scrollTop + 5;
            let left = isRTL ? rect.left + scrollLeft - pickerRect.width + rect.width : rect.left + scrollLeft;

            if (top + pickerRect.height > window.innerHeight) {
                top = rect.top + scrollTop - pickerRect.height - 5;
            }
            if (left + pickerRect.width > window.innerWidth) {
                left = window.innerWidth - pickerRect.width - 5;
            }
            if (left < 0) {
                left = 5;
            }

            picker.style.position = 'absolute';
            picker.style.top = `${top}px`;
            picker.style.left = `${left}px`;
            picker.style.zIndex = '1000';

            const closePickerOnClickOutside = (e) => {
                if (!picker.contains(e.target) && !clone.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', closePickerOnClickOutside);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closePickerOnClickOutside);
            }, 100);
        });
    });
}

function initializeCharacterCounters() {
    document.querySelectorAll('.rule-section').forEach(section => {
        const nameInput = section.querySelector('.section-name');
        const nameCounter = section.querySelector('.name-counter');
        if (nameInput && nameCounter) {
            nameCounter.textContent = `${nameInput.value.length}/15`;
            nameInput.addEventListener('input', () => {
                nameCounter.textContent = `${nameInput.value.length}/15`;
            });
        }

        const descInput = section.querySelector('.section-description');
        const descCounter = section.querySelector('.description-counter');
        if (descInput && descCounter) {
            descCounter.textContent = `${descInput.value.length}/100`;
            descInput.addEventListener('input', () => {
                descCounter.textContent = `${descInput.value.length}/100`;
            });
        }

        const rulesInput = section.querySelector('.rule-input');
        const rulesCounter = section.querySelector('.rules-counter');
        if (rulesInput && rulesCounter) {
            rulesCounter.textContent = `${rulesInput.value.length}/4096`;
            rulesInput.addEventListener('input', () => {
                rulesCounter.textContent = `${rulesInput.value.length}/4096`;
            });
        }

        const footerInput = section.querySelector('.section-embed-footer-text');
        const footerCounter = section.querySelector('.footer-counter');
        if (footerInput && footerCounter) {
            footerCounter.textContent = `${footerInput.value.length}/2048`;
            footerInput.addEventListener('input', () => {
                footerCounter.textContent = `${footerInput.value.length}/2048`;
            });
        }
    });
}

function initializeDeleteRuleButtons(section) {
    section.querySelectorAll('.delete-rule').forEach(btn => {
        btn.addEventListener('click', () => {
            const rulesContainer = btn.closest('.rules-container');
            if (rulesContainer.children.length > 1) {
                btn.closest('.flex').remove();
                showSaveBar();
                updateRulesStats();
            } else {
                showToast('Each section must have at least one rule', 'error');
            }
        });
    });
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
