import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
    PermissionFlagsBits,
    ChannelType
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface RRoleCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.rrole as RRoleCommandSettings,
        PermissionFlagsBits.ManageRoles
    );
};

export const data = new SlashCommandBuilder()
    .setName('rrole')
    .setDescription('Removes a role from a user')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The user to remove role from')
            .setRequired(true)
    )
    .addRoleOption(option =>
        option
            .setName('role')
            .setDescription('The role to remove')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for removing the role')
            .setRequired(false)
    );

export const command: Command = {
    name: 'rrole',
    enabled: true,
    aliases: ['rrole', 'removerole', 'delrole', 'deleterole'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.rrole.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            let targetUser;
            let targetRole;

            if (isSlash) {
                targetUser = interaction.options.getUser('user');
                targetRole = interaction.options.getRole('role');
            } else {
                const message = interaction as Message;
                const userMention = args[0]?.match(/^<@!?(\d+)>$/) || args[0]?.match(/^\d+$/);
                const roleMention = args[1]?.match(/^<@&(\d+)>$/) || args[1]?.match(/^\d+$/);

                if (!userMention || !roleMention) {
                    await message.reply(locale.commands.rrole.invalidFormat);
                    return;
                }

                targetUser = await guild?.members.fetch(userMention[1]).catch(() => null);
                targetRole = guild?.roles.cache.get(roleMention[1]);
            }

            if (!targetUser || !targetRole) {
                const reply = { content: locale.commands.rrole.userOrRoleNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const targetMember = await guild?.members.fetch(targetUser.id);
            if (!targetMember) {
                const reply = { content: locale.commands.rrole.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!targetMember.roles.cache.has(targetRole.id)) {
                const reply = { content: locale.commands.rrole.doesNotHaveRole, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!guild?.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
                const reply = { content: locale.commands.rrole.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetRole.position >= guild?.members.me.roles.highest.position) {
                const reply = { content: locale.commands.rrole.roleTooHigh, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetRole.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.rrole.cantManageHigherRole, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const reason = isSlash 
                ? interaction.options.getString('reason') 
                : args.slice(2).join(' ');

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.rrole.noReason}`;

            await targetMember.roles.remove(targetRole.id, formattedReason);

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.rrole.title)
                .setDescription(locale.commands.rrole.description)
                .setColor(0xff0000)
                .addFields(
                    {
                        name: `👤 ${locale.commands.rrole.target}`,
                        value: targetMember.toString(),
                        inline: true
                    },
                    {
                        name: `🎭 ${locale.commands.rrole.role}`,
                        value: targetRole.toString(),
                        inline: true
                    },
                    {
                        name: `❓ ${locale.commands.rrole.reason}`,
                        value: reason || locale.commands.rrole.noReason,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: locale.commands.rrole.requestedBy.replace(
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
            console.error('Error executing rrole command:', error);
            const errorMessage = { 
                content: locale.commands.rrole.commandError,
                flags: 1 << 6
            };
            
            if (interaction instanceof ChatInputCommandInteraction) {
                if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                } else {
                    await interaction.followUp(errorMessage);
                }
            } else {
                const messageChannel = (interaction as Message).channel;
                if (messageChannel?.type === ChannelType.GuildText) {
                    await messageChannel.send(errorMessage.content);
                }
            }
        }
    }
};

interface LocaleData {
    commands: {
        rrole: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            userNoPermission: string;
            botNoPermission: string;
            commandError: string;
            userNotFound: string;
            userOrRoleNotFound: string;
            invalidFormat: string;
            roleTooHigh: string;
            cantManageHigherRole: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            target: string;
            role: string;
            doesNotHaveRole: string;
        }
    }
}

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.rrole) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.rrole) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.rrole) {
        locale = {
            commands: {
                rrole: {
                    title: "Role Removed",
                    description: "A role has been removed from a member",
                    success: "Successfully removed role",
                    error: "Failed to remove role",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to manage this user's roles.",
                    botNoPermission: "I do not have permission to manage roles.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    userOrRoleNotFound: "User or role not found",
                    invalidFormat: "Invalid format. Use: !rrole @user @role [reason]",
                    roleTooHigh: "That role is higher than my highest role.",
                    cantManageHigherRole: "You cannot manage a role higher than your highest role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    target: "User",
                    role: "Role",
                    doesNotHaveRole: "User does not have this role"
                }
            }
        };
    }
    
    return locale;
}; 
