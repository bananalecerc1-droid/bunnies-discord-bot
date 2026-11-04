console.log('Apply.js file loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded in apply.js');
    console.log('Window location:', window.location.pathname);
    
    if (window.utils && window.utils.onPage) {
        console.log('Using utils.onPage method');
        utils.onPage('/apply', () => {
            console.log('Apply page detected via utils.onPage');
            initializeApplyPage();
        });
    } else {
        console.log('Using direct path matching');
        if (window.location.pathname === '/apply') {
            console.log('Apply page detected via direct path');
            initializeApplyPage();
        } else {
            console.log('Not on apply page:', window.location.pathname);
        }
    }
});

function initializeApplyPage() {
    console.log('Initializing apply page...');
    try {
        initializeApplyToggles();
        initializeEmbedSettings();
        initializePositionSettings();
        initializeGlobalControls();
        initializeSaveBar();
        initializeNewPositionForm();
        initializeDeleteButtons();
        updateApplyStats();
        initializeEmojiPickers();
        
        initializeMobileUI();
        
        console.log('Apply page initialized successfully');
    } catch (error) {
        console.error('Error initializing apply page:', error);
    }
}

function initializeMobileUI() {
    document.querySelectorAll('.position-card').forEach(card => {
        card.classList.add('mobile-card');
    });

    document.querySelectorAll('.switch-large, button, select, .emoji-picker-btn').forEach(element => {
        element.classList.add('touch-friendly');
    });

    const headerControls = document.querySelector('.flex.items-center.space-x-4');
    if (headerControls) {
        if (window.innerWidth < 768) {
            headerControls.classList.remove('space-x-4');
            headerControls.classList.add('space-y-2', 'flex-col', 'w-full');
            
            headerControls.querySelectorAll('button').forEach(btn => {
                btn.classList.add('w-full', 'justify-center');
            });
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth < 768) {
                headerControls.classList.remove('space-x-4');
                headerControls.classList.add('space-y-2', 'flex-col', 'w-full');
                
                headerControls.querySelectorAll('button').forEach(btn => {
                    btn.classList.add('w-full', 'justify-center');
                });
            } else {
                headerControls.classList.add('space-x-4');
                headerControls.classList.remove('space-y-2', 'flex-col', 'w-full');
                
                headerControls.querySelectorAll('button').forEach(btn => {
                    btn.classList.remove('w-full', 'justify-center');
                });
            }
        });
    }

    document.querySelectorAll('.position-card').forEach(card => {
        let touchStartX = 0;
        let touchEndX = 0;
        
        card.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, {passive: true});
        
        card.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe(card, touchStartX, touchEndX);
        }, {passive: true});
    });
    
    document.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('invalid', () => {
            input.classList.add('mobile-error-input');
            
            const errorMsg = document.createElement('div');
            errorMsg.className = 'mobile-error-message text-red-500 text-sm mt-1';
            errorMsg.textContent = input.validationMessage;
            
            const existingError = input.parentElement.querySelector('.mobile-error-message');
            if (existingError) existingError.remove();
            
            input.parentElement.appendChild(errorMsg);
            
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        
        input.addEventListener('input', () => {
            input.classList.remove('mobile-error-input');
            const errorMsg = input.parentElement.querySelector('.mobile-error-message');
            if (errorMsg) errorMsg.remove();
        });
    });
}


function handleSwipe(element, startX, endX) {
    const threshold = 100;
    
    if (startX - endX > threshold) {
        const deleteBtn = element.querySelector('.delete-position');
        if (deleteBtn) {
            deleteBtn.classList.add('swipe-reveal');
            
            setTimeout(() => {
                deleteBtn.classList.remove('swipe-reveal');
            }, 3000);
        }
    } else if (endX - startX > threshold) {
        const toggle = element.querySelector('.position-toggle');
        if (toggle) {
            toggle.checked = !toggle.checked;
            toggle.dispatchEvent(new Event('change'));
        }
    }
}

function initializeApplyToggles() {
    const toggles = document.querySelectorAll('.position-toggle');
    
    if (!toggles || toggles.length === 0) {
        console.log('No position toggles found');
        return;
    }
    
    toggles.forEach(toggle => {
        if (!toggle) return;
        
        toggle.addEventListener('change', () => {
            showSaveBar();
            updateApplyStats();
        });
    });
}

