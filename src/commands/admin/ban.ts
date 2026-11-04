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

interface BanCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        ban: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            userNoPermission: string;
            botNoPermission: string;
            commandError: string;
            userNotFound: string;
            cantBanSelf: string;
            cantBanOwner: string;
            cantBanHigher: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            bannedBy: string;
            target: string;
            banned: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a user from the server (works even if they are not currently a member)')
    .addUserOption(option =>
        option
            .setName('target')
            .setDescription('The user to ban (does not need to be in the server)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for banning')
            .setRequired(false)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.ban as BanCommandSettings,
        PermissionFlagsBits.BanMembers
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.ban) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.ban) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.ban) {
        locale = {
            commands: {
                ban: {
                    title: "Member Banned",
                    description: "A member has been banned from the server",
                    success: "Successfully banned {user}",
                    error: "Failed to ban {user}",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to ban this user.",
                    botNoPermission: "I do not have permission to ban this user.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    cantBanSelf: "You cannot ban yourself.",
                    cantBanOwner: "You cannot ban the server owner.",
                    cantBanHigher: "You cannot ban a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    bannedBy: "Banned by {user}",
                    target: "Target",
                    banned: "Banned"
                }
            }
        };
    }
    
    return locale;
};

export const command: Command = {
    name: 'ban',
    aliases: settings.commands?.ban?.aliases || [],
    enabled: settings.commands?.ban?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.ban.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            let targetUser: import('discord.js').User | null = null;
            let targetMember: GuildMember | null | undefined;
            let reason: string | null = null;

            if (isSlash) {
                targetUser = interaction.options.getUser('target');
                reason = interaction.options.getString('reason');
            } else {
                if (args.length === 0) {
                    await (interaction as Message).reply(locale.commands.ban.userNotFound);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetUser = await client.users.fetch(targetId).catch(() => null);
            }

            if (!targetUser) {
                const reply = { content: locale.commands.ban.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            // The target does not need to be in the server to be banned — Discord bans
            // by user ID. We still try to fetch the member so we can run the usual
            // hierarchy/self/owner safety checks when they ARE in the server.
            targetMember = await guild?.members.fetch(targetUser.id).catch(() => null);

            if (targetUser.id === executingMember.id) {
                const reply = { content: locale.commands.ban.cantBanSelf, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetUser.id === guild?.ownerId) {
                const reply = { content: locale.commands.ban.cantBanOwner, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            // Hierarchy only matters if the target is actually in the server —
            // someone outside the server has no roles to compare.
            if (targetMember && targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.ban.cantBanHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!guild?.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
                const reply = { content: locale.commands.ban.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const alreadyBanned = await guild?.bans.fetch(targetUser.id).catch(() => null);
            if (alreadyBanned) {
                const reply = { content: `${targetUser.tag} is already banned.`, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.ban.noReason}`;

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.ban.title)
                .setDescription(locale.commands.ban.description)
                .setColor(0xff0000)
                .addFields(
                    {
                        name: `👤 ${locale.commands.ban.target}`,
                        value: `${targetUser.tag}${!targetMember ? ' *(not in server)*' : ''}`,
                        inline: true
                    },
                    {
                        name: `🔨 ${locale.commands.ban.banned}`,
                        value: locale.commands.ban.bannedBy.replace('{user}', executingMember.user.tag),
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.ban.reason}`,
                        value: reason || locale.commands.ban.noReason,
                        inline: false
                    }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ 
                    text: locale.commands.ban.requestedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )
                })
                .setTimestamp();

            await guild?.bans.create(targetUser.id, { reason: formattedReason });

            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            } else {
                await (interaction as Message).reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error executing ban command:', error);
            const errorMessage = { 
                content: locale.commands.ban.commandError,
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
