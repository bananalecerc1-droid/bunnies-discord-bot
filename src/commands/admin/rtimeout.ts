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

interface RTimeoutCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.rtimeout as RTimeoutCommandSettings,
        PermissionFlagsBits.ModerateMembers
    );
};

export const data = new SlashCommandBuilder()
    .setName('rtimeout')
    .setDescription('Removes timeout from a member')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The member to remove timeout from')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for removing timeout')
            .setRequired(false)
    );

export const command: Command = {
    name: 'rtimeout',
    enabled: true,
    aliases: ['rtimeout', 'removetimeout', 'untimeout'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.rtimeout.noPermission, 
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
                    await (interaction as Message).reply(locale.commands.rtimeout.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }

            if (!targetMember) {
                const reply = { content: locale.commands.rtimeout.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!targetMember.communicationDisabledUntil) {
                const reply = { content: locale.commands.rtimeout.notTimedOut, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!guild?.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                const reply = { content: locale.commands.rtimeout.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.rtimeout.cantManageHigherRole, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.rtimeout.noReason}`;

            await targetMember.timeout(null, formattedReason);

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.rtimeout.title)
                .setDescription(locale.commands.rtimeout.description)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: `👤 ${locale.commands.rtimeout.target}`,
                        value: targetMember.toString(),
                        inline: true
                    },
                    {
                        name: `🔨 ${locale.commands.rtimeout.action}`,
                        value: locale.commands.rtimeout.timeoutRemovedBy.replace('{user}', executingMember.user.tag),
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.rtimeout.reason}`,
                        value: reason || locale.commands.rtimeout.noReason,
                        inline: false
                    }
                )
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({ 
                    text: locale.commands.rtimeout.requestedBy.replace(
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
            console.error('Error executing rtimeout command:', error);
            const errorMessage = { 
                content: locale.commands.rtimeout.commandError,
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
        rtimeout: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            userNoPermission: string;
            botNoPermission: string;
            commandError: string;
            userNotFound: string;
            notTimedOut: string;
            cantManageHigherRole: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            timeoutRemovedBy: string;
            target: string;
            action: string;
            invalidFormat: string;
        }
    }
}

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.rtimeout) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.rtimeout) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.rtimeout) {
        locale = {
            commands: {
                rtimeout: {
                    title: "Timeout Removed",
                    description: "A member's timeout has been removed",
                    success: "Successfully removed timeout",
                    error: "Failed to remove timeout",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to manage this user's timeout.",
                    botNoPermission: "I do not have permission to manage timeouts.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    notTimedOut: "This user is not timed out.",
                    cantManageHigherRole: "You cannot manage a user with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    timeoutRemovedBy: "Timeout removed by {user}",
                    target: "User",
                    action: "Action",
                    invalidFormat: "Invalid format. Use: !rtimeout @user [reason]"
                }
            }
        };
    }
    
    return locale;
}; 