function initializeEmbedSettings() {
    const embedInputs = document.querySelectorAll('[id^="apply-embed-"]');
    
    if (!embedInputs || embedInputs.length === 0) {
        console.log('No embed inputs found');
        return;
    }
    
    embedInputs.forEach(input => {
        if (!input) return;
        input.addEventListener('change', showSaveBar);
    });
}

function initializePositionSettings() {
    const inputs = document.querySelectorAll('.position-card input, .position-card select, .position-card textarea');
    inputs.forEach(input => {
        input.addEventListener('change', showSaveBar);
    });
}

function collectApplySettings() {
    console.log('Collecting apply settings...');
    const settings = {
        enabled: document.getElementById('apply-enabled')?.checked || false,
        embed: {
            color: document.getElementById('apply-embed-color')?.value || '#777bc9',
            thumbnail: document.getElementById('apply-embed-thumbnail')?.value || '',
            footer: document.getElementById('apply-embed-footer')?.value || '',
            footerIcon: document.getElementById('apply-embed-footerIcon')?.value || '',
            timestamp: true
        },
        positions: []
    };

    document.querySelectorAll('.position-card').forEach(positionEl => {
        const index = positionEl.dataset.position;
        const position = {
            enabled: positionEl.querySelector('.position-toggle')?.checked || false,
            name: positionEl.querySelector('.position-name')?.value || '',
            emoji: positionEl.querySelector('.position-emoji')?.value || '',
            color: positionEl.querySelector('.position-color')?.value || '#000000',
            logChannel: positionEl.querySelector('.position-logChannel')?.value || '',
            reviewers: {
                roles: Array.from(positionEl.querySelector('.position-reviewerRoles')?.selectedOptions || [])
                    .map(option => option.value)
            },
            cooldown: parseInt(positionEl.querySelector('.position-cooldown')?.value || '0'),
            questions: Array.from(positionEl.querySelectorAll('.question-input'))
                .map(input => input.value.trim())
                .filter(q => q),
            requirements: {
                minimumAge: parseInt(positionEl.querySelector('.position-minAge')?.value || '0'),
                minimumGuildAge: parseInt(positionEl.querySelector('.position-minGuildAge')?.value || '0') * 86400000,
                requiredRoles: Array.from(positionEl.querySelector('.position-requiredRoles')?.selectedOptions || [])
                    .map(option => option.value),
                blacklistedRoles: Array.from(positionEl.querySelector('.position-blacklistedRoles')?.selectedOptions || [])
                    .map(option => option.value)
            },
            acceptRoles: Array.from(positionEl.querySelector('.position-acceptRoles')?.selectedOptions || [])
                .map(option => option.value),
            acceptMessage: positionEl.querySelector('.position-acceptMessage')?.value || ''
        };
        settings.positions.push(position);
    });

    console.log('Collected settings:', settings);
    return settings;
}

async function saveApplySettings() {
    console.log('Saving apply settings...');
    try {
        const settings = collectApplySettings();
        
        const response = await fetch('/api/apply/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save settings');

        console.log('Settings saved successfully:', data);
        hideSaveBar();
        showToast('Apply settings saved successfully', 'success');
    } catch (error) {
        console.error('Error saving apply settings:', error);
        showToast('Failed to save apply settings', 'error');
    }
}

function initializeSaveBar() {
    console.log('Initializing save bar...');
    const saveBtn = document.getElementById('saveApplySettings');
    const resetBtn = document.getElementById('resetApplySettings');

    if (saveBtn) {
        saveBtn.addEventListener('click', saveApplySettings);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all apply settings?')) {
                window.location.reload();
            }
        });
    }
}

