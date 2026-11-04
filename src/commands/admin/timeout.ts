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

interface TimeoutCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        timeout: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            userNoPermission: string;
            botNoPermission: string;
            commandError: string;
            userNotFound: string;
            cantTimeoutSelf: string;
            cantTimeoutOwner: string;
            cantTimeoutHigher: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            timeoutBy: string;
            target: string;
            duration: string;
            timedOut: string;
            invalidDuration: string;
            maxDuration: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeouts a member')
    .addUserOption(option =>
        option
            .setName('target')
            .setDescription('The member to timeout')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('duration')
            .setDescription('Timeout duration (e.g., 1m, 1h, 1d)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for timeout')
            .setRequired(false)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.timeout as TimeoutCommandSettings,
        PermissionFlagsBits.ModerateMembers
    );
};

const parseDuration = (duration: string): number | null => {
    const match = duration.match(/^(\d+)([mhdw])$/i);
    if (!match) return null;

    const [, amount, unit] = match;
    const value = parseInt(amount);

    switch (unit.toLowerCase()) {
        case 'm': // minutes
            return value * 60 * 1000;
        case 'h': // hours
            return value * 60 * 60 * 1000;
        case 'd': // days
            return value * 24 * 60 * 60 * 1000;
        case 'w': // weeks
            const days = value * 7;
            if (days > 28) return null; // Discord max is 28 days
            return days * 24 * 60 * 60 * 1000;
        default:
            return null;
    }
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.timeout) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.timeout) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.timeout) {
        locale = {
            commands: {
                timeout: {
                    title: "Member Timed Out",
                    description: "A member has been timed out",
                    success: "Successfully timed out {user}",
                    error: "Failed to timeout {user}",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to timeout this user.",
                    botNoPermission: "I do not have permission to timeout this user.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    cantTimeoutSelf: "You cannot timeout yourself.",
                    cantTimeoutOwner: "You cannot timeout the server owner.",
                    cantTimeoutHigher: "You cannot timeout a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    timeoutBy: "Timed out by {user}",
                    target: "Target",
                    duration: "Duration",
                    timedOut: "Timed Out",
                    invalidDuration: "Invalid duration format. Use: 1m, 1h, or 1d",
                    maxDuration: "Duration cannot exceed 28 days"
                }
            }
        };
    }
    
    return locale;
};

export const command: Command = {
    name: 'timeout',
    aliases: settings.commands?.timeout?.aliases || [],
    enabled: settings.commands?.timeout?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.timeout.noPermission, 
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
            let durationStr: string | null;
            let reason: string | null = null;
            
            if (isSlash) {
                const targetUser = interaction.options.getUser('target');
                durationStr = interaction.options.getString('duration');
                if (!durationStr) {
                    const reply = { content: locale.commands.timeout.invalidDuration, flags: 1 << 6 };
                    await interaction.reply(reply);
                    return;
                }
                reason = interaction.options.getString('reason');
                targetMember = targetUser 
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            } else {
                if (args.length < 2) {
                    await (interaction as Message).reply(locale.commands.timeout.invalidDuration);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                durationStr = args[1];
                reason = args.slice(2).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }

            if (!targetMember) {
                const reply = { content: locale.commands.timeout.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const durationMs = parseDuration(durationStr);
            if (!durationMs) {
                const reply = { content: locale.commands.timeout.invalidDuration, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (durationMs > 28 * 24 * 60 * 60 * 1000) {
                const reply = { content: locale.commands.timeout.maxDuration, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.id === executingMember.id) {
                const reply = { content: locale.commands.timeout.cantTimeoutSelf, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.id === guild?.ownerId) {
                const reply = { content: locale.commands.timeout.cantTimeoutOwner, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.timeout.cantTimeoutHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.timeout.noReason}`;

            await targetMember.timeout(durationMs, formattedReason);

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.timeout.title)
                .setDescription(locale.commands.timeout.description)
                .setColor(0xff0000)
                .addFields(
                    {
                        name: `👤 ${locale.commands.timeout.target}`,
                        value: targetMember.user.tag,
                        inline: true
                    },
                    {
                        name: `⏱️ ${locale.commands.timeout.duration}`,
                        value: durationStr,
                        inline: true
                    },
                    {
                        name: `🔨 ${locale.commands.timeout.timedOut}`,
                        value: locale.commands.timeout.timeoutBy.replace('{user}', executingMember.user.tag),
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.timeout.reason}`,
                        value: reason || locale.commands.timeout.noReason,
                        inline: false
                    }
                )
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({ 
                    text: locale.commands.timeout.requestedBy.replace(
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
            console.error('Error executing timeout command:', error);
            const errorMessage = { 
                content: locale.commands.timeout.commandError,
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
