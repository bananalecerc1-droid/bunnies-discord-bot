(function () {
    'use strict';

    if (window.location.pathname !== '/embeds') return;

    const $ = (id) => document.getElementById(id);
    let embeds = {};
    let discordRoles = [];

    function setStatus(message, type) {
        const element = $('embedStudioStatus');
        element.textContent = message || '';
        element.className = 'embed-status-message ' + (message ? `is-visible ${type === 'error' ? 'is-error' : 'is-success'}` : '');
    }

    function getRoleColor(role) {
        const color = Number(role?.color);
        if (!Number.isFinite(color) || color <= 0) return '#7f8aa8';
        return `#${Math.min(0xffffff, Math.max(0, Math.trunc(color))).toString(16).padStart(6, '0')}`;
    }

    async function api(url, options) {
        const response = await fetch(url, Object.assign({
            headers: { 'Content-Type': 'application/json' }
        }, options || {}));
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed (${response.status})`);
        return data;
    }

    function slugify(value, fallback) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || fallback;
    }

    function addButtonRow(button) {
        const row = document.createElement('div');
        row.className = 'embed-button-row studio-reveal';
        row.innerHTML = `
            <label class="button-emoji-input"><span data-button-emoji-preview>${button.emoji || '😀'}</span><input data-button-emoji maxlength="32" placeholder="😀" aria-label="Button emoji"></label>
            <label class="studio-field compact button-label-field"><input data-button-label maxlength="80" placeholder="Button" aria-label="Button label"></label>
            <label class="studio-field compact button-type-field"><div class="custom-select-wrap"><select data-button-type class="studio-select" aria-label="Button type"><option value="action">⚡ Action</option><option value="link">🔗 Link</option></select><i class="fas fa-chevron-down"></i></div></label>
            <label class="studio-field compact button-style-field"><div class="custom-select-wrap"><select data-button-style class="studio-select" aria-label="Button color">
                <option value="Primary">🔵 Blue</option><option value="Secondary">⚪ Gray</option><option value="Success">🟢 Green</option><option value="Danger">🔴 Red</option>
            </select><i class="fas fa-chevron-down"></i></div></label>
            <button type="button" data-remove-button class="remove-button" aria-label="Remove button"><i class="fas fa-trash"></i></button>
            <label data-button-url-field class="studio-field compact button-url-field">
                <span>LINK URL</span><input data-button-url type="url" placeholder="https://example.com">
            </label>
            <div class="button-response-editor">
                <div class="response-label">RESPONSE WHEN CLICKED</div>
                <div class="response-grid">
                    <div class="response-type"><span>⚡</span><select data-button-response-type aria-label="Response type"><option value="message">💬 Message</option></select><i class="fas fa-chevron-down"></i></div>
                    <textarea data-button-response-text maxlength="2000" placeholder="Reply text..." aria-label="Reply text"></textarea>
                </div>
                <div class="response-footer">
                    <label class="response-check"><input data-button-ephemeral type="checkbox" checked><span>✓</span><b>🔒</b> Hidden response <em>(only visible to clicker)</em></label>
                    <div class="response-format"><span>Format:</span><button type="button" data-response-format="plain" class="is-active">📄 Plain</button><button type="button" data-response-format="embed">🎨 Embed</button></div>
                </div>
            </div>
        `;

        row.querySelector('[data-button-label]').value = button.label || '';
        row.querySelector('[data-button-type]').value = button.url ? 'link' : 'action';
        row.querySelector('[data-button-style]').value = button.style || 'Primary';
        row.querySelector('[data-button-url]').value = button.url || '';
        row.querySelector('[data-button-emoji]').value = button.emoji || '';
        row.querySelector('[data-button-emoji-preview]').textContent = button.emoji || '😀';
        row.querySelector('[data-button-response-text]').value = button.response?.text || '';
        row.querySelector('[data-button-ephemeral]').checked = button.response?.ephemeral !== false;
        row.querySelectorAll('[data-response-format]').forEach((control) => {
            control.classList.toggle('is-active', (button.response?.format || 'plain') === control.dataset.responseFormat);
        });

        const typeSelect = row.querySelector('[data-button-type]');
        const urlField = row.querySelector('[data-button-url-field]');
        const styleField = row.querySelector('.button-style-field');
        const syncType = () => {
            const isLink = typeSelect.value === 'link';
            urlField.classList.toggle('is-visible', isLink);
            styleField.classList.toggle('is-muted', isLink);
            row.querySelector('[data-button-style]').disabled = isLink;
            renderPreview();
        };
        row.querySelector('[data-button-emoji]').addEventListener('input', (event) => {
            row.querySelector('[data-button-emoji-preview]').textContent = event.target.value.trim() || '😀';
            renderPreview();
        });
        row.querySelector('[data-button-url]').addEventListener('input', () => {
            button.url = row.querySelector('[data-button-url]').value.trim();
        });
        typeSelect.addEventListener('change', syncType);
        row.querySelectorAll('input, select, textarea').forEach((input) => input.addEventListener('input', renderPreview));
        row.querySelectorAll('[data-response-format]').forEach((control) => {
            control.addEventListener('click', () => {
                row.querySelectorAll('[data-response-format]').forEach((item) => item.classList.remove('is-active'));
                control.classList.add('is-active');
            });
        });
        row.querySelector('[data-remove-button]').addEventListener('click', () => {
            row.classList.add('is-removing');
            setTimeout(() => {
                row.remove();
                updateButtonEmptyState();
                renderPreview();
            }, 180);
        });
        $('embedButtonList').appendChild(row);
        syncType();
        updateButtonEmptyState();
        renderPreview();
    }

    function updateButtonEmptyState() {
        const count = $('embedButtonList').children.length;
        $('embedButtonEmpty').classList.toggle('is-hidden', count > 0);
    }

    function collectButtons() {
        return Array.from($('embedButtonList').children).map((row, index) => {
            const label = row.querySelector('[data-button-label]').value.trim();
            const url = row.querySelector('[data-button-url]').value.trim();
            if (!label) throw new Error(`Enter a label for button ${index + 1}.`);
            const format = row.querySelector('[data-response-format].is-active')?.dataset.responseFormat || 'plain';
            return {
                id: slugify(label, `button-${index + 1}`),
                label,
                style: row.querySelector('[data-button-style]').value,
                emoji: row.querySelector('[data-button-emoji]').value.trim() || undefined,
                response: {
                    type: 'message',
                    text: row.querySelector('[data-button-response-text]').value.trim(),
                    ephemeral: row.querySelector('[data-button-ephemeral]').checked,
                    format
                },
                ...(url ? { url } : {})
            };
        });
    }

    function setValue(id, value) {
        $(id).value = value || '';
    }

    function updateColorControls() {
        const color = $('embedColor').value || '#777BC9';
        $('embedColorValue').textContent = color.toUpperCase();
        document.querySelectorAll('.embed-color-preset').forEach((preset) => {
            preset.classList.toggle('is-active', preset.dataset.color.toUpperCase() === color.toUpperCase());
        });
    }

    function setEmbedColor(color) {
        if (!/^#[0-9a-f]{6}$/i.test(color)) return;
        $('embedColor').value = color;
        updateColorControls();
        renderPreview();
    }

    function renderPreview() {
        const title = $('embedTitle').value.trim();
        const description = $('embedDescription').value.trim();
        const content = $('embedContent')?.value.trim() || '';
        const footer = $('embedFooterText').value.trim();
        const color = $('embedColor').value || '#777BC9';
        const imageUrl = $('embedImageUrl').value.trim();
        const thumbnailUrl = $('embedThumbnailUrl').value.trim();
        const previewCard = $('previewCard');

        $('previewContent').textContent = content;
        $('previewTitle').textContent = title || '(no title)';
        $('previewDescription').textContent = description || 'Your embed description will appear here.';
        $('previewDescription').classList.toggle('is-placeholder', !description);
        $('previewFooter').textContent = footer;
        $('previewFooter').classList.toggle('is-visible', Boolean(footer));
        $('previewThumbnail').style.backgroundImage = /^https?:\/\//i.test(thumbnailUrl) ? `url("${thumbnailUrl.replace(/"/g, '%22')}")` : '';
        $('previewThumbnail').classList.toggle('is-visible', /^https?:\/\//i.test(thumbnailUrl));
        $('previewImage').style.backgroundImage = /^https?:\/\//i.test(imageUrl) ? `url("${imageUrl.replace(/"/g, '%22')}")` : '';
        $('previewImage').classList.toggle('is-visible', /^https?:\/\//i.test(imageUrl));
        previewCard.style.setProperty('--discord-embed-color', color);

        const previewButtons = $('previewButtons');
        previewButtons.innerHTML = '';
        const buttonRows = Array.from($('embedButtonList').children);
        const buttonCount = $('embedButtonCount');
        if (buttonCount) buttonCount.textContent = String(buttonRows.length);
        buttonRows.forEach((row) => {
            const label = row.querySelector('[data-button-label]').value.trim();
            if (!label) return;
            const button = document.createElement('span');
            button.className = `discord-preview-button ${row.querySelector('[data-button-style]').value.toLowerCase()}`;
            button.textContent = `${row.querySelector('[data-button-emoji]').value.trim()} ${label}`.trim();
            previewButtons.appendChild(button);
        });
    }

    function addSelectOption(option) {
        const row = document.createElement('div');
        row.className = 'select-option-card studio-reveal';
        row.innerHTML = `
            <div class="select-option-top">
                <label class="button-emoji-input"><span data-option-emoji-preview>${option.emoji || '😀'}</span><input data-option-emoji maxlength="32" placeholder="😀" aria-label="Option emoji"></label>
                <input data-option-label class="studio-input-lite" maxlength="100" placeholder="Option" aria-label="Option label">
                <input data-option-description class="studio-input-lite" maxlength="100" placeholder="Description (optional)" aria-label="Option description">
                <button type="button" data-remove-option class="remove-button" aria-label="Remove option"><i class="fas fa-trash"></i></button>
            </div>
            <div class="button-response-editor">
                <div class="response-label">RESPONSE WHEN SELECTED</div>
                <div class="response-grid">
                    <div class="response-type"><span>⚡</span><select data-option-response-type aria-label="Response type"><option value="message">💬 Message</option><option value="role">🎭 Get role</option></select><i class="fas fa-chevron-down"></i></div>
                    <textarea data-option-response-text maxlength="2000" placeholder="Reply text..." aria-label="Reply text"></textarea>
                </div>
                <div data-option-role-field class="role-picker-field">
                    <span>ROLE TO TOGGLE</span>
                    <div class="custom-select-wrap"><select data-option-role class="studio-select" aria-label="Role to toggle"><option value="">Loading roles...</option></select><i class="fas fa-chevron-down"></i></div>
                    <small>Selecting this option adds the role; selecting it again removes it.</small>
                </div>
                <div class="response-footer">
                    <label class="response-check"><input data-option-ephemeral type="checkbox" checked><span>✓</span><b>🔒</b> Hidden response <em>(only visible to selector)</em></label>
                    <div class="response-format"><span>Format:</span><button type="button" data-option-format="plain" class="is-active">📄 Plain</button><button type="button" data-option-format="embed">🎨 Embed</button></div>
                </div>
            </div>
        `;
        row.querySelector('[data-option-label]').value = option.label || '';
        row.querySelector('[data-option-description]').value = option.description || '';
        row.querySelector('[data-option-emoji]').value = option.emoji || '';
        row.querySelector('[data-option-response-type]').value = option.response?.type === 'role' ? 'role' : 'message';
        row.querySelector('[data-option-response-text]').value = option.response?.text || '';
        row.querySelector('[data-option-ephemeral]').checked = option.response?.ephemeral !== false;
        const roleSelect = row.querySelector('[data-option-role]');
        roleSelect.innerHTML = '<option value="">Choose a role...</option>';
        discordRoles.forEach((role) => {
            const roleOption = document.createElement('option');
            roleOption.value = role.id;
            roleOption.textContent = role.name;
            roleSelect.appendChild(roleOption);
        });
        if (option.response?.roleId && !discordRoles.some((role) => role.id === option.response.roleId)) {
            const savedRole = document.createElement('option');
            savedRole.value = option.response.roleId;
            savedRole.textContent = `Saved role (${option.response.roleId})`;
            roleSelect.appendChild(savedRole);
        }
        roleSelect.value = option.response?.roleId || '';
        row.querySelectorAll('[data-option-format]').forEach((control) => {
            control.classList.toggle('is-active', (option.response?.format || 'plain') === control.dataset.optionFormat);
            control.addEventListener('click', () => {
                row.querySelectorAll('[data-option-format]').forEach((item) => item.classList.remove('is-active'));
                control.classList.add('is-active');
            });
        });
        const responseType = row.querySelector('[data-option-response-type]');
        const roleField = row.querySelector('[data-option-role-field]');
        const syncResponseType = () => {
            const isRole = responseType.value === 'role';
            roleField.classList.toggle('is-visible', isRole);
            row.querySelector('[data-option-response-text]').placeholder = isRole ? 'Optional success message...' : 'Reply text...';
        };
        responseType.addEventListener('change', syncResponseType);
        row.querySelector('[data-option-emoji]').addEventListener('input', (event) => {
            row.querySelector('[data-option-emoji-preview]').textContent = event.target.value.trim() || '😀';
        });
        row.querySelector('[data-remove-option]').addEventListener('click', () => {
            row.classList.add('is-removing');
            setTimeout(() => { row.remove(); updateSelectEmptyState(); }, 180);
        });
        $('selectOptionList').appendChild(row);
        syncResponseType();
        updateSelectEmptyState();
    }

    function updateSelectEmptyState() {
        $('selectOptionEmpty').classList.toggle('is-hidden', $('selectOptionList').children.length > 0);
    }

    function collectSelectMenu() {
        const options = Array.from($('selectOptionList').children).map((row, index) => {
            const label = row.querySelector('[data-option-label]').value.trim();
            if (!label) throw new Error(`Enter a label for select option ${index + 1}.`);
            const type = row.querySelector('[data-option-response-type]').value;
            const roleId = row.querySelector('[data-option-role]').value;
            if (type === 'role' && !roleId) throw new Error(`Choose a role for select option ${index + 1}.`);
            return {
                id: slugify(label, `option-${index + 1}`),
                label,
                description: row.querySelector('[data-option-description]').value.trim(),
                emoji: row.querySelector('[data-option-emoji]').value.trim() || undefined,
                response: {
                    type,
                    text: row.querySelector('[data-option-response-text]').value.trim(),
                    ephemeral: row.querySelector('[data-option-ephemeral]').checked,
                    format: row.querySelector('[data-option-format].is-active')?.dataset.optionFormat || 'plain',
                    ...(type === 'role' ? { roleId } : {})
                }
            };
        });
        return options.length ? { placeholder: $('selectMenuPlaceholder').value.trim() || 'Choose an option...', options } : undefined;
    }

    function addReactionRole(role) {
        const row = document.createElement('div');
        row.className = 'reaction-role-row studio-reveal';
        row.innerHTML = `
            <label class="button-emoji-input"><span data-role-emoji-preview>${role.emoji || '😀'}</span><input data-role-emoji maxlength="32" placeholder="😀" aria-label="Reaction emoji"></label>
            <div class="reaction-role-picker">
                <button type="button" class="role-menu-trigger" data-role-menu-trigger aria-haspopup="listbox" aria-expanded="false">
                    <span class="role-menu-trigger-icon"><i class="fas fa-user-tag"></i></span>
                    <span data-role-name>Choose a role...</span>
                    <i class="fas fa-chevron-down role-menu-chevron"></i>
                </button>
                <div class="role-menu" data-role-menu role="listbox">
                    <div class="role-menu-search"><i class="fas fa-search"></i><input data-role-search type="search" placeholder="Search roles..." aria-label="Search roles"></div>
                    <div class="role-menu-options" data-role-options></div>
                    <div class="role-menu-empty" data-role-menu-empty>No matching roles.</div>
                </div>
                <input data-role-id type="hidden" aria-label="Selected Discord role ID">
            </div>
            <button type="button" data-remove-role class="remove-button" aria-label="Remove reaction role"><i class="fas fa-trash"></i></button>
        `;
        row.querySelector('[data-role-emoji]').value = role.emoji || '';
        row.querySelector('[data-role-id]').value = role.roleId || '';
        const roleIdInput = row.querySelector('[data-role-id]');
        const roleName = row.querySelector('[data-role-name]');
        const roleOptions = row.querySelector('[data-role-options]');
        const roleMenuEmpty = row.querySelector('[data-role-menu-empty]');
        const roleMenu = row.querySelector('[data-role-menu]');
        const roleSearch = row.querySelector('[data-role-search]');
        const roleTrigger = row.querySelector('[data-role-menu-trigger]');
        const getRoleChoices = () => {
            const savedRole = role.roleId && !discordRoles.some((item) => item.id === role.roleId)
                ? { id: role.roleId, name: `Saved role (${role.roleId})`, saved: true }
                : null;
            return savedRole ? [...discordRoles, savedRole] : discordRoles;
        };

        const closeRoleMenu = () => {
            roleMenu.classList.remove('is-open');
            roleMenu.classList.remove('is-above');
            roleMenu.classList.remove('is-floating');
            roleMenu.style.removeProperty('top');
            roleMenu.style.removeProperty('left');
            roleMenu.style.removeProperty('width');
            roleTrigger.setAttribute('aria-expanded', 'false');
        };
        const positionRoleMenu = () => {
            if (!roleMenu.classList.contains('is-open')) return;
            roleMenu.classList.add('is-floating');
            roleMenu.classList.remove('is-above');
            const triggerRect = roleTrigger.getBoundingClientRect();
            const viewportPadding = 12;
            const menuWidth = Math.min(Math.max(triggerRect.width, 240), window.innerWidth - (viewportPadding * 2));
            const menuLeft = Math.min(
                Math.max(triggerRect.left, viewportPadding),
                Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
            );
            const menuHeight = roleMenu.offsetHeight;
            const gap = 10;
            const spaceBelow = window.innerHeight - triggerRect.bottom;
            const spaceAbove = triggerRect.top;
            const openAbove = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;
            const maxMenuTop = Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding);
            const menuTop = openAbove
                ? Math.min(Math.max(viewportPadding, triggerRect.top - menuHeight - gap), maxMenuTop)
                : Math.min(triggerRect.bottom + gap, maxMenuTop);
            roleMenu.style.width = `${menuWidth}px`;
            roleMenu.style.left = `${menuLeft}px`;
            roleMenu.style.top = `${menuTop}px`;
            if (openAbove) {
                roleMenu.classList.add('is-above');
            }
        };
        const renderRoleOptions = (query = '') => {
            const normalizedQuery = query.trim().toLowerCase();
            roleOptions.innerHTML = '';
            const matches = getRoleChoices().filter((item) => {
                const name = String(item.name || '').toLowerCase();
                return !normalizedQuery || name.includes(normalizedQuery) || String(item.id).includes(normalizedQuery);
            });
            roleMenuEmpty.classList.toggle('is-visible', matches.length === 0);
            matches.forEach((item) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = `role-menu-option${item.id === roleIdInput.value ? ' is-selected' : ''}`;
                option.dataset.roleId = item.id;
                option.setAttribute('role', 'option');
                option.setAttribute('aria-selected', item.id === roleIdInput.value ? 'true' : 'false');
                option.innerHTML = '<span class="role-menu-option-swatch" aria-hidden="true"></span><span class="role-menu-option-copy"><b></b><small></small></span><i class="fas fa-check role-menu-option-check"></i>';
                option.querySelector('.role-menu-option-swatch').style.setProperty('--role-color', getRoleColor(item));
                option.querySelector('b').textContent = item.name;
                option.querySelector('small').textContent = item.saved ? 'Saved role ID' : item.id;
                option.addEventListener('click', () => {
                    roleIdInput.value = item.id;
                    roleName.textContent = item.name;
                    row.dataset.roleName = item.name;
                    roleOptions.querySelectorAll('.role-menu-option').forEach((control) => {
                        const selected = control === option;
                        control.classList.toggle('is-selected', selected);
                        control.setAttribute('aria-selected', selected ? 'true' : 'false');
                    });
                    closeRoleMenu();
                });
                roleOptions.appendChild(option);
            });
            positionRoleMenu();
        };
        const selectedRole = getRoleChoices().find((item) => item.id === role.roleId);
        roleName.textContent = selectedRole?.name || 'Choose a role...';
        row.dataset.roleName = selectedRole?.name || '';
        renderRoleOptions();
        roleTrigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const opening = !roleMenu.classList.contains('is-open');
            document.querySelectorAll('.reaction-role-picker .role-menu.is-open').forEach((menu) => {
                menu.classList.remove('is-open');
                menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
            });
            roleMenu.classList.toggle('is-open', opening);
            roleTrigger.setAttribute('aria-expanded', opening ? 'true' : 'false');
            if (opening) {
                roleTrigger.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                roleSearch.value = '';
                renderRoleOptions();
                roleSearch.focus();
                positionRoleMenu();
            }
        });
        roleMenu.addEventListener('click', (event) => event.stopPropagation());
        roleSearch.addEventListener('input', () => renderRoleOptions(roleSearch.value));
        roleSearch.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeRoleMenu();
                roleTrigger.focus();
            }
        });
        window.addEventListener('resize', positionRoleMenu);
        window.addEventListener('scroll', positionRoleMenu, true);
        row.querySelector('[data-role-emoji]').addEventListener('input', (event) => {
            row.querySelector('[data-role-emoji-preview]').textContent = event.target.value.trim() || '😀';
        });
        row.querySelector('[data-remove-role]').addEventListener('click', () => {
            row.classList.add('is-removing');
            setTimeout(() => { row.remove(); updateReactionEmptyState(); }, 180);
        });
        $('reactionRoleList').appendChild(row);
        updateReactionEmptyState();
    }

    function updateReactionEmptyState() {
        $('reactionRoleEmpty').classList.toggle('is-hidden', $('reactionRoleList').children.length > 0);
    }

    function collectReactionRoles() {
        return Array.from($('reactionRoleList').children).map((row, index) => {
            const emoji = row.querySelector('[data-role-emoji]').value.trim();
            const roleId = row.querySelector('[data-role-id]').value.trim();
            if (!emoji || !roleId) throw new Error(`Complete reaction role ${index + 1}.`);
            return { emoji, roleId };
        });
    }

    function clearAdvancedEditors() {
        $('selectMenuPlaceholder').value = '';
        $('selectOptionList').innerHTML = '';
        $('reactionRoleList').innerHTML = '';
        updateSelectEmptyState();
        updateReactionEmptyState();
    }

    function populateAdvancedEditors(embed) {
        clearAdvancedEditors();
        const selectMenu = embed?.selectMenu;
        if (selectMenu) {
            $('selectMenuPlaceholder').value = selectMenu.placeholder || '';
            (selectMenu.options || []).forEach(addSelectOption);
        }
        (embed?.reactionRoles || []).forEach(addReactionRole);
        updateSelectEmptyState();
        updateReactionEmptyState();
    }

    function populateEmbed(name) {
        const embed = embeds[name];
        $('embedName').value = name || '';
        $('editorModeLabel').textContent = name ? `EDITING / ${name.toUpperCase()}` : 'NEW EMBED';
        const modeStat = $('editorModeStat');
        const modeHint = $('editorModeStatHint');
        if (modeStat) modeStat.textContent = name ? 'Editing' : 'New embed';
        if (modeHint) modeHint.textContent = name ? 'saved template selected' : 'start from a blank canvas';
        if (!embed) {
            setValue('embedTitle', '');
            setValue('embedDescription', '');
            setValue('embedContent', '');
            setValue('embedColor', '#777BC9');
            updateColorControls();
            setValue('embedFooterText', '');
            setValue('embedUrl', '');
            setValue('embedImageUrl', '');
            setValue('embedThumbnailUrl', '');
            setValue('sendChannelId', '');
            $('embedButtonList').innerHTML = '';
            updateButtonEmptyState();
            clearAdvancedEditors();
            renderPreview();
            refreshSavedList('');
            return;
        }
        setValue('embedTitle', embed.title);
        setValue('embedDescription', embed.description);
        setValue('embedContent', embed.content);
        setValue('embedColor', embed.color || '#777BC9');
        updateColorControls();
        setValue('embedFooterText', embed.footerText);
        setValue('embedUrl', embed.url);
        setValue('embedImageUrl', embed.imageUrl);
        setValue('embedThumbnailUrl', embed.thumbnailUrl);
        $('embedButtonList').innerHTML = '';
        (embed.buttons || []).forEach(addButtonRow);
        updateButtonEmptyState();
        populateAdvancedEditors(embed);
        renderPreview();
        refreshSavedList(name);
    }

    function refreshSavedList(selected) {
        const list = $('savedEmbedList');
        list.innerHTML = '';
        const names = Object.keys(embeds).sort();
        const count = $('embedLibraryCount');
        if (count) count.textContent = String(names.length);
        const total = $('embedLibraryTotal');
        if (total) total.textContent = String(names.length);
        if (!names.length) {
            list.innerHTML = '<div class="saved-empty"><i class="fas fa-inbox"></i><span>No saved embeds yet.</span><small>Create your first reusable message.</small></div>';
            return;
        }
        names.forEach((name) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `saved-embed-item ${name === selected ? 'is-active' : ''}`;
            item.innerHTML = `<span class="saved-embed-dot"></span><span class="saved-embed-name"></span><span class="saved-embed-arrow"><i class="fas fa-chevron-right"></i></span>`;
            item.querySelector('.saved-embed-name').textContent = name;
            item.addEventListener('click', () => {
                $('embedSelector').value = name;
                populateEmbed(name);
            });
            list.appendChild(item);
        });
    }

    function refreshEmbedSelector(selected) {
        const selector = $('embedSelector');
        selector.innerHTML = '<option value="">New embed</option>';
        Object.keys(embeds).sort().forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            selector.appendChild(option);
        });
        selector.value = selected && embeds[selected] ? selected : '';
        refreshSavedList(selected);
    }

    function embedBody() {
        return {
            content: $('embedContent').value.trim(),
            title: $('embedTitle').value.trim(),
            description: $('embedDescription').value.trim(),
            color: $('embedColor').value,
            url: $('embedUrl').value.trim(),
            imageUrl: $('embedImageUrl').value.trim(),
            thumbnailUrl: $('embedThumbnailUrl').value.trim(),
            footerText: $('embedFooterText').value.trim(),
            buttons: collectButtons(),
            selectMenu: collectSelectMenu(),
            reactionRoles: collectReactionRoles()
        };
    }

    async function saveEmbed(sendAfterSave) {
        const name = $('embedName').value.trim();
        if (!name) throw new Error('Enter an embed name first.');
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw new Error('Use only letters, numbers, hyphens, or underscores in the name.');
        const data = await api('/api/embeds/' + encodeURIComponent(name), {
            method: 'POST',
            body: JSON.stringify(embedBody())
        });
        embeds[name] = data.embed;
        refreshEmbedSelector(name);
        $('embedSelector').value = name;
        if (sendAfterSave) {
            await sendSavedEmbed(name);
            setStatus(`Saved and sent “${name}”.`, 'success');
        } else {
            setStatus(`Saved “${name}”.`, 'success');
        }
    }

    async function sendSavedEmbed(name) {
        const channelId = $('sendChannelId').value.trim();
        if (!channelId) throw new Error('Enter a channel ID to send the embed.');
        await api('/api/embeds/' + encodeURIComponent(name) + '/send', {
            method: 'POST',
            body: JSON.stringify({ channelId })
        });
    }

    function startNewEmbed() {
        $('embedSelector').value = '';
        populateEmbed('');
        $('embedName').focus();
        setStatus('');
    }

    function addButton() {
        if ($('embedButtonList').children.length >= 5) return setStatus('Discord allows up to 5 buttons.', 'error');
        addButtonRow({ label: '' });
    }

    function addSelectOptionControl() {
        if ($('selectOptionList').children.length >= 10) return setStatus('Discord allows up to 10 select menu options.', 'error');
        addSelectOption({});
    }

    function addReactionRoleControl() {
        if ($('reactionRoleList').children.length >= 20) return setStatus('You can configure up to 20 reaction roles.', 'error');
        addReactionRole({});
    }

    $('addEmbedButton').addEventListener('click', startNewEmbed);
    $('addEmbedButtonTop').addEventListener('click', startNewEmbed);
    $('addEmbedButtonInline').addEventListener('click', addButton);
    $('addSelectOption').addEventListener('click', addSelectOptionControl);
    $('addReactionRole').addEventListener('click', addReactionRoleControl);
    document.addEventListener('click', () => {
        document.querySelectorAll('.reaction-role-picker .role-menu.is-open').forEach((menu) => {
            menu.classList.remove('is-open');
            menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
        });
    });
    $('embedSelector').addEventListener('change', () => populateEmbed($('embedSelector').value));
    document.querySelectorAll('.embed-color-preset').forEach((preset) => {
        preset.addEventListener('click', () => setEmbedColor(preset.dataset.color));
    });
    $('embedColor').addEventListener('input', () => {
        updateColorControls();
        renderPreview();
    });
    $('embedForm').addEventListener('input', renderPreview);
    $('embedForm').addEventListener('submit', (event) => {
        event.preventDefault();
        saveEmbed(false).catch((error) => setStatus(error.message, 'error'));
    });
    $('saveAndSendEmbed').addEventListener('click', () => saveEmbed(true).catch((error) => setStatus(error.message, 'error')));
    $('sendEmbedOnly').addEventListener('click', () => {
        const name = $('embedName').value.trim();
        if (!name || !embeds[name]) return setStatus('Save this embed before sending it.', 'error');
        sendSavedEmbed(name).then(() => setStatus(`Sent “${name}” to the channel.`, 'success')).catch((error) => setStatus(error.message, 'error'));
    });
    $('deleteEmbed').addEventListener('click', async () => {
        const name = $('embedName').value.trim();
        if (!name || !embeds[name]) return setStatus('Choose a saved embed to delete.', 'error');
        if (!window.confirm(`Delete the “${name}” embed?`)) return;
        try {
            await api('/api/embeds/' + encodeURIComponent(name), { method: 'DELETE' });
            delete embeds[name];
            refreshEmbedSelector('');
            populateEmbed('');
            setStatus(`Deleted “${name}”.`, 'success');
        } catch (error) {
            setStatus(error.message, 'error');
        }
    });

    Promise.all([
        api('/api/embeds'),
        api('/api/roles').catch(() => [])
    ]).then(([data, roles]) => {
        embeds = data.embeds || {};
        discordRoles = Array.isArray(roles) ? roles.filter((role) => role && role.id && role.name) : [];
        refreshEmbedSelector('');
        populateEmbed('');
    }).catch((error) => setStatus(error.message, 'error'));
}());