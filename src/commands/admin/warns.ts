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

interface WarnsCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        warns: {
            title: string;
            description: string;
            noWarnings: string;
            error: string;
            noPermission: string;
            commandError: string;
            userNotFound: string;
            requestedBy: string;
            target: string;
            totalWarnings: string;
            warning: string;
            moderator: string;
            reason: string;
            date: string;
            moreWarnings: string;
            invalidFormat: string;
        }
    }
}

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.warns) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.warns) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.warns) {
        locale = {
            commands: {
                warns: {
                    title: "Member Warnings",
                    description: "Warning history for member",
                    noWarnings: "This member has no warnings",
                    error: "Failed to fetch warnings",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    requestedBy: "Requested by {user}",
                    target: "User",
                    totalWarnings: "Total Warnings",
                    warning: "Warning",
                    moderator: "Moderator",
                    reason: "Reason",
                    date: "Date",
                    moreWarnings: "And {count} more warnings...",
                    invalidFormat: "Invalid format. Use: !warns @user"
                }
            }
        };
    }
    
    return locale;
};

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.warns as WarnsCommandSettings,
        PermissionFlagsBits.ModerateMembers
    );
};

export const data = new SlashCommandBuilder()
    .setName('warns')
    .setDescription('Shows warnings for a member')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The member to check warnings for')
            .setRequired(true)
    );

export const command: Command = {
    name: 'warns',
    enabled: true,
    aliases: ['warns', 'warnings', 'checkwarns'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.warns.noPermission, 
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

            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                targetMember = targetUser 
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            } else {
                if (args.length < 1) {
                    await (interaction as Message).reply(locale.commands.warns.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }

            if (!targetMember) {
                const reply = { content: locale.commands.warns.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const warnings = await Warning.find({
                guildId: guild?.id,
                userId: targetMember.id
            }).sort({ timestamp: -1 });

            if (warnings.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(locale.commands.warns.title)
                    .setDescription(locale.commands.warns.noWarnings)
                    .setColor(0x00ff00)
                    .addFields(
                        {
                            name: `👤 ${locale.commands.warns.target}`,
                            value: targetMember.toString(),
                            inline: true
                        }
                    )
                    .setThumbnail(targetMember.user.displayAvatarURL())
                    .setFooter({ 
                        text: locale.commands.warns.requestedBy.replace(
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
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.warns.title)
                .setDescription(locale.commands.warns.description)
                .setColor(0xffff00)
                .addFields(
                    {
                        name: `👤 ${locale.commands.warns.target}`,
                        value: targetMember.toString(),
                        inline: true
                    },
                    {
                        name: `🔢 ${locale.commands.warns.totalWarnings}`,
                        value: warnings.length.toString(),
                        inline: true
                    }
                )
                .setThumbnail(targetMember.user.displayAvatarURL());

            warnings.slice(0, 10).forEach((warning, index) => {
                const moderator = guild?.members.cache.get(warning.moderatorId);
                embed.addFields({
                    name: `${locale.commands.warns.warning} #${index + 1}`,
                    value: `${locale.commands.warns.moderator}: ${moderator ? moderator.toString() : 'Unknown'}\n${locale.commands.warns.reason}: ${warning.reason}\n${locale.commands.warns.date}: <t:${Math.floor(warning.timestamp.getTime() / 1000)}:F>`,
                    inline: false
                });
            });

            if (warnings.length > 10) {
                embed.setFooter({
                    text: locale.commands.warns.moreWarnings.replace('{count}', (warnings.length - 10).toString())
                });
            } else {
                embed.setFooter({ 
                    text: locale.commands.warns.requestedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )
                });
            }

            embed.setTimestamp();

            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            } else {
                await (interaction as Message).reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error executing warns command:', error);
            const errorMessage = { 
                content: locale.commands.warns.commandError,
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
