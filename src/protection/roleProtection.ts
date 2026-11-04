import { canManageMember, manageableRoles } from '../utils/memberSafety';
import { Role, GuildMember, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ModBot } from '../types/ModBot';
import { getClient } from '../db/turso';

type ProtectedRoleSnapshot = {
    guildId: string;
    roleId: string;
    name: string;
    color: number;
    hoist: boolean;
    mentionable: boolean;
    permissions: string[];
    position: number;
    iconUrl: string | null;
    memberIds: string[];
};
const protectedRoleSnapshots = new Map<string, ProtectedRoleSnapshot>();

const saveProtectedRoleMembership = async (guildId: string, roleId: string, roleName: string, userId: string, present: boolean): Promise<void> => {
    try {
        const db = getClient();
        if (present) {
            await db.execute({ sql: `INSERT OR REPLACE INTO protected_role_members (guildId, roleId, roleName, userId, updatedAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(guildId, roleId, userId) DO UPDATE SET roleName = excluded.roleName, updatedAt = excluded.updatedAt`, args: [guildId, roleId, roleName, userId, new Date().toISOString()] });
        } else {
        }
    } catch (error) { console.error(`[role-protection] Failed updating protected membership ${guildId}/${roleId}/${userId}:`, error); }
};

const getProtectedRoleMemberIds = async (guildId: string, roleId: string, roleName: string): Promise<string[]> => {
    try {
        const result = await getClient().execute({ sql: 'SELECT userId FROM protected_role_members WHERE guildId = ? AND (roleId = ? OR roleName = ?)', args: [guildId, roleId, roleName] });
        return result.rows.map(row => String(row.userId));
    } catch (error) { console.error(`[role-protection] Failed reading protected membership ${guildId}/${roleId}:`, error); return []; }
};

const syncProtectedRoleMemberships = async (guildId: string, roleId: string, roleName: string, memberIds: Iterable<string>): Promise<void> => {
    try {
        const db = getClient();
        const now = new Date().toISOString();
        for (const userId of memberIds) await db.execute({ sql: 'INSERT OR REPLACE INTO protected_role_members (guildId, roleId, roleName, userId, updatedAt) VALUES (?, ?, ?, ?, ?)', args: [guildId, roleId, roleName, userId, now] });
    } catch (error) { console.error(`[role-protection] Failed syncing protected membership ${guildId}/${roleId}:`, error); }
};

const protectedRoleRemoveTracker = new Map<string, { day: string; count: number }>();

const actionTracker = new Map<string, {
    creates: number;
    deletes: number;
    updates: number;
    adds: number;
    removes: number;
    lastReset: number;
}>();

const resetCounters = (userId: string, settings: any) => {
    const now = Date.now();
    const userData = actionTracker.get(userId);
    if (userData && now - userData.lastReset >= settings.protection.role.limits.timeWindow) {
        actionTracker.set(userId, {
            creates: 0,
            deletes: 0,
            updates: 0,
            adds: 0,
            removes: 0,
            lastReset: now
        });
    }
};

const protectedRemovalLimit = (settings: any): number =>
    Math.max(1, Number(settings.protection?.role?.action?.protectedRoleRemoveLimit || 4));
const protectedRemovalKey = (guildId: string, userId: string, roleId: string): string =>
    `${guildId}:${userId}:${roleId}`;
const recordProtectedRemoval = (guildId: string, userId: string, roleId: string): number => {
    const key = protectedRemovalKey(guildId, userId, roleId);
    const day = new Date().toISOString().slice(0, 10);
    const current = protectedRoleRemoveTracker.get(key);
    const next = !current || current.day !== day ? { day, count: 1 } : { day, count: current.count + 1 };
    protectedRoleRemoveTracker.set(key, next);
    return next.count;
};

const takeAction = async (member: GuildMember, reason: string) => {
    const client = member.client as ModBot;
    const settings = client.settings;
    const { action } = settings.protection.role;

    try {
        if (!canManageMember(member)) {
            console.warn(`[protection] Skipping action for unmanaged member ${member.id}`);
            return;
        }
        switch (action.type) {
            case 'removeRoles':
                const roles = manageableRoles(member, action.ignoredRoles);
                if (roles.size > 0) await member.roles.remove(roles, reason);
                break;
            case 'kick':
                await member.kick(reason);
                break;
            case 'ban':
                await member.ban({ 
                    reason,
                    deleteMessageSeconds: action.duration || undefined 
                });
                break;
        }
    } catch (error: any) {
        if (error?.code === 50013 || error?.status === 403) {
            console.warn(`[protection] Discord refused action for member ${member.id} (insufficient permissions or role hierarchy).`);
            return;
        }
        console.error('Error taking protection action:', error);
    }
};

