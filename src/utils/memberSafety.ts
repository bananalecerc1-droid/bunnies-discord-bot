import { GuildMember } from 'discord.js';

export function canManageMember(member: GuildMember): boolean {
    const me = member.guild.members.me;
    if (!me || member.id === member.guild.ownerId) return false;
    return member.manageable;
}

export function manageableRoles(member: GuildMember, ignoredRoleIds: string[]) {
    return member.roles.cache.filter(role =>
        !role.managed && role.editable && !ignoredRoleIds.includes(role.id)
    );
}
