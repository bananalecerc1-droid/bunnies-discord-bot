import { GuildMember, PermissionFlagsBits } from 'discord.js';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface CommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

export const checkCommandPermissions = (
    member: GuildMember, 
    commandSettings: CommandSettings | undefined,
    requiredPermission?: bigint
): boolean => {
    try {
        if (!commandSettings?.permissions) {
            return requiredPermission ? member.permissions.has(requiredPermission) : true;
        }

        const { enabledRoleIds, disabledRoleIds } = commandSettings.permissions;
        const userRoleIds = Array.from(member.roles.cache.keys());

        if (disabledRoleIds && disabledRoleIds.length > 0) {
            const hasDisabledRole = userRoleIds.some(roleId => 
                disabledRoleIds.includes(roleId)
            );
            if (hasDisabledRole) {
                return false;
            }
        }

        if (requiredPermission && !member.permissions.has(requiredPermission)) {
            return false;
        }

        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return true;
        }

        if (enabledRoleIds && enabledRoleIds.length > 0) {
            return userRoleIds.some(roleId => enabledRoleIds.includes(roleId));
        }

        return true;
    } catch (error) {
        console.error('Error checking permissions:', error);
        return false;
    }
}; 