function initializeGlobalControls() {
    const enableAllBtn = document.getElementById('enableAllPositions');
    const disableAllBtn = document.getElementById('disableAllPositions');
    const addPositionBtn = document.getElementById('addPosition');

    if (enableAllBtn) {
        enableAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.position-toggle').forEach(toggle => {
                toggle.checked = true;
                showSaveBar();
            });
            updateApplyStats();
        });
    }

    if (disableAllBtn) {
        disableAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.position-toggle').forEach(toggle => {
                toggle.checked = false;
                showSaveBar();
            });
            updateApplyStats();
        });
    }

    if (addPositionBtn) {
        addPositionBtn.addEventListener('click', () => {
            const newPositionForm = document.getElementById('newPositionForm');
            if (newPositionForm) {
                newPositionForm.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

function initializeDeleteButtons() {
    document.querySelectorAll('.delete-position').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const positionCard = e.target.closest('.position-card');
            const index = positionCard.dataset.position;

            if (confirm('Are you sure you want to delete this position?')) {
                try {
                    const response = await fetch(`/api/apply/positions/${index}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) throw new Error('Failed to delete position');

                    positionCard.style.opacity = '0';
                    positionCard.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        positionCard.remove();
                        updateApplyStats();
                    }, 300);
                    showToast('Position deleted successfully', 'success');
                } catch (error) {
                    console.error('Error deleting position:', error);
                    showToast('Failed to delete position', 'error');
                }
            }
        });
    });
}

function initializeQuestionControls() {
    document.querySelectorAll('.add-question').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const container = e.target.closest('.form-group').querySelector('.questions-container');
            const positionIndex = container.dataset.position;
            
            const questionDiv = document.createElement('div');
            questionDiv.className = 'flex items-center gap-2';
            questionDiv.innerHTML = `
                <input type="text" class="question-input input-field flex-1"
                       data-position="${positionIndex}"
                       data-question="${container.children.length}">
                <button type="button" class="delete-question px-2 py-1 text-red-500 hover:text-red-600">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            container.appendChild(questionDiv);
            initializeDeleteQuestionButtons();
            showSaveBar();
        });
    });

    initializeDeleteQuestionButtons();
}

function initializeDeleteQuestionButtons() {
    document.querySelectorAll('.delete-question').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const questionDiv = e.target.closest('div');
            questionDiv.style.opacity = '0';
            questionDiv.style.transform = 'scale(0.95)';
            setTimeout(() => {
                questionDiv.remove();
                showSaveBar();
            }, 300);
        });
    });
}

function updateApplyStats() {
    const activeCount = document.querySelectorAll('.position-toggle:checked').length;
    animateStatValue('activePositions', activeCount);

    const reviewerRoles = new Set();
    document.querySelectorAll('.position-reviewerRoles').forEach(select => {
        Array.from(select.selectedOptions).forEach(option => {
            reviewerRoles.add(option.value);
        });
    });
    animateStatValue('reviewerRoles', reviewerRoles.size);

    const cooldowns = Array.from(document.querySelectorAll('.position-cooldown'))
        .map(input => parseInt(input.value) || 0)
        .filter(val => val > 0);
    const avgCooldown = cooldowns.length ? 
        Math.round(cooldowns.reduce((a, b) => a + b, 0) / cooldowns.length) : 0;
    animateStatValue('avgCooldown', avgCooldown + 'h');

    const acceptedRoles = new Set();
    document.querySelectorAll('.position-acceptRoles').forEach(select => {
        Array.from(select.selectedOptions).forEach(option => {
            acceptedRoles.add(option.value);
        });
    });
    animateStatValue('totalAccepted', acceptedRoles.size);
}

