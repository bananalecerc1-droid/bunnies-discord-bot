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

interface UnbanCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        unban: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            commandError: string;
            userNotFound: string;
            notBanned: string;
            invalidId: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            unbannedBy: string;
            target: string;
            action: string;
            invalidFormat: string;
        }
    }
}

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.unban) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.unban) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.unban) {
        locale = {
            commands: {
                unban: {
                    title: "Member Unbanned",
                    description: "A member has been unbanned",
                    success: "Successfully unbanned user",
                    error: "Failed to unban user",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    notBanned: "This user is not banned.",
                    invalidId: "Invalid user ID provided.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    unbannedBy: "Unbanned by {user}",
                    target: "User",
                    action: "Action",
                    invalidFormat: "Invalid format. Use: !unban [user ID] [reason]"
                }
            }
        };
    }
    
    return locale;
};

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.unban as UnbanCommandSettings,
        PermissionFlagsBits.BanMembers
    );
};

export const data = new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans a user by ID')
    .addStringOption(option =>
        option
            .setName('userid')
            .setDescription('The ID of the user to unban')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for unbanning')
            .setRequired(false)
    );

export const command: Command = {
    name: 'unban',
    enabled: true,
    aliases: ['unban', 'removeban'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.unban.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            if (!guild?.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
                const reply = { content: locale.commands.unban.error, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            let userId: string;
            let reason: string | null = null;

            if (isSlash) {
                userId = interaction.options.getString('userid', true);
                reason = interaction.options.getString('reason');
            } else {
                if (args.length < 1) {
                    await (interaction as Message).reply(locale.commands.unban.invalidFormat);
                    return;
                }
                userId = args[0];
                reason = args.slice(1).join(' ') || null;
            }

            if (!/^\d{17,19}$/.test(userId)) {
                const reply = { content: locale.commands.unban.invalidId, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const bans = await guild.bans.fetch();
            const ban = bans.get(userId);

            if (!ban) {
                const reply = { content: locale.commands.unban.notBanned, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${isSlash ? interaction.user.tag : (interaction as Message).author.tag} | ${reason || locale.commands.unban.noReason}`;

            await guild.members.unban(userId, formattedReason);

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.unban.title)
                .setDescription(locale.commands.unban.description)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: `👤 ${locale.commands.unban.target}`,
                        value: `<@${userId}>`,
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.unban.reason}`,
                        value: reason || locale.commands.unban.noReason,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: locale.commands.unban.unbannedBy.replace(
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
            console.error('Error executing unban command:', error);
            const errorMessage = { 
                content: locale.commands.unban.commandError,
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
