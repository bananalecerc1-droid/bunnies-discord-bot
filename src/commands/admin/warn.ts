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
import { Warning } from '../../models/Warning';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface WarnCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.warn as WarnCommandSettings,
        PermissionFlagsBits.ModerateMembers
    );
};

export const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The member to warn')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for the warning')
            .setRequired(false)
    );

export const command: Command = {
    name: 'warn',
    enabled: true,
    aliases: ['warn', 'addwarn'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.warn.noPermission, 
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
                    await (interaction as Message).reply(locale.commands.warn.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }

            if (!targetMember) {
                const reply = { content: locale.commands.warn.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.id === executingMember.id) {
                const reply = { content: locale.commands.warn.cantWarnSelf, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.id === guild?.ownerId) {
                const reply = { content: locale.commands.warn.cantWarnOwner, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.roles.highest.position >= executingMember.roles.highest.position && 
                !executingMember.permissions.has(PermissionFlagsBits.Administrator)) {
                const reply = { content: locale.commands.warn.cantWarnHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const warning = new Warning({
                guildId: guild?.id,
                userId: targetMember.id,
                moderatorId: executingMember.id,
                reason: reason || locale.commands.warn.noReason,
                timestamp: new Date()
            });

            await warning.save();

            const warningCount = await Warning.countDocuments({
                guildId: guild?.id,
                userId: targetMember.id
            });

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.warn.title)
                .setDescription(locale.commands.warn.description)
                .setColor(0xffff00)
                .addFields(
                    {
                        name: `👤 ${locale.commands.warn.target}`,
                        value: targetMember.toString(),
                        inline: true
                    },
                    {
                        name: `🔢 ${locale.commands.warn.totalWarnings}`,
                        value: warningCount.toString(),
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.warn.reason}`,
                        value: reason || locale.commands.warn.noReason,
                        inline: false
                    }
                )
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({ 
                    text: locale.commands.warn.warnedBy.replace(
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
            console.error('Error executing warn command:', error);
            const errorMessage = { 
                content: locale.commands.warn.commandError,
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
        warn: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            commandError: string;
            userNotFound: string;
            cantWarnSelf: string;
            cantWarnOwner: string;
            cantWarnHigher: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            warnedBy: string;
            target: string;
            totalWarnings: string;
            invalidFormat: string;
        }
    }
}

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.warn) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.warn) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.warn) {
        locale = {
            commands: {
                warn: {
                    title: "Member Warned",
                    description: "A member has been warned",
                    success: "Successfully warned member",
                    error: "Failed to warn member",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    cantWarnSelf: "You cannot warn yourself.",
                    cantWarnOwner: "You cannot warn the server owner.",
                    cantWarnHigher: "You cannot warn a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    warnedBy: "Warned by {user}",
                    target: "User",
                    totalWarnings: "Total Warnings",
                    invalidFormat: "Invalid format. Use: !warn @user [reason]"
                }
            }
        };
    }
    
    return locale;
}; 
