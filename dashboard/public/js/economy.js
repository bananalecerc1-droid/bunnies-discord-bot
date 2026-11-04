document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.economy-page');
    const form = document.getElementById('economySettingsForm');
    if (!page || !form) return;

    const byId = (id) => document.getElementById(id);
    const switches = [...page.querySelectorAll('[data-toggle]')];
    const status = byId('syncStatus');
    const statusText = byId('syncStatusText');
    const saveButton = byId('saveEconomySettings');
    const gameSelect = byId('gameRewardGame');
    const gameMin = byId('gameRewardMin');
    const gameMax = byId('gameRewardMax');
    const gameRewards = window.economyGameRewards || {};
    const syncGameFields = () => { const value = gameRewards[gameSelect.value] || { min: 0, max: 0 }; gameMin.value = value.min; gameMax.value = value.max; };
    gameSelect?.addEventListener('change', syncGameFields);
    gameMin?.addEventListener('input', () => { gameRewards[gameSelect.value] = { min: numberValue('gameRewardMin'), max: numberValue('gameRewardMax') }; setStatus('Unsaved changes'); });
    gameMax?.addEventListener('input', () => { gameRewards[gameSelect.value] = { min: numberValue('gameRewardMin'), max: numberValue('gameRewardMax') }; setStatus('Unsaved changes'); });
    syncGameFields();

    const numberValue = (id) => Math.max(0, Number(byId(id).value || 0));
    const formatNumber = (value) => Number(value || 0).toLocaleString('en-US');
    const setStatus = (message, saving = false) => {
        statusText.textContent = message;
        status.classList.toggle('is-saving', saving);
    };
    const isEnabled = (id) => {
        const control = page.querySelector(`[data-toggle="${id}"]`);
        return control?.getAttribute('aria-checked') === 'true';
    };

    function updateToggle(control, checked) {
        control.setAttribute('aria-checked', String(checked));
        setStatus('Unsaved changes', false);
        updatePreview();
    }

    switches.forEach((control) => {
        control.addEventListener('click', () => {
            updateToggle(control, control.getAttribute('aria-checked') !== 'true');
        });
        control.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                control.click();
            }
        });
    });

    function closeSelect(select) {
        select.classList.remove('is-open');
        select.querySelector('.custom-select-button')?.setAttribute('aria-expanded', 'false');
    }

    page.querySelectorAll('.custom-select').forEach((select) => {
        const button = select.querySelector('.custom-select-button');
        const hiddenInput = byId(select.dataset.select);
        const label = button.querySelector('span');

        const selectOption = (option) => {
            hiddenInput.value = option.dataset.value;
            label.textContent = option.querySelector('span').textContent;
            select.querySelectorAll('[role="option"]').forEach((item) => item.classList.remove('is-selected'));
            option.classList.add('is-selected');
            closeSelect(select);
            setStatus('Unsaved changes');
            updatePreview();
        };

        const current = select.querySelector(`[data-value="${hiddenInput.value}"]`) || select.querySelector('[role="option"]');
        if (current) {
            label.textContent = current.querySelector('span').textContent;
            current.classList.add('is-selected');
        }

        button.addEventListener('click', () => {
            const willOpen = !select.classList.contains('is-open');
            page.querySelectorAll('.custom-select.is-open').forEach(closeSelect);
            if (willOpen) {
                select.classList.add('is-open');
                button.setAttribute('aria-expanded', 'true');
            }
        });
        select.querySelectorAll('[role="option"]').forEach((option) => {
            option.addEventListener('click', () => selectOption(option));
        });
    });

    function updateRangeOutput(minId, maxId, outputId) {
        const min = numberValue(minId);
        const max = numberValue(maxId);
        byId(outputId).textContent = `${formatNumber(min)} – ${formatNumber(max)} coins`;
    }

    function updatePreview() {
        const starting = numberValue('startingCash');
        const name = byId('currencyName').value.trim() || 'Coins';
        const emoji = byId('currencyEmoji').value.trim() || '🪙';
        byId('overviewCurrency').textContent = `${emoji} ${name}`;
        byId('overviewStarting').textContent = formatNumber(starting);
        byId('overviewDaily').textContent = `${formatNumber(numberValue('dailyRewardMin'))} – ${formatNumber(numberValue('dailyRewardMax'))}`;
        byId('overviewBump').textContent = `${formatNumber(numberValue('bumpRewardMin'))} – ${formatNumber(numberValue('bumpRewardMax'))}`;
        byId('previewCurrencyEmoji')?.replaceChildren(document.createTextNode(emoji));
        byId('previewCurrencyName')?.replaceChildren(document.createTextNode(name));
        byId('previewStartingCash')?.replaceChildren(document.createTextNode(formatNumber(starting)));
        byId('previewCurrencyLabel')?.replaceChildren(document.createTextNode(name));
        updateRangeOutput('dailyRewardMin', 'dailyRewardMax', 'dailyRangeOutput');
        updateRangeOutput('bumpRewardMin', 'bumpRewardMax', 'bumpRangeOutput');
    }

    page.querySelectorAll('input').forEach((input) => {
        input.addEventListener('input', () => {
            setStatus('Unsaved changes');
            updatePreview();
        });
    });

    page.querySelectorAll('.economy-nav-link').forEach((link) => {
        link.addEventListener('click', () => {
            page.querySelectorAll('.economy-nav-link').forEach((item) => item.classList.remove('is-active'));
            link.classList.add('is-active');
        });
    });

    const sections = [...page.querySelectorAll('.economy-section')];
    const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        page.querySelectorAll('.economy-nav-link').forEach((link) => {
            link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`);
        });
    }, { rootMargin: '-18% 0px -62% 0px', threshold: [0, .2, .5] });
    sections.forEach((section) => observer.observe(section));

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.custom-select')) {
            page.querySelectorAll('.custom-select.is-open').forEach(closeSelect);
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const dailyMin = numberValue('dailyRewardMin');
        const dailyMax = numberValue('dailyRewardMax');
        const bumpMin = numberValue('bumpRewardMin');
        const bumpMax = numberValue('bumpRewardMax');

        if (!form.checkValidity()) {
            form.reportValidity();
            setStatus('Check the highlighted fields');
            return;
        }
        if (dailyMin > dailyMax || bumpMin > bumpMax) {
            setStatus('Fix the reward ranges first');
            economyToast('Minimum rewards cannot be greater than maximum rewards.', 'error');
            return;
        }

        const payload = {
            enabled: isEnabled('economyEnabled'),
            currencyName: byId('currencyName').value.trim(),
            currencyEmoji: byId('currencyEmoji').value.trim(),
            startingCash: numberValue('startingCash'),
            dailyRewardEnabled: isEnabled('dailyRewardEnabled'),
            dailyRewardMin: dailyMin,
            dailyRewardMax: dailyMax,
            dailyCooldownHours: Number(byId('dailyCooldownHours').value),
            transfersEnabled: isEnabled('transfersEnabled'),
            bumpRewardEnabled: isEnabled('bumpRewardEnabled'),
            bumpRewardMin: bumpMin,
            bumpRewardMax: bumpMax,
            bumpCooldownMinutes: Number(byId('bumpCooldownMinutes').value),
            disboardBotId: byId('disboardBotId').value.trim(),
            gameRewards
        };

        saveButton.disabled = true;
        saveButton.querySelector('.button-label').textContent = 'Saving…';
        saveButton.querySelector('i').className = 'fas fa-circle-notch economy-spin';
        setStatus('Saving changes…', true);

        try {
            const response = await fetch('/api/economy/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save settings');
            setStatus('All changes saved');
            economyToast('Economy settings synced with the bot.', 'success');
        } catch (error) {
            console.error('Error saving economy settings:', error);
            setStatus('Save failed');
            economyToast(error.message || 'Unable to save economy settings.', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.querySelector('.button-label').textContent = 'Save changes';
            saveButton.querySelector('i').className = 'fas fa-arrow-right';
        }
    });

    updatePreview();
});

function economyToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `economy-toast ${type === 'success' ? 'is-success' : 'is-error'}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}"></i><span></span>`;
    toast.querySelector('span').textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 240);
    }, 4200);
}