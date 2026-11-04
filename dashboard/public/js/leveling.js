document.addEventListener('DOMContentLoaded', async () => {
    const settings = window.settings?.leveling || {};
    const leaderboard = window.leaderboard || [];

    await loadChannels();
    await loadRoles();
    renderRewards(settings.roleRewards || []);
    renderLeaderboard(leaderboard);

    document.getElementById('save-leveling-btn').addEventListener('click', saveSettings);
    document.getElementById('add-reward-btn').addEventListener('click', addReward);

    if (settings.levelUpMessage?.channelId) {
        document.getElementById('levelup-channel').value = settings.levelUpMessage.channelId;
    }
});

let currentRewards = [];

async function loadChannels() {
    try {
        const res = await fetch('/api/channels');
        const channels = await res.json();
        const select = document.getElementById('levelup-channel');
        (Array.isArray(channels) ? channels : []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `#${c.name}`;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Failed to load channels', error);
    }
}

let availableRoles = [];

async function loadRoles() {
    try {
        const res = await fetch('/api/roles');
        availableRoles = await res.json();
        const select = document.getElementById('new-reward-role');
        (Array.isArray(availableRoles) ? availableRoles : []).forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name;
            opt.dataset.roleColor = String(r.color ?? 0);
            select.appendChild(opt);
            const ignoredSelect = document.getElementById('ignored-roles');
            if (ignoredSelect) {
                const ignoredOpt = opt.cloneNode(true);
                ignoredOpt.selected = (window.ignoredRoleIds || []).includes(r.id);
                ignoredSelect.appendChild(ignoredOpt);
            }
        });
    } catch (error) {
        console.error('Failed to load roles', error);
    }
}

function roleName(roleId) {
    const role = availableRoles.find(r => r.id === roleId);
    return role ? role.name : roleId;
}

function renderRewards(rewards) {
    currentRewards = [...rewards];
    const container = document.getElementById('role-rewards-list');
    container.innerHTML = '';
    if (currentRewards.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-sm">${window.dashboardText?.noRewards || 'No role rewards yet.'}</p>`;
        return;
    }
    currentRewards
        .sort((a, b) => a.level - b.level)
        .forEach((reward, index) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-gray-700 rounded px-3 py-2';
            row.innerHTML = `
                <span class="text-gray-200">Level ${reward.level} → <strong>${roleName(reward.roleId)}</strong></span>
                <button data-index="${index}" class="remove-reward text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button>
            `;
            container.appendChild(row);
        });

    container.querySelectorAll('.remove-reward').forEach(btn => {
        btn.addEventListener('click', () => {
            currentRewards.splice(Number(btn.dataset.index), 1);
            renderRewards(currentRewards);
        });
    });
}

function addReward() {
    const level = Number(document.getElementById('new-reward-level').value);
    const roleId = document.getElementById('new-reward-role').value;
    if (!level || !roleId) {
        alert(window.dashboardText?.enterReward || 'Enter a level and choose a role.');
        return;
    }
    currentRewards.push({ level, roleId });
    renderRewards(currentRewards);
    document.getElementById('new-reward-level').value = '';
}

function renderLeaderboard(entries) {
    const container = document.getElementById('leaderboard-list');
    container.innerHTML = '';
    if (!entries.length) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No one has earned XP yet.</p>';
        return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    entries.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-gray-800 rounded px-4 py-2';
        row.innerHTML = `
            <span class="text-gray-200">${medals[index] || `#${index + 1}`} ${entry.username}</span>
            <span class="text-gray-400">Level ${entry.level} · ${entry.xp} XP</span>
        `;
        container.appendChild(row);
    });
}

async function saveSettings() {
    const payload = {
        enabled: document.getElementById('leveling-enabled').checked,
        xpPerMessage: {
            min: Number(document.getElementById('xp-min').value) || 15,
            max: Number(document.getElementById('xp-max').value) || 25
        },
        messageCooldown: (Number(document.getElementById('xp-cooldown').value) || 60) * 1000,
        xpPerVoiceMinute: Number(document.getElementById('xp-voice').value) || 0,
        levelUpMessage: {
            enabled: document.getElementById('levelup-enabled').checked,
            channelId: document.getElementById('levelup-channel').value,
            content: document.getElementById('levelup-content').value
        },
        roleRewards: Array.isArray(currentRewards) ? currentRewards : (Array.isArray(settings.roleRewards) ? settings.roleRewards : []),
        ignoredRoles: Array.from(document.getElementById('ignored-roles').selectedOptions).map(option => option.value),
        removeLowerRewards: document.getElementById('remove-lower-rewards').checked
    };

    try {
        const res = await fetch('/api/leveling/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
        alert(window.dashboardText?.saved || 'Leveling settings saved.');
    } catch (error) {
        alert((window.dashboardText?.saveError || 'Error saving settings: ') + error.message);
    }
}
