let menus = [];
let channels = [];
let roles = [];
let currentOptions = [];
let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    menus = window.settings?.selectRoles?.menus || [];
    channels = window.channels || [];
    roles = window.roles || [];

    populateSelect('menu-channel', channels, c => c.id, c => `#${c.name}`);
    populateSelect('new-option-role', roles, r => r.id, r => r.name);

    renderMenus();

    document.getElementById('new-menu-btn').addEventListener('click', () => openEditor(null));
    document.getElementById('cancel-editor-btn').addEventListener('click', closeEditor);
    document.getElementById('add-option-btn').addEventListener('click', addOption);
    document.getElementById('save-menu-btn').addEventListener('click', saveMenu);
});

function populateSelect(id, items, valueFn, labelFn) {
    const select = document.getElementById(id);
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = valueFn(item);
        opt.textContent = labelFn(item);
        select.appendChild(opt);
    });
}

function channelName(id) {
    const c = channels.find(c => c.id === id);
    return c ? `#${c.name}` : id;
}

function roleName(id) {
    const r = roles.find(r => r.id === id);
    return r ? r.name : id;
}

function renderMenus() {
    const container = document.getElementById('menus-list');
    container.innerHTML = '';
    if (!menus.length) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No role menus yet. Click "New Menu" to create one.</p>';
        return;
    }
    menus.forEach(menu => {
        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-lg p-4 flex items-center justify-between';
        card.innerHTML = `
            <div>
                <h3 class="text-white font-medium">${menu.title || 'Untitled menu'}</h3>
                <p class="text-gray-400 text-sm">${channelName(menu.channelId)} · ${menu.type} · ${(menu.options || []).length} option(s)${menu.messageId ? ' · posted' : ''}</p>
            </div>
            <div class="flex gap-2">
                <button data-id="${menu.id}" class="post-menu btn-primary px-3 py-1 text-sm">Post</button>
                <button data-id="${menu.id}" class="edit-menu px-3 py-1 text-sm rounded bg-gray-700 text-white">Edit</button>
                <button data-id="${menu.id}" class="delete-menu px-3 py-1 text-sm rounded bg-red-600 text-white">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.edit-menu').forEach(btn =>
        btn.addEventListener('click', () => openEditor(menus.find(m => m.id === btn.dataset.id)))
    );
    container.querySelectorAll('.delete-menu').forEach(btn =>
        btn.addEventListener('click', () => deleteMenu(btn.dataset.id))
    );
    container.querySelectorAll('.post-menu').forEach(btn =>
        btn.addEventListener('click', () => postMenu(btn.dataset.id))
    );
}

function openEditor(menu) {
    editingId = menu?.id || null;
    document.getElementById('editor-title').textContent = menu ? 'Edit Role Menu' : 'New Role Menu';
    document.getElementById('menu-id').value = menu?.id || '';
    document.getElementById('menu-title').value = menu?.title || '';
    document.getElementById('menu-description').value = menu?.description || '';
    document.getElementById('menu-color').value = menu?.color || '#777bc9';
    document.getElementById('menu-channel').value = menu?.channelId || '';
    document.getElementById('menu-type').value = menu?.type || 'select';
    document.getElementById('menu-multiple').checked = !!menu?.multiple;
    currentOptions = menu ? [...(menu.options || [])] : [];
    renderOptions();
    document.getElementById('menu-editor').classList.remove('hidden');
    document.getElementById('menu-editor').scrollIntoView({ behavior: 'smooth' });
}

function closeEditor() {
    document.getElementById('menu-editor').classList.add('hidden');
    editingId = null;
}

function renderOptions() {
    const container = document.getElementById('options-list');
    container.innerHTML = '';
    if (!currentOptions.length) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No options yet.</p>';
        return;
    }
    currentOptions.forEach((option, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-gray-700 rounded px-3 py-2';
        row.innerHTML = `
            <span class="text-gray-200">${option.emoji ? option.emoji + ' ' : ''}${option.label} → <strong>${roleName(option.roleId)}</strong></span>
            <button data-index="${index}" class="remove-option text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button>
        `;
        container.appendChild(row);
    });
    container.querySelectorAll('.remove-option').forEach(btn =>
        btn.addEventListener('click', () => {
            currentOptions.splice(Number(btn.dataset.index), 1);
            renderOptions();
        })
    );
}

function addOption() {
    const label = document.getElementById('new-option-label').value.trim();
    const roleId = document.getElementById('new-option-role').value;
    const emoji = document.getElementById('new-option-emoji').value.trim();
    if (!label || !roleId) {
        alert('Enter a label and choose a role.');
        return;
    }
    currentOptions.push({ label, roleId, emoji: emoji || undefined });
    renderOptions();
    document.getElementById('new-option-label').value = '';
    document.getElementById('new-option-emoji').value = '';
}

async function saveMenu() {
    const menu = {
        id: editingId || undefined,
        title: document.getElementById('menu-title').value,
        description: document.getElementById('menu-description').value,
        color: document.getElementById('menu-color').value,
        channelId: document.getElementById('menu-channel').value,
        type: document.getElementById('menu-type').value,
        multiple: document.getElementById('menu-multiple').checked,
        options: currentOptions
    };

    if (!menu.channelId) {
        alert('Choose a channel to post this menu in.');
        return;
    }
    if (!currentOptions.length) {
        alert('Add at least one role option.');
        return;
    }

    try {
        const res = await fetch('/api/selectroles/menus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(menu)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');

        if (editingId) {
            const index = menus.findIndex(m => m.id === editingId);
            menus[index] = data.menu;
        } else {
            menus.push(data.menu);
        }
        renderMenus();
        closeEditor();
    } catch (error) {
        alert('Error saving menu: ' + error.message);
    }
}

async function deleteMenu(id) {
    if (!confirm('Delete this role menu?')) return;
    try {
        const res = await fetch(`/api/selectroles/menus/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        menus = menus.filter(m => m.id !== id);
        renderMenus();
    } catch (error) {
        alert('Error deleting menu: ' + error.message);
    }
}

async function postMenu(id) {
    try {
        const res = await fetch(`/api/selectroles/menus/${id}/post`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to post');
        const menu = menus.find(m => m.id === id);
        if (menu) menu.messageId = data.messageId;
        renderMenus();
        alert('Menu posted to the channel!');
    } catch (error) {
        alert('Error posting menu: ' + error.message);
    }
}
