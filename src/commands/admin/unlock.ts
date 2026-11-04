import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
    PermissionFlagsBits,
    TextChannel,
    ChannelType
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface UnlockCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        lock: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            botNoPermission: string;
            commandError: string;
            channelNotFound: string;
            invalidChannel: string;
            alreadyLocked: string;
            alreadyUnlocked: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            lockedBy: string;
            unlockedBy: string;
            channel: string;
            status: string;
            locked: string;
            unlocked: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlocks a channel')
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('The channel to unlock (current channel if not specified)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for unlocking')
            .setRequired(false)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.unlock as UnlockCommandSettings,
        PermissionFlagsBits.ManageChannels
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.lock) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.lock) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.lock) {
        locale = {
            commands: {
                lock: {
                    title: "Channel Status Changed",
                    description: "Channel access has been modified",
                    success: "Channel unlocked successfully",
                    error: "Failed to unlock channel",
                    noPermission: "You do not have permission to use this command.",
                    botNoPermission: "I do not have permission to manage this channel.",
                    commandError: "An error occurred while executing the command.",
                    channelNotFound: "Channel not found",
                    invalidChannel: "Invalid channel type. Must be a text channel.",
                    alreadyLocked: "This channel is already locked",
                    alreadyUnlocked: "This channel is already unlocked",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    lockedBy: "Locked by {user}",
                    unlockedBy: "Unlocked by {user}",
                    channel: "Channel",
                    status: "Status",
                    locked: "🔒 Locked",
                    unlocked: "🔓 Unlocked"
                }
            }
        };
    }
    
    return locale;
};

export const command: Command = {
    name: 'unlock',
    aliases: settings.commands?.unlock?.aliases || [],
    enabled: settings.commands?.unlock?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.lock.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            let targetChannel: TextChannel;
            let reason: string | null = null;
            
            if (isSlash) {
                const channel = interaction.options.getChannel('channel') || interaction.channel;
                reason = interaction.options.getString('reason');
                targetChannel = channel as TextChannel;
            } else {
                const channelMention = args[0]?.match(/^<#(\d+)>$/)?.[1];
                targetChannel = channelMention 
                    ? guild?.channels.cache.get(channelMention) as TextChannel 
                    : interaction.channel as TextChannel;
                reason = args.slice(channelMention ? 1 : 0).join(' ') || null;
            }

            if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
                const reply = { content: locale.commands.lock.invalidChannel, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const currentPerms = targetChannel.permissionOverwrites.cache.get(guild!.id);
            if (!currentPerms?.deny.has(PermissionFlagsBits.SendMessages)) {
                const reply = { content: locale.commands.lock.alreadyUnlocked, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.lock.noReason}`;
            
            await targetChannel.permissionOverwrites.edit(guild!.id, {
                SendMessages: null
            }, { reason: formattedReason });

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.lock.title)
                .setDescription(locale.commands.lock.description)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: `#️⃣ ${locale.commands.lock.channel}`,
                        value: targetChannel.toString(),
                        inline: true
                    },
                    {
                        name: `🔓 ${locale.commands.lock.status}`,
                        value: locale.commands.lock.unlocked,
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.lock.reason}`,
                        value: reason || locale.commands.lock.noReason,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: locale.commands.lock.requestedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )
                })
                .setTimestamp();

            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            } else {
                await (interaction as Message).reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error executing unlock command:', error);
            const errorMessage = { 
                content: locale.commands.lock.commandError,
                flags: 1 << 6
            };
            
            if (interaction instanceof ChatInputCommandInteraction) {
                if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                } else {
                    await interaction.followUp(errorMessage);
                }
            } else {
                await (interaction as Message).reply(errorMessage.content);
            }
        }
    }
}; 
