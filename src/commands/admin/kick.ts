import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
    PermissionFlagsBits
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface KickCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        kick: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            userNoPermission: string;
            botNoPermission: string;
            commandError: string;
            userNotFound: string;
            cantKickSelf: string;
            cantKickOwner: string;
            cantKickHigher: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            kickedBy: string;
            target: string;
            kicked: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a member from the server')
    .addUserOption(option =>
        option
            .setName('target')
            .setDescription('The member to kick')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for kicking')
            .setRequired(false)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.kick as KickCommandSettings,
        PermissionFlagsBits.KickMembers
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.kick) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.kick) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.kick) {
        locale = {
            commands: {
                kick: {
                    title: "Member Kicked",
                    description: "A member has been kicked from the server",
                    success: "Successfully kicked {user}",
                    error: "Failed to kick {user}",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to kick this user.",
                    botNoPermission: "I do not have permission to kick this user.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    cantKickSelf: "You cannot kick yourself.",
                    cantKickOwner: "You cannot kick the server owner.",
                    cantKickHigher: "You cannot kick a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason: {reason}",
                    noReason: "No reason provided",
                    kickedBy: "Kicked by {user}",
                    target: "Target",
                    kicked: "Kicked"
                }
            }
        };
    }
    
    return locale;
};

export const command: Command = {
    name: 'kick',
    aliases: settings.commands?.kick?.aliases || [],
    enabled: settings.commands?.kick?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.kick.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            let targetMember: GuildMember | null | undefined;
            let reason: string | null = null;
            
            if (isSlash) {
                const targetUser = interaction.options.getUser('target');
                reason = interaction.options.getString('reason');
                targetMember = targetUser 
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            } else {
                if (args.length === 0) {
                    await (interaction as Message).reply(locale.commands.kick.userNotFound);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }

            if (!targetMember) {
                const reply = { content: locale.commands.kick.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.id === executingMember.id) {
                const reply = { content: locale.commands.kick.cantKickSelf, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.id === guild?.ownerId) {
                const reply = { content: locale.commands.kick.cantKickOwner, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.kick.cantKickHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!guild?.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) {
                const reply = { content: locale.commands.kick.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.kick.noReason}`;

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.kick.title)
                .setDescription(locale.commands.kick.description)
                .setColor(0xff0000)
                .addFields(
                    {
                        name: `👤 ${locale.commands.kick.target}`,
                        value: targetMember.user.tag,
                        inline: true
                    },
                    {
                        name: `🔨 ${locale.commands.kick.kicked}`,
                        value: locale.commands.kick.kickedBy.replace('{user}', executingMember.user.tag),
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.kick.reason}`,
                        value: reason || locale.commands.kick.noReason,
                        inline: false
                    }
                )
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({ 
                    text: locale.commands.kick.requestedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )
                })
                .setTimestamp();

            await targetMember.kick(formattedReason);

            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            } else {
                await (interaction as Message).reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error executing kick command:', error);
            const errorMessage = { 
                content: locale.commands.kick.commandError,
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
