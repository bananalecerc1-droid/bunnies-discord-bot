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

interface SetNickCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        setnick: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            userNoPermission: string;
            botNoPermission: string;
            commandError: string;
            userNotFound: string;
            cantNickSelf: string;
            cantNickOwner: string;
            cantNickHigher: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            nicknameBy: string;
            target: string;
            oldNickname: string;
            newNickname: string;
            nicknameTooLong: string;
            invalidNickname: string;
            reset: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('setnick')
    .setDescription('Changes a member\'s nickname')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The user to change nickname')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('nickname')
            .setDescription('The new nickname (leave empty to reset)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for changing nickname')
            .setRequired(false)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.setnick as SetNickCommandSettings,
        PermissionFlagsBits.ManageNicknames
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.setnick) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.setnick) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.setnick) {
        locale = {
            commands: {
                setnick: {
                    title: "Nickname Changed",
                    description: "A member's nickname has been changed",
                    success: "Successfully changed {user}'s nickname",
                    error: "Failed to change {user}'s nickname",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to change this user's nickname.",
                    botNoPermission: "I do not have permission to change nicknames.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    cantNickSelf: "You cannot change your own nickname with this command.",
                    cantNickOwner: "You cannot change the server owner's nickname.",
                    cantNickHigher: "You cannot change nickname of a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    nicknameBy: "Nickname changed by {user}",
                    target: "Target",
                    oldNickname: "Old Nickname",
                    newNickname: "New Nickname",
                    nicknameTooLong: "Nickname cannot exceed 32 characters.",
                    invalidNickname: "Invalid nickname provided.",
                    reset: "Reset to username"
                }
            }
        };
    }
    
    return locale;
};

export const command: Command = {
    name: 'setnick',
    aliases: settings.commands?.setnick?.aliases || [],
    enabled: settings.commands?.setnick?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.setnick.noPermission, 
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
            let newNickname: string | null = null;
            let reason: string | null = null;

            if (isSlash) {
                targetUser = interaction.options.getUser('user');
                newNickname = interaction.options.getString('nickname');
                reason = interaction.options.getString('reason');
            } else {
                const userMention = args[0]?.match(/^<@!?(\d+)>$/)?.[1];
                if (!userMention) {
                    const reply = { content: locale.commands.setnick.userNotFound, flags: 1 << 6 };
                    await (interaction as Message).reply(reply.content);
                    return;
                }
                targetUser = await client.users.fetch(userMention).catch(() => null);
                newNickname = args.slice(1).join(' ') || null;
            }

            if (!targetUser) {
                const reply = { content: locale.commands.setnick.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const targetMember = await guild?.members.fetch(targetUser.id);
            if (!targetMember) {
                const reply = { content: locale.commands.setnick.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetUser.id === executingMember.id) {
                const reply = { content: locale.commands.setnick.cantNickSelf, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetUser.id === guild?.ownerId) {
                const reply = { content: locale.commands.setnick.cantNickOwner, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.roles.highest.position >= executingMember.roles.highest.position) {
                const reply = { content: locale.commands.setnick.cantNickHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (newNickname && newNickname.length > 32) {
                const reply = { content: locale.commands.setnick.nicknameTooLong, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const oldNickname = targetMember.nickname || targetMember.user.username;
            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.setnick.noReason}`;

            await targetMember.setNickname(newNickname, formattedReason);

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.setnick.title)
                .setDescription(locale.commands.setnick.description)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: `👤 ${locale.commands.setnick.target}`,
                        value: targetMember.toString(),
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.setnick.oldNickname}`,
                        value: oldNickname,
                        inline: true
                    },
                    {
                        name: `✏️ ${locale.commands.setnick.newNickname}`,
                        value: newNickname || locale.commands.setnick.reset,
                        inline: true
                    },
                    {
                        name: `❓ ${locale.commands.setnick.reason}`,
                        value: reason || locale.commands.setnick.noReason,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: locale.commands.setnick.requestedBy.replace(
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
            console.error('Error executing setnick command:', error);
            const errorMessage = { 
                content: locale.commands.setnick.commandError,
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
