import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface AvatarCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        avatar: {
            title: string;
            description: string;
            serverAvatar: string;
            globalAvatar: string;
            noPermission: string;
            commandError: string;
            userNotFound: string;
            requestedBy: string;
            clickHere: string;
            download: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Shows user avatar')
    .addUserOption(option =>
        option
            .setName('target')
            .setDescription('The user to get avatar from (mention or ID)')
            .setRequired(false)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.avatar as AvatarCommandSettings
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.avatar) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.avatar) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.avatar) {
        locale = {
            commands: {
                avatar: {
                    title: "User Avatar",
                    description: "Avatar for {user}",
                    serverAvatar: "Server Avatar",
                    globalAvatar: "Global Avatar",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    requestedBy: "Requested by {user}",
                    clickHere: "Click here",
                    download: "Download"
                }
            }
        };
    }
    
    return locale;
};

export const command: Command = {
    name: 'avatar',
    aliases: settings.commands?.avatar?.aliases || [],
    enabled: settings.commands?.avatar?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, _args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.avatar.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            let member: GuildMember | null | undefined;
            
            if (isSlash) {
                const targetUser = (interaction as ChatInputCommandInteraction).options.getUser('target');
                member = targetUser 
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : (interaction.member as GuildMember);
            } else {
                const message = interaction as Message;
                member = message.mentions.members?.first() || 
                        (message as any).targetMember ||
                        message.member;
            }

            if (!member) {
                const reply = { content: locale.commands.avatar.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const globalAvatarURL = member.user.displayAvatarURL({ size: 4096 });
            const serverAvatarURL = member.avatarURL({ size: 4096 });

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.avatar.title)
                .setDescription(locale.commands.avatar.description.replace('{user}', member.user.tag))
                .setColor(member.displayHexColor || '#0099ff');

            if (serverAvatarURL && serverAvatarURL !== globalAvatarURL) {
                embed.addFields({
                    name: locale.commands.avatar.serverAvatar,
                    value: `[${locale.commands.avatar.clickHere}](${serverAvatarURL}) | [${locale.commands.avatar.download}](${serverAvatarURL}?size=4096)`,
                    inline: false
                })
                .setImage(serverAvatarURL);
            }

            embed.addFields({
                name: locale.commands.avatar.globalAvatar,
                value: `[${locale.commands.avatar.clickHere}](${globalAvatarURL}) | [${locale.commands.avatar.download}](${globalAvatarURL}?size=4096)`,
                inline: false
            });

            if (!serverAvatarURL || serverAvatarURL === globalAvatarURL) {
                embed.setImage(globalAvatarURL);
            }

            embed.setFooter({ 
                text: locale.commands.avatar.requestedBy.replace(
                    '{user}', 
                    isSlash ? interaction.user.tag : (interaction as Message).author.tag
                )
            })
            .setTimestamp();

            if (isSlash) {
                await (interaction as ChatInputCommandInteraction).reply({ embeds: [embed] });
            } else {
                await (interaction as Message).reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error executing avatar command:', error);
            const errorMessage = { 
                content: locale.commands.avatar.commandError,
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
