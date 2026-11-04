(function () {
    'use strict';

    if (window.location.pathname !== '/welcome') return;

    const $ = (id) => document.getElementById(id);
    let targets = { guild: null, channels: [], roles: [] };
    let currentWelcome = {};
    const isArabic = document.documentElement.lang === 'ar';
    const copy = {
        optionLabel: isArabic ? 'اسم الخيار' : 'Option label',
        emoji: isArabic ? 'رمز تعبيري' : 'Emoji',
        chooseRole: isArabic ? 'اختر رتبة...' : 'Choose a role...',
        chooseChannel: isArabic ? 'اختر قناة...' : 'Choose a channel...',
        reply: isArabic ? 'إرسال رد' : 'Send a reply',
        channel: isArabic ? 'فتح قناة' : 'Open a channel',
        role: isArabic ? 'إضافة/إزالة رتبة' : 'Add/remove a role',
        responsePlaceholder: isArabic ? 'ما الرد الذي يرسله هذا الخيار؟' : 'What should this option reply?',
        roleHint: isArabic ? 'يمكن للأعضاء إضافة هذه الرتبة أو إزالتها.' : 'Members can add or remove this role.',
        channelHint: isArabic ? 'يمكن للأعضاء فتح هذه القناة.' : 'Members can open this channel.',
        messageHint: isArabic ? 'إرسال رد خاص عند اختيار هذا الخيار.' : 'Send a private reply when this option is selected.',
        saveSuccess: isArabic ? 'تم حفظ إعدادات قائمة الترحيب بنجاح.' : 'Welcome menu settings saved successfully.'
    };

    function setStatus(message, type) {
        const element = $('welcomeStudioStatus');
        element.textContent = message;
        element.className = 'welcome-status-message is-visible ' + (type === 'error' ? 'is-error' : 'is-success');
    }

    async function api(url, options) {
        const response = await fetch(url, Object.assign({
            headers: { 'Content-Type': 'application/json' }
        }, options || {}));
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed (${response.status})`);
        return data;
    }

    function setValue(id, value) {
        const element = $(id);
        if (element) element.value = value || '';
    }

    function setColorValue(value) {
        const color = /^#[0-9a-f]{6}$/i.test(String(value || ''))
            ? String(value)
            : '#777bc9';
        const input = $('menuColor');
        const output = $('menuColorValue');
        if (input) input.value = color;
        if (output) output.value = color.toUpperCase();
        if (output) output.textContent = color.toUpperCase();
    }

    function populateChannelSelect(channels) {
        const select = $('welcomeChannelSelect');
        if (!select) return;
        select.querySelectorAll('option:not(:first-child)').forEach((option) => option.remove());
        (Array.isArray(channels) ? channels : []).forEach((channel) => {
            select.add(new Option(`# ${channel.name}`, channel.id));
        });
        window.initializeCustomSelects?.();
    }

    function optionTargetSelect(type, selectedId) {
        const select = document.createElement('select');
        select.className = 'welcome-option-select';
        select.dataset.optionTarget = '';
        select.setAttribute('aria-label', 'Choose target');
        select.add(new Option(type === 'role' ? copy.chooseRole : copy.chooseChannel, ''));
        const values = type === 'role' ? targets.roles : targets.channels;
        values.forEach((item) => {
            select.add(new Option(type === 'role' ? `@ ${item.name}` : `# ${item.name}`, item.id));
        });
        select.value = selectedId || '';
        return select;
    }

    function updateOptionMode(card, selectedTarget) {
        const action = card.querySelector('[data-option-action]').value;
        const target = card.querySelector('[data-option-target-wrap]');
        const response = card.querySelector('[data-option-response-wrap]');
        target.innerHTML = '';
        target.classList.toggle('is-hidden', action === 'message');
        response.classList.toggle('is-hidden', action !== 'message');
        if (action !== 'message') {
            target.appendChild(optionTargetSelect(action, selectedTarget || ''));
            window.initializeCustomSelects?.();
        }
        card.querySelector('[data-option-action-hint]').textContent = action === 'role'
            ? copy.roleHint
            : action === 'channel'
                ? copy.channelHint
                : copy.messageHint;
    }

    function createOption(option, index) {
        const responseType = option.response?.type === 'role' || option.response?.type === 'channel'
            ? option.response.type
            : 'message';
        const card = document.createElement('article');
        card.className = 'welcome-option-card';
        card.dataset.optionId = option.id || `welcome-option-${index + 1}`;
        card.innerHTML = `
            <div class="welcome-option-card-top">
                <span class="welcome-option-number">${index + 1}</span>
                <input data-option-label maxlength="100" placeholder="${copy.optionLabel}">
                <button type="button" class="welcome-option-remove" data-remove-option aria-label="${isArabic ? 'إزالة الخيار' : 'Remove option'}"><i class="fas fa-trash"></i></button>
            </div>
            <div class="welcome-option-card-fields">
                <input data-option-emoji maxlength="32" placeholder="${copy.emoji}" aria-label="${isArabic ? 'رمز الخيار التعبيري' : 'Option emoji'}">
                <select data-option-action class="welcome-option-select" aria-label="Option action">
                    <option value="message">${copy.reply}</option>
                    <option value="channel">${copy.channel}</option>
                    <option value="role">${copy.role}</option>
                </select>
                <div data-option-target-wrap class="welcome-option-target"></div>
            </div>
            <div data-option-response-wrap class="welcome-option-response">
                <textarea data-option-response maxlength="2000" rows="2" placeholder="${copy.responsePlaceholder}"></textarea>
            </div>
            <small data-option-action-hint class="welcome-option-hint"></small>
        `;
        card.querySelector('[data-option-emoji]').value = option.emoji || '';
        card.querySelector('[data-option-label]').value = option.label || `Option ${index + 1}`;
        card.querySelector('[data-option-action]').value = responseType;
        card.querySelector('[data-option-response]').value = option.response?.text || '';
        updateOptionMode(card, option.response?.roleId || option.response?.channelId || '');
        return card;
    }

    function syncOptionEmpty() {
        const empty = $('welcomeOptionEmpty');
        const list = $('welcomeOptionList');
        if (empty && list) empty.classList.toggle('is-hidden', list.children.length > 0);
    }

    function populateOptions(selectMenu) {
        const list = $('welcomeOptionList');
        if (!list) return;
        list.innerHTML = '';
        setValue('welcomeDropdownPlaceholder', selectMenu?.placeholder);
        (selectMenu?.options || []).forEach((option, index) => list.appendChild(createOption(option, index)));
        syncOptionEmpty();
    }

    function addOption() {
        const list = $('welcomeOptionList');
        if (!list) return;
        const index = list.children.length;
        const card = createOption({
            id: `welcome-option-${Date.now()}-${index}`,
            label: `Option ${index + 1}`,
            emoji: '✨',
            response: { type: 'message', text: '' }
        }, index);
        list.appendChild(card);
        syncOptionEmpty();
        card.querySelector('[data-option-label]').focus();
    }

    function collectOptions() {
        const list = $('welcomeOptionList');
        if (!list) return currentWelcome.selectMenu;
        const options = Array.from(list.children).map((card, index) => {
            const type = card.querySelector('[data-option-action]').value;
            const target = card.querySelector('[data-option-target]');
            const option = {
                id: card.dataset.optionId || `welcome-option-${index + 1}`,
                label: card.querySelector('[data-option-label]').value.trim() || `Option ${index + 1}`,
                description: '',
                emoji: card.querySelector('[data-option-emoji]').value.trim() || undefined,
                response: { type, ephemeral: true, format: 'plain' }
            };
            if (type === 'role') option.response.roleId = target?.value || undefined;
            if (type === 'channel') option.response.channelId = target?.value || undefined;
            if (type === 'message') option.response.text = card.querySelector('[data-option-response]').value.trim();
            return option;
        });
        return options.length ? {
            placeholder: $('welcomeDropdownPlaceholder').value.trim() || 'Choose an option...',
            options
        } : undefined;
    }

    function populate(welcome) {
        currentWelcome = welcome || {};
        const enabled = welcome.enabled === true;
        setValue('welcomeEnabled', String(enabled));
        setValue('welcomeChannelId', welcome.channelId);
        if ($('welcomeEnabledToggle')) $('welcomeEnabledToggle').checked = enabled;
        if ($('welcomeChannelSelect')) $('welcomeChannelSelect').value = welcome.channelId || '';
        setValue('menuTitle', welcome.menuTitle || 'Server Menu');
        setValue('menuDescription', welcome.menuDescription || 'Choose an option below.');
        setColorValue(welcome.color);
        setValue('menuImageUrl', welcome.menuImageUrl);
        populateOptions(welcome.selectMenu);
    }

    $('welcomeEnabledToggle').addEventListener('change', (event) => {
        const enabled = event.target.checked;
        setValue('welcomeEnabled', String(enabled));
    });

    $('welcomeChannelSelect').addEventListener('change', (event) => {
        setValue('welcomeChannelId', event.target.value);
    });

    $('menuColor')?.addEventListener('input', (event) => {
        setColorValue(event.target.value);
    });

    $('addWelcomeOption')?.addEventListener('click', addOption);

    $('welcomeOptionList')?.addEventListener('click', (event) => {
        const remove = event.target.closest('[data-remove-option]');
        if (!remove) return;
        remove.closest('.welcome-option-card').remove();
        syncOptionEmpty();
    });

    $('welcomeOptionList')?.addEventListener('change', (event) => {
        const action = event.target.closest('[data-option-action]');
        if (action) updateOptionMode(action.closest('.welcome-option-card'));
    });

    $('welcomeForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const data = await api('/api/welcome-embed', {
                method: 'POST',
                body: JSON.stringify({
                    ...currentWelcome,
                    enabled: $('welcomeEnabledToggle').checked,
                    channelId: $('welcomeChannelSelect').value,
                    menuEnabled: true,
                    menuTitle: $('menuTitle').value.trim(),
                    menuDescription: $('menuDescription').value.trim(),
                    color: $('menuColor').value,
                    menuImageUrl: $('menuImageUrl').value.trim(),
                    selectMenu: collectOptions()
                })
            });
            populate(data.welcome);
            setStatus(copy.saveSuccess, 'success');
        } catch (error) {
            setStatus(error.message, 'error');
        }
    });

    Promise.all([api('/api/welcome-embed'), api('/api/welcome-targets')])
        .then(([welcomeData, targetData]) => {
            targets = targetData;
            populateChannelSelect(targetData.channels);
            populate(welcomeData.welcome || {});
        })
        .catch((error) => setStatus(error.message, 'error'));
}());