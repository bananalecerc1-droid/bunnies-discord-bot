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

interface HideCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        hide: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            botNoPermission: string;
            commandError: string;
            channelNotFound: string;
            invalidChannel: string;
            alreadyHidden: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            hiddenBy: string;
            channel: string;
            status: string;
            hidden: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('hide')
    .setDescription('Hides a channel')
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('The channel to hide (current channel if not specified)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for hiding')
            .setRequired(false)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.hide as HideCommandSettings,
        PermissionFlagsBits.ManageChannels
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.hide) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.hide) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.hide) {
        locale = {
            commands: {
                hide: {
                    title: "Channel Visibility Changed",
                    description: "Channel visibility has been modified",
                    success: "Channel hidden successfully",
                    error: "Failed to hide channel",
                    noPermission: "You do not have permission to use this command.",
                    botNoPermission: "I do not have permission to manage this channel.",
                    commandError: "An error occurred while executing the command.",
                    channelNotFound: "Channel not found",
                    invalidChannel: "Invalid channel type. Must be a text channel.",
                    alreadyHidden: "This channel is already hidden",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    hiddenBy: "Hidden by {user}",
                    channel: "Channel",
                    status: "Status",
                    hidden: "🔒 Hidden"
                }
            }
        };
    }
    
    return locale;
};

export const command: Command = {
    name: 'hide',
    aliases: settings.commands?.hide?.aliases || [],
    enabled: settings.commands?.hide?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.hide.noPermission, 
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
                const reply = { content: locale.commands.hide.invalidChannel, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const currentPerms = targetChannel.permissionOverwrites.cache.get(guild!.id);
            if (currentPerms?.deny.has(PermissionFlagsBits.ViewChannel)) {
                const reply = { content: locale.commands.hide.alreadyHidden, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.hide.noReason}`;
            
            await targetChannel.permissionOverwrites.edit(guild!.id, {
                ViewChannel: false
            }, { reason: formattedReason });

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.hide.title)
                .setDescription(locale.commands.hide.description)
                .setColor(0x2f3136)
                .addFields(
                    {
                        name: `#️⃣ ${locale.commands.hide.channel}`,
                        value: targetChannel.toString(),
                        inline: true
                    },
                    {
                        name: `👁️ ${locale.commands.hide.status}`,
                        value: locale.commands.hide.hidden,
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.hide.reason}`,
                        value: reason || locale.commands.hide.noReason,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: locale.commands.hide.requestedBy.replace(
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
            console.error('Error executing hide command:', error);
            const errorMessage = { 
                content: locale.commands.hide.commandError,
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
