import { Guild, GuildMember } from 'discord.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface TagRoleMapping {
    roleId: string;
}

export function getTagRoleMappings(client: any): TagRoleMapping[] {
    return Array.isArray(client.settings?.tagRoles?.mappings) ? client.settings.tagRoles.mappings : [];
}

export async function syncTagRoles(member: GuildMember, client: any): Promise<void> {
    const settings = client.settings?.tagRoles;
    if (!settings?.enabled || !member.guild) return;

    const primaryGuild = member.user.primaryGuild || (await member.user.fetch().catch(() => member.user)).primaryGuild;
    const displaysServerTag = primaryGuild?.identityEnabled === true &&
        primaryGuild.identityGuildId === member.guild.id;
    for (const mapping of getTagRoleMappings(client)) {
        const role = member.guild.roles.cache.get(mapping.roleId);
        if (!role || role.managed || !role.editable) continue;
        const has = member.roles.cache.has(role.id);
        if (displaysServerTag && !has) await member.roles.add(role, 'Server Tag role').catch(() => undefined);
        if (!displaysServerTag && has) await member.roles.remove(role, 'Server Tag removed').catch(() => undefined);
    }
}

export async function syncTagRolesForGuild(guild: Guild, client: any): Promise<void> {
    await guild.members.fetch().catch(error => {
        console.error('[server-tag-role] Failed to fetch members:', error);
        return null;
    });
    for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await syncTagRoles(member, client);
    }
}

export function saveTagRoleSettings(client: any, mappings: TagRoleMapping[], enabled = true): void {
    const settingsPath = join(process.cwd(), 'settings.json');
    const next = JSON.parse(JSON.stringify(client.settings));
    next.tagRoles = { enabled, mappings };
    writeFileSync(settingsPath, JSON.stringify(next, null, 4), 'utf8');
    client.settings = next;
}