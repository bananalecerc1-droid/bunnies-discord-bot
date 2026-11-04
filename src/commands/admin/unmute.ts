import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
    PermissionFlagsBits,
    Role
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface UnmuteCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.unmute as UnmuteCommandSettings,
        PermissionFlagsBits.ManageRoles
    );
};

export const data = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmutes a member')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The member to unmute')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for unmuting')
            .setRequired(false)
    );

export const command: Command = {
    name: 'unmute',
    enabled: true,
    aliases: ['unmute', 'unsilence'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.unmute.noPermission, 
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
                const targetUser = interaction.options.getUser('user');
                reason = interaction.options.getString('reason');
                targetMember = targetUser 
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            } else {
                if (args.length < 1) {
                    await (interaction as Message).reply(locale.commands.unmute.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }

            if (!targetMember) {
                const reply = { content: locale.commands.unmute.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const muteRole = guild?.roles.cache.find((role: Role) => role.name === 'Muted');
            if (!muteRole) {
                const reply = { content: locale.commands.unmute.roleNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!targetMember.roles.cache.has(muteRole.id)) {
                const reply = { content: locale.commands.unmute.notMuted, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.unmute.cantUnmuteHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.unmute.noReason}`;

            await targetMember.roles.remove(muteRole, formattedReason);

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.unmute.title)
                .setDescription(locale.commands.unmute.description)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: `👤 ${locale.commands.unmute.target}`,
                        value: targetMember.toString(),
                        inline: true
                    },
                    {
                        name: `🔨 ${locale.commands.unmute.action}`,
                        value: locale.commands.unmute.unmutedBy.replace('{user}', executingMember.user.tag),
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.unmute.reason}`,
                        value: reason || locale.commands.unmute.noReason,
                        inline: false
                    }
                )
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({ 
                    text: locale.commands.unmute.requestedBy.replace(
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
            console.error('Error executing unmute command:', error);
            const errorMessage = { 
                content: locale.commands.unmute.commandError,
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

interface LocaleData {
    commands: {
        unmute: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            userNoPermission: string;
            botNoPermission: string;
            commandError: string;
            userNotFound: string;
            roleNotFound: string;
            notMuted: string;
            cantUnmuteHigher: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            unmutedBy: string;
            target: string;
            action: string;
            invalidFormat: string;
        }
    }
}

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.unmute) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.unmute) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.unmute) {
        locale = {
            commands: {
                unmute: {
                    title: "Member Unmuted",
                    description: "A member has been unmuted",
                    success: "Successfully unmuted member",
                    error: "Failed to unmute member",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to unmute this user.",
                    botNoPermission: "I do not have permission to unmute users.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    roleNotFound: "Muted role not found",
                    notMuted: "This user is not muted.",
                    cantUnmuteHigher: "You cannot unmute a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    unmutedBy: "Unmuted by {user}",
                    target: "User",
                    action: "Action",
                    invalidFormat: "Invalid format. Use: !unmute @user [reason]"
                }
            }
        };
    }
    
    return locale;
}; 