function animateStatValue(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.classList.remove('stat-update');
    element.textContent = newValue;
    void element.offsetWidth;
    element.classList.add('stat-update');
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

function initializeNewPositionForm() {
    const addBtn = document.getElementById('addPosition');
    const form = document.getElementById('newPositionForm');
    const submitBtn = document.getElementById('submitNewPosition');
    const cancelBtn = document.getElementById('cancelNewPosition');

    if (addBtn && form) {
        addBtn.addEventListener('click', () => {
            form.scrollIntoView({ behavior: 'smooth' });
        });
    }

    const questionsContainer = document.getElementById('new-position-questions');
    const addQuestionBtn = document.getElementById('new-position-add-question');

    if (addQuestionBtn && questionsContainer) {
        addQuestionBtn.addEventListener('click', () => {
            const questionCount = questionsContainer.querySelectorAll('.question-input').length;
            if (questionCount >= 5) {
                showToast('Maximum 5 questions allowed', 'error');
                return;
            }

            const questionDiv = document.createElement('div');
            questionDiv.className = 'flex items-center gap-2';
            questionDiv.innerHTML = `
                <input type="text" class="question-input input-field flex-1" 
                       placeholder="Enter your question (max 45 chars)" required maxlength="45">
                <button type="button" class="delete-question px-2 py-1 text-red-500 hover:text-red-600">
                    <i class="fas fa-times"></i>
                </button>
            `;

            questionsContainer.appendChild(questionDiv);
            
            const deleteBtn = questionDiv.querySelector('.delete-question');
            deleteBtn.addEventListener('click', () => {
                const remainingQuestions = questionsContainer.querySelectorAll('.question-input').length;
                if (remainingQuestions > 1) {
                    questionDiv.remove();
                } else {
                    showToast('Minimum 1 question required', 'error');
                }
            });
        });

        const initialDeleteBtn = questionsContainer.querySelector('.delete-question');
        if (initialDeleteBtn) {
            initialDeleteBtn.addEventListener('click', () => {
                showToast('Minimum 1 question required', 'error');
            });
        }
    }

    const acceptMessage = document.getElementById('new-position-acceptMessage');
    const counter = document.getElementById('acceptMessage-counter');
    if (acceptMessage && counter) {
        acceptMessage.addEventListener('input', () => {
            const count = acceptMessage.value.length;
            counter.textContent = count;
            counter.classList.toggle('text-red-500', count > 1500);
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            try {
                const name = document.getElementById('new-position-name')?.value.trim();
                const questions = Array.from(document.querySelectorAll('#new-position-questions .question-input'))
                    .map(input => input.value.trim())
                    .filter(q => q);
                const acceptMessage = document.getElementById('new-position-acceptMessage')?.value.trim();

                if (name.length > 15) {
                    showToast('Position name must be 15 characters or less', 'error');
                    return;
                }

                if (questions.some(q => q.length > 45)) {
                    showToast('Questions must be 45 characters or less', 'error');
                    return;
                }

                if (acceptMessage.length > 1500) {
                    showToast('Accept message must be 1500 characters or less', 'error');
                    return;
                }

                const newPosition = {
                    enabled: true,
                    name: document.getElementById('new-position-name')?.value,
                    emoji: document.getElementById('new-position-emoji')?.value,
                    color: document.getElementById('new-position-color')?.value,
                    logChannel: document.getElementById('new-position-logChannel')?.value,
                    description: '',
                    reviewers: {
                        roles: Array.from(document.getElementById('new-position-reviewerRoles')?.selectedOptions || [])
                            .map(option => option.value)
                    },
                    cooldown: parseInt(document.getElementById('new-position-cooldown')?.value || '24'),
                    questions: questions,
                    requirements: {
                        minimumAge: parseInt(document.getElementById('new-position-minAge')?.value || '0'),
                        minimumGuildAge: parseInt(document.getElementById('new-position-minGuildAge')?.value || '0') * 86400000,
                        requiredRoles: Array.from(document.getElementById('new-position-requiredRoles')?.selectedOptions || [])
                            .map(option => option.value),
                        blacklistedRoles: Array.from(document.getElementById('new-position-blacklistedRoles')?.selectedOptions || [])
                            .map(option => option.value)
                    },
                    acceptRoles: Array.from(document.getElementById('new-position-acceptRoles')?.selectedOptions || [])
                        .map(option => option.value),
                    acceptMessage: document.getElementById('new-position-acceptMessage')?.value || ''
                };

                if (!newPosition.name || !newPosition.emoji || !newPosition.logChannel || 
                    !newPosition.reviewers.roles.length || questions.length === 0) {
                    showToast('Please fill in all required fields', 'error');
                    return;
                }

                const response = await fetch('/api/apply/positions/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newPosition)
                });

                if (!response.ok) throw new Error('Failed to add position');

                showToast('Position added successfully', 'success');
                window.location.reload();
            } catch (error) {
                console.error('Error adding position:', error);
                showToast('Failed to add position', 'error');
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.getElementById('new-position-name').value = '';
            document.getElementById('new-position-emoji').value = '';
            document.getElementById('new-position-color').value = '#777bc9';
            document.getElementById('new-position-logChannel').value = '';
            document.getElementById('new-position-reviewerRoles').selectedIndex = -1;
            document.getElementById('new-position-requiredRoles').selectedIndex = -1;
            document.getElementById('new-position-blacklistedRoles').selectedIndex = -1;
            document.getElementById('new-position-acceptRoles').selectedIndex = -1;
            document.getElementById('new-position-acceptMessage').value = '';
            document.getElementById('new-position-cooldown').value = '24';
            document.getElementById('new-position-minAge').value = '0';
            document.getElementById('new-position-minGuildAge').value = '0';
            
            const questionsContainer = document.getElementById('new-position-questions');
            const questions = questionsContainer.querySelectorAll('.flex');
            questions.forEach((q, index) => {
                if (index > 0) q.remove();
            });
            questionsContainer.querySelector('.question-input').value = '';
        });
    }
}

function initializeEmojiPickers() {
    document.querySelectorAll('.emoji-picker-btn').forEach(btn => {
        const input = btn.parentElement.querySelector('input');
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('.emoji-mart').forEach(p => p.remove());

            const rect = btn.getBoundingClientRect();
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
                if (!picker.contains(e.target) && !btn.contains(e.target)) {
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