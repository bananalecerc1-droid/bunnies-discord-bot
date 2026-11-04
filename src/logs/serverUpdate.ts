import { shouldBypassLogs } from '../utils/logBypass';
import { Guild, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (oldGuild: Guild, newGuild: Guild) => {
    try {
        const client = oldGuild.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.serverUpdate?.enabled) return;

        const logChannelId = settings.logs.serverUpdate.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.serverUpdate;
        if (!locale) {
            console.error(`Failed to find server update locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await newGuild.fetchAuditLogs({
            type: AuditLogEvent.GuildUpdate,
            limit: 1,
        });

        const updateLog = auditLogs.entries.first();
        const executor = updateLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const changes: { name: string; oldValue: string; newValue: string }[] = [];

        if (oldGuild.name !== newGuild.name) {
            changes.push({
                name: locale.name,
                oldValue: oldGuild.name,
                newValue: newGuild.name
            });
        }

        if (oldGuild.icon !== newGuild.icon) {
            changes.push({
                name: locale.icon,
                oldValue: oldGuild.icon ? `[${locale.before}](${oldGuild.iconURL()})` : locale.none,
                newValue: newGuild.icon ? `[${locale.after}](${newGuild.iconURL()})` : locale.none
            });
        }

        if (oldGuild.banner !== newGuild.banner) {
            changes.push({
                name: locale.banner,
                oldValue: oldGuild.banner ? `[${locale.before}](${oldGuild.bannerURL()})` : locale.none,
                newValue: newGuild.banner ? `[${locale.after}](${newGuild.bannerURL()})` : locale.none
            });
        }

        if (oldGuild.description !== newGuild.description) {
            changes.push({
                name: locale.serverDescription,
                oldValue: oldGuild.description || locale.none,
                newValue: newGuild.description || locale.none
            });
        }

        if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
            changes.push({
                name: locale.verificationLevel,
                oldValue: oldGuild.verificationLevel.toString(),
                newValue: newGuild.verificationLevel.toString()
            });
        }

        if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
            changes.push({
                name: locale.explicitContentFilter,
                oldValue: oldGuild.explicitContentFilter.toString(),
                newValue: newGuild.explicitContentFilter.toString()
            });
        }

        if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) {
            changes.push({
                name: locale.defaultNotifications,
                oldValue: oldGuild.defaultMessageNotifications.toString(),
                newValue: newGuild.defaultMessageNotifications.toString()
            });
        }

        if (changes.length === 0) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.serverUpdate.color as `#${string}`)
            .setThumbnail(newGuild.iconURL({ size: 1024 }) || null);

        changes.forEach(change => {
            embed.addFields({
                name: change.name,
                value: `**${locale.before}:** ${change.oldValue}\n**${locale.after}:** ${change.newValue}`,
                inline: false
            });
        });

        embed.addFields({
            name: `👮 ${locale.updatedBy}`,
            value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
            inline: true
        })
        .setFooter({ text: `${locale.guildId}: ${newGuild.id}` })
        .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging server update:', error);
    }
}; 