const protectedRoleIds = (settings: any): string[] =>
    settings.protection?.role?.action?.protectedRoles || [];

const isProtectedRole = (role: Role, settings: any): boolean =>
    protectedRoleIds(settings).includes(role.id);

// Cache membership while the role still exists. Discord's roleDelete payload
// can no longer provide reliable members after the role has been removed.
const protectedRoleMemberSnapshots = new Map<string, Set<string>>();
const protectedRoleMemberSnapshotFile = join(process.cwd(), 'protected-role-members.json');
let protectedRoleMemberSnapshotsLoaded = false;

const loadProtectedRoleMemberSnapshots = (): void => {
    if (protectedRoleMemberSnapshotsLoaded) return;
    protectedRoleMemberSnapshotsLoaded = true;
    try {
        if (!existsSync(protectedRoleMemberSnapshotFile)) return;
        const saved = JSON.parse(readFileSync(protectedRoleMemberSnapshotFile, 'utf8')) as Record<string, string[]>;
        for (const [key, memberIds] of Object.entries(saved)) {
            if (Array.isArray(memberIds)) protectedRoleMemberSnapshots.set(key, new Set(memberIds));
        }
    } catch (error) {
        console.error('[role-protection] Failed to load persistent member snapshots:', error);
    }
};

const persistProtectedRoleMemberSnapshots = (): void => {
    try {
        const saved: Record<string, string[]> = {};
        for (const [key, memberIds] of protectedRoleMemberSnapshots) saved[key] = [...memberIds];
        writeFileSync(protectedRoleMemberSnapshotFile, JSON.stringify(saved, null, 2), 'utf8');
    } catch (error) {
        console.error('[role-protection] Failed to persist member snapshots:', error);
    }
};


export const ensureProtectedRolesFromDatabase = async (client: ModBot): Promise<void> => {
    // Do not run the protected-role watchdog when role protection is disabled.
    if (!client.settings.protection?.enabled || client.settings.protection.role?.enabled === false) return;
    for (const guild of client.guilds.cache.values()) {
        try {
            const result = await getClient().execute({
                sql: 'SELECT roleName, userId FROM protected_role_members WHERE guildId = ? AND roleName IS NOT NULL AND roleName != ? ORDER BY roleName',
                args: [guild.id, '']
            });
            const grouped = new Map<string, string[]>();
            for (const row of result.rows) {
                const name = String(row.roleName);
                const users = grouped.get(name) || [];
                users.push(String(row.userId));
                grouped.set(name, users);
            }
            for (const [roleName, userIds] of grouped) {
                let role = guild.roles.cache.find(candidate => candidate.name === roleName);
                if (!role) {
                    const me = guild.members.me;
                    if (!me?.permissions.has('ManageRoles')) continue;
                    const maxPosition = Math.max(1, me.roles.highest.position - 1);
                    role = await guild.roles.create({ name: roleName, reason: 'Watchdog restoring protected role' });
                    await role.setPosition(Math.min(maxPosition, guild.roles.highest.position - 1)).catch(() => {});
                    client.settings.protection.role.action.protectedRoles = [
                        ...new Set([...protectedRoleIds(client.settings), role.id])
                    ];
                    writeFileSync(join(process.cwd(), 'settings.json'), JSON.stringify(client.settings, null, 4), 'utf8');
                    console.warn(`[role-protection] Watchdog recreated missing protected role ${roleName} as ${role.id}`);
                }
                if (!role.editable) {
                    console.error(`[role-protection] Cannot manage protected role ${roleName}: bot role is not above it`);
                    continue;
                }
                await getClient().execute({ sql: 'DELETE FROM protected_role_members WHERE guildId = ? AND roleName = ? AND roleId != ?', args: [guild.id, roleName, role.id] });
                await getClient().execute({ sql: 'UPDATE protected_role_members SET roleId = ? WHERE guildId = ? AND roleName = ?', args: [role.id, guild.id, roleName] });
                for (const userId of [...new Set(userIds)]) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member && !member.roles.cache.has(role.id)) {
                        await member.roles.add(role, 'Watchdog restoring protected role membership').catch(error =>
                            console.error(`[role-protection] Watchdog failed adding ${userId} to ${roleName}:`, error)
                        );
                    }
                }
                await getClient().execute({
                    sql: 'UPDATE protected_role_members SET roleId = ? WHERE guildId = ? AND roleName = ?',
                    args: [role.id, guild.id, roleName]
                });
            }
        } catch (error) {
            console.error(`[role-protection] Watchdog failed for guild ${guild.id}:`, error);
        }
    }
};

