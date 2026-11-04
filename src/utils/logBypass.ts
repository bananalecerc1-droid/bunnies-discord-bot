export function shouldBypassLogs(client: any, userId?: string): boolean {
    if (!userId) return false;
    const roleIds: string[] = client.settings?.assetImport?.logBypassRoleIds || [];
    if (!roleIds.length) return false;
    return client.guilds.cache.some((guild: any) => {
        const member = guild.members.cache.get(userId);
        return Boolean(member && roleIds.some(roleId => member.roles.cache.has(roleId)));
    });
}
