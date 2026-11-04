import { isIgnorableDiscordStateError } from '../utils/discordErrors';
import { shouldBypassLogs } from '../utils/logBypass';
import { Role, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (oldRole: Role, newRole: Role) => {
    if (!oldRole.guild || !newRole.guild) return;

    const client = oldRole.client as ModBot;
    const settings = client.settings;

    if (!settings.logs?.enabled || !settings.logs.roleUpdate?.enabled) return;

    const logChannelId = settings.logs.roleUpdate.channelId;
    if (!logChannelId) return;

    const logChannel = client.channels.cache.get(logChannelId) as TextChannel;
    if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

    const locale = client.locales.get(client.defaultLanguage)?.logs?.roleUpdate;
    if (!locale) {
        console.error(`Failed to find role update locale data for ${client.defaultLanguage}`);
        return;
    }

    const changes: { name: string; oldValue: string; newValue: string }[] = [];

    const meaningfulChanges = [
        {
            check: () => oldRole.name !== newRole.name,
            name: locale.name,
            oldValue: oldRole.name,
            newValue: newRole.name
        },
        {
            check: () => oldRole.hexColor !== newRole.hexColor,
            name: locale.color,
            oldValue: oldRole.hexColor,
            newValue: newRole.hexColor
        },
        {
            check: () => oldRole.hoist !== newRole.hoist,
            name: locale.hoisted,
            oldValue: oldRole.hoist ? locale.yes : locale.no,
            newValue: newRole.hoist ? locale.yes : locale.no
        },
        {
            check: () => oldRole.mentionable !== newRole.mentionable,
            name: locale.mentionable,
            oldValue: oldRole.mentionable ? locale.yes : locale.no,
            newValue: newRole.mentionable ? locale.yes : locale.no
        }
    ];

    meaningfulChanges.forEach(change => {
        if (change.check()) {
            changes.push({
                name: change.name,
                oldValue: change.oldValue,
                newValue: change.newValue
            });
        }
    });

    const oldPerms = oldRole.permissions.toArray().join(', ');
    const newPerms = newRole.permissions.toArray().join(', ');
    if (oldPerms !== newPerms) {
        changes.push({
            name: locale.permissions,
            oldValue: oldPerms || 'None',
            newValue: newPerms || 'None'
        });
    }

    if (changes.length > 0 && oldRole.position !== newRole.position) {
        changes.push({
            name: locale.position,
            oldValue: oldRole.position.toString(),
            newValue: newRole.position.toString()
        });
    }

    if (changes.length === 0) return;

    try {
        const auditLogs = await newRole.guild.fetchAuditLogs({
            type: AuditLogEvent.RoleUpdate,
            limit: 1,
        });

        const updateLog = auditLogs.entries.first();
        const executor = updateLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.roleUpdate.color as `#${string}`)
            .addFields(
                {
                    name: `📝 ${locale.name}`,
                    value: newRole.name,
                    inline: true
                },
                {
                    name: `👤 ${locale.updatedBy}`,
                    value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
                    inline: true
                },
                {
                    name: `🆔 ${locale.roleId}`,
                    value: newRole.id,
                    inline: true
                },
                {
                    name: `📋 ${locale.changes}`,
                    value: changes.map(change => 
                        `**${change.name}**\n${locale.before}: \`${change.oldValue}\`\n${locale.after}: \`${change.newValue}\``
                    ).join('\n\n'),
                    inline: false
                }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        if (isIgnorableDiscordStateError(error)) return;
        console.error('Error logging role update:', error);
    }
}; 