export const refreshProtectedRoleMemberSnapshots = async (client: ModBot): Promise<void> => {
    loadProtectedRoleMemberSnapshots();
    for (const guild of client.guilds.cache.values()) {
        const protectedIds = protectedRoleIds(client.settings);
        if (protectedIds.length === 0) continue;
        const members = await guild.members.fetch().catch(() => null);
        if (!members) continue;
        for (const roleId of protectedIds) {
            const role = guild.roles.cache.get(roleId);
            if (!role) continue;
            const key = `${guild.id}:${roleId}`;
            const memberIds = [...members.filter(member => member.roles.cache.has(roleId)).keys()];
            const snapshot = new Set(memberIds);
            protectedRoleMemberSnapshots.set(key, snapshot);
            // Reconcile the database with the actual Discord membership on startup.
            // This also captures members added while the bot was offline.
            await syncProtectedRoleMemberships(guild.id, roleId, role.name, memberIds);
        }
        persistProtectedRoleMemberSnapshots();
    }
};


export const trackProtectedRoleMemberChanges = (oldMember: GuildMember, newMember: GuildMember): void => {
    loadProtectedRoleMemberSnapshots();
    const settings = (newMember.client as ModBot).settings;
    const changedRoleIds = new Set<string>();
    for (const roleId of oldMember.roles.cache.keys()) changedRoleIds.add(roleId);
    for (const roleId of newMember.roles.cache.keys()) changedRoleIds.add(roleId);
    for (const roleId of changedRoleIds) {
        if (!protectedRoleIds(settings).includes(roleId)) continue;
        const key = `${newMember.guild.id}:${roleId}`;
        const snapshot = protectedRoleMemberSnapshots.get(key) || new Set<string>();
        if (newMember.roles.cache.has(roleId)) snapshot.add(newMember.id);
        else snapshot.delete(newMember.id);
        protectedRoleMemberSnapshots.set(key, snapshot);
        void saveProtectedRoleMembership(newMember.guild.id, roleId, newMember.guild.roles.cache.get(roleId)?.name || '', newMember.id, newMember.roles.cache.has(roleId));
    }
    persistProtectedRoleMemberSnapshots();
};

const isOwnerOrBot = (member: GuildMember, client: ModBot): boolean =>
    member.id === member.guild.ownerId || member.id === client.user?.id;

const restorableRole = (role: Role): boolean => {
    const me = role.guild.members.me;
    return Boolean(me?.permissions.has('ManageRoles') && me.roles.highest.position > role.position);
};

const enforceProtectedRole = async (member: GuildMember, client: ModBot, reason: string): Promise<void> => {
    if (isOwnerOrBot(member, client)) return;
    const action = client.settings.protection.role.action;
    try {
        if (action.type === 'removeRoles') {
            // Protected-role violations bypass the normal ignored-role exemptions.
            const removableRoles = member.roles.cache.filter(role => role.id !== member.guild.id && role.editable);
            if (removableRoles.size > 0) await member.roles.remove(removableRoles, reason);
        } else {
            await takeAction(member, reason);
        }
    } catch (error) {
        console.error('Error enforcing protected role action:', error);
    }
};

const sendProtectionLog = async (
    client: ModBot,
    member: GuildMember,
    actionType: string,
    roleName: string,
    limitType: string,
    limit: number
) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId) return;
        
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.protection.role;
        if (!locale) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor((settings.protection.role.color || settings.protection.role.action.color || '#ff0000') as `#${string}`)
            .addFields([
                {
                    name: `👤 ${locale.member}`,
                    value: `${member.user.tag} (<@${member.id}>)`,
                    inline: true
                },
                {
                    name: `📝 ${locale.roleName}`,
                    value: roleName,
                    inline: true
                },
                {
                    name: `⚡ ${locale.actionType}`,
                    value: locale.types[actionType as keyof typeof locale.types],
                    inline: true
                },
                {
                    name: `🛡️ ${locale.action}`,
                    value: locale.actions[settings.protection.role.action.type as keyof typeof locale.actions],
                    inline: true
                },
                {
                    name: `⏰ ${locale.timeWindow}`,
                    value: `${settings.protection.role.limits.timeWindow / 1000} ${locale.seconds}`,
                    inline: true
                },
                {
                    name: `📊 ${locale.limit}`,
                    value: `${locale[limitType]}: ${limit}`,
                    inline: true
                }
            ])
            .setFooter({ text: `${locale.memberId}: ${member.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending protection log:', error);
    }
};

export const handleRoleCreate = async (role: Role) => {
    const client = role.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.role.enabled === false) return;

    try {
        const auditLogs = await role.guild.fetchAuditLogs({
            type: AuditLogEvent.RoleCreate,
            limit: 1
        });

        const log = auditLogs.entries.first();
        if (!log || !log.executor) return;

        const member = await role.guild.members.fetch(log.executor.id);
        const hasProtectedMembership = (await getProtectedRoleMemberIds(role.guild.id, role.id, role.name)).length > 0;
        if ((isProtectedRole(role, settings) || hasProtectedMembership) && !isOwnerOrBot(member, client)) {
            try {
                const restored = await role.guild.roles.create({
                    name: role.name,
                    color: role.color,
                    hoist: role.hoist,
                    mentionable: role.mentionable,
                    permissions: role.permissions,
                    reason: 'Restoring protected role'
                });
                await restored.setPosition(role.position).catch(() => {});
                settings.protection.role.action.protectedRoles = protectedRoleIds(settings)
                    .map(id => id === role.id ? restored.id : id);
                writeFileSync(join(process.cwd(), 'settings.json'), JSON.stringify(client.settings, null, 4), 'utf8');
                await enforceProtectedRole(member, client, 'Attempted to delete a protected role');
                console.warn(`[role-protection] Restored protected role ${role.name} as ${restored.id}`);
            } catch (error) {
                console.error('Error restoring protected role:', error);
            }
            return;
        }

        if (member.roles.cache.some(r => settings.protection.role.action.ignoredRoles.includes(r.id))) return;

        if (!log?.executor) return;
        resetCounters(log.executor.id, settings);

        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }

        userData.creates++;

        if (userData.creates >= settings.protection.role.limits.createLimit) {
            await takeAction(
                member,
                settings.protection.role.action.reason
            );

            await sendProtectionLog(
                client,
                member,
                'create',
                role.name,
                'createLimit',
                settings.protection.role.limits.createLimit
            );
        }
    } catch (error) {
        console.error('Error in role create protection:', error);
    }
};

export const handleRoleDelete = async (role: Role) => {
    console.log(`[role-protection] GuildRoleDelete received: ${role.guild.id}/${role.id} name=${role.name}`);
    const client = role.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.role.enabled === false) return;

    try {
        const protectedMemberIds = await getProtectedRoleMemberIds(role.guild.id, role.id, role.name);
        const protectedByDatabase = protectedMemberIds.length > 0;
        console.log(`[role-protection] Delete decision ${role.name}: configured=${isProtectedRole(role, settings)} databaseMembers=${protectedMemberIds.length}`);
        let log: any = null;
        try {
            const auditLogs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 5 });
            log = auditLogs.entries.find(entry => entry.target?.id === role.id && entry.createdTimestamp > Date.now() - 15000) || null;
        } catch (auditError) {
            console.warn(`[role-protection] Audit log unavailable for deleted role ${role.id}; continuing restore`);
        }
        const member = log?.executor ? await role.guild.members.fetch(log.executor.id).catch(() => role.guild.members.me!) : role.guild.members.me!;

        if ((isProtectedRole(role, settings) || protectedByDatabase) && (!log || !isOwnerOrBot(member, client))) {
            try {
                const snapshot: ProtectedRoleSnapshot = {
                    guildId: role.guild.id,
                    roleId: role.id,
                    name: role.name,
                    color: role.color,
                    hoist: role.hoist,
                    mentionable: role.mentionable,
                    permissions: role.permissions.toArray(),
                    position: role.position,
                    iconUrl: role.iconURL(),
                    memberIds: [...new Set([
                        ...(await getProtectedRoleMemberIds(role.guild.id, role.id, role.name)),
                        ...(protectedRoleMemberSnapshots.get(`${role.guild.id}:${role.id}`) || new Set<string>()),
                        ...role.members.keys(),
                        ...(protectedRoleMemberSnapshots.get(`${role.guild.id}:${role.id}`) || new Set<string>()),
                        ...role.guild.members.cache.filter(guildMember => guildMember.roles.cache.has(role.id)).keys()
                    ])]
                };
                protectedRoleSnapshots.set(`${role.guild.id}:${role.id}`, snapshot);
                if (member.roles.cache.some(r => settings.protection.role.action.ignoredRoles.includes(r.id))) {
                    console.warn(`[role-protection] Ignored-role bypass overridden for protected-role deletion by ${member.user.tag}`);
                }
                let icon: Buffer | undefined;
                if (!restorableRole(role)) {
                    console.warn(`[role-protection] Cannot restore deleted role ${role.name}: bot role is not high enough or Manage Roles is missing`);
                    await enforceProtectedRole(member, client, 'Attempted to delete a protected role');
                    return;
                }
                if (snapshot.iconUrl) {
                    try { const response = await fetch(snapshot.iconUrl); if (response.ok) icon = Buffer.from(await response.arrayBuffer()); } catch { /* icon is best-effort */ }
                }
                const restored = await role.guild.roles.create({
                    name: snapshot.name,
                    color: snapshot.color as any,
                    hoist: snapshot.hoist,
                    mentionable: snapshot.mentionable,
                    permissions: snapshot.permissions as any,
                    ...(icon ? { icon } : {}),
                    reason: 'Restoring protected role'
                });
                await restored.setPosition(snapshot.position).catch(() => {});
                settings.protection.role.action.protectedRoles = protectedRoleIds(settings).map(id => id === role.id ? restored.id : id);
                protectedRoleMemberSnapshots.delete(`${role.guild.id}:${role.id}`);
                protectedRoleMemberSnapshots.set(`${role.guild.id}:${restored.id}`, new Set(snapshot.memberIds));
                await syncProtectedRoleMemberships(role.guild.id, restored.id, snapshot.name, snapshot.memberIds);
                await getClient().execute({ sql: 'UPDATE protected_role_members SET roleId = ?, roleName = ? WHERE guildId = ? AND (roleId = ? OR roleName = ?)', args: [restored.id, snapshot.name, role.guild.id, role.id, snapshot.name] });
                persistProtectedRoleMemberSnapshots();
                writeFileSync(join(process.cwd(), 'settings.json'), JSON.stringify(client.settings, null, 4), 'utf8');
                for (const memberId of snapshot.memberIds) {
                    const roleMember = await role.guild.members.fetch(memberId).catch(() => null);
                    if (roleMember && !roleMember.roles.cache.has(restored.id)) {
                        await roleMember.roles.add(restored, 'Restoring protected role membership')
                            .then(() => console.log(`[role-protection] Restored role ${restored.name} for member ${memberId}`))
                            .catch(error => console.error(`[role-protection] Failed restoring role ${restored.name} for member ${memberId}:`, error));
                    }
                }
                await enforceProtectedRole(member, client, 'Attempted to delete a protected role');
                console.warn(`[role-protection] Restored protected role ${role.name} as ${restored.id} and recovered ${snapshot.memberIds.length} members`);
            } catch (error) { console.error('Error restoring protected role:', error); }
            return;
        }

        resetCounters(log.executor.id, settings);

        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }

        userData.deletes++;

        if (userData.deletes >= settings.protection.role.limits.deleteLimit) {
            await takeAction(
                member,
                settings.protection.role.action.reason
            );

            await sendProtectionLog(
                client,
                member,
                'delete',
                role.name,
                'deleteLimit',
                settings.protection.role.limits.deleteLimit
            );
        }
    } catch (error) {
        console.error('Error in role delete protection:', error);
    }
};

export const handleRoleUpdate = async (oldRole: Role, newRole: Role) => {
    const client = oldRole.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.role.enabled === false) return;

    try {
        const hasNameChange = oldRole.name !== newRole.name;
        const hasColorChange = oldRole.color !== newRole.color;
        const hasPermissionChange = oldRole.permissions.bitfield !== newRole.permissions.bitfield;
        const hasPositionChange = oldRole.position !== newRole.position;
        const hasHoistChange = oldRole.hoist !== newRole.hoist;
        const hasMentionableChange = oldRole.mentionable !== newRole.mentionable;

        if (!hasNameChange && !hasColorChange && !hasPermissionChange && 
            !hasPositionChange && !hasHoistChange && !hasMentionableChange) {
            return;
        }

        const auditLogs = await newRole.guild.fetchAuditLogs({
            type: AuditLogEvent.RoleUpdate,
            limit: 1
        });

        const log = auditLogs.entries.first();
        if (!log || !log.executor) return;

        const member = await newRole.guild.members.fetch(log.executor.id);
        if (isProtectedRole(oldRole, settings) && !isOwnerOrBot(member, client)) {
            try {
                await newRole.edit({
                    name: oldRole.name,
                    color: oldRole.color,
                    hoist: oldRole.hoist,
                    mentionable: oldRole.mentionable,
                    permissions: oldRole.permissions,
                    reason: 'Reverting unauthorized protected-role change'
                });
                await newRole.setPosition(oldRole.position).catch(() => {});
                await enforceProtectedRole(member, client, 'Attempted to modify a protected role');
            } catch (error) {
                console.error('Error reverting protected role:', error);
            }
            return;
        }

        if (member.roles.cache.some(r => settings.protection.role.action.ignoredRoles.includes(r.id))) return;

        resetCounters(log.executor.id, settings);

        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }

        userData.updates++;

        if (userData.updates >= settings.protection.role.limits.updateLimit) {
            await takeAction(
                member,
                settings.protection.role.action.reason
            );

            await sendProtectionLog(
                client,
                member,
                'update',
                newRole.name,
                'updateLimit',
                settings.protection.role.limits.updateLimit
            );
        }
    } catch (error) {
        console.error('Error in role update protection:', error);
    }
};

export const handleRoleAdd = async (member: GuildMember, role: Role) => {
    const client = member.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.role.enabled === false) return;

    try {
        const auditLogs = await member.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberRoleUpdate,
            limit: 1
        });

        const log = auditLogs.entries.first();
        if (!log || !log.executor) return;

        const executor = await member.guild.members.fetch(log.executor.id);
        if (executor.roles.cache.some(r => 
            settings.protection.role.action.ignoredRoles.includes(r.id)
        )) return;

        // Adding a protected role is allowed; only removals are daily-limited.
        if (isProtectedRole(role, settings)) return;
        resetCounters(log.executor.id, settings);

        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }

        userData.adds++;

        if (userData.adds >= settings.protection.role.limits.addLimit) {
            await takeAction(
                executor,
                settings.protection.role.action.reason
            );

            await sendProtectionLog(
                client,
                executor,
                'add',
                role.name,
                'addLimit',
                settings.protection.role.limits.addLimit
            );
        }
    } catch (error) {
        console.error('Error in role add protection:', error);
    }
};

export const handleRoleRemove = async (member: GuildMember, role: Role) => {
    const client = member.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.role.enabled === false) return;

    try {
        const auditLogs = await member.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberRoleUpdate,
            limit: 1
        });

        const log = auditLogs.entries.first();
        if (!log || !log.executor) return;

        const executor = await member.guild.members.fetch(log.executor.id);
        if (executor.roles.cache.some(r => 
            settings.protection.role.action.ignoredRoles.includes(r.id)
        )) return;

        if (isProtectedRole(role, settings)) {
            const count = recordProtectedRemoval(member.guild.id, executor.id, role.id);
            const limit = protectedRemovalLimit(settings);
            if (count > limit) {
                await enforceProtectedRole(executor, client, `Exceeded protected role removal limit (${limit}/day)`);
                await sendProtectionLog(client, executor, 'remove', role.name, 'protectedRoleRemoveLimit', limit);
            }
            return;
        }
        resetCounters(log.executor.id, settings);

        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }

        userData.removes++;

        if (userData.removes >= settings.protection.role.limits.removeLimit) {
            await takeAction(
                executor,
                settings.protection.role.action.reason
            );

            await sendProtectionLog(
                client,
                executor,
                'remove',
                role.name,
                'removeLimit',
                settings.protection.role.limits.removeLimit
            );
        }
    } catch (error) {
        console.error('Error in role remove protection:', error);
    }
};
