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

interface BannerCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        banner: {
            title: string;
            description: string;
            serverBanner: string;
            userBanner: string;
            noBanner: string;
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
    .setName('banner')
    .setDescription('Shows user or server banner')
    .addUserOption(option =>
        option
            .setName('target')
            .setDescription('The user to get banner from (mention or ID)')
            .setRequired(false)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.banner as BannerCommandSettings
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.banner) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.banner) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.banner) {
        locale = {
            commands: {
                banner: {
                    title: "User Banner",
                    description: "Banner for {user}",
                    serverBanner: "Server Banner",
                    userBanner: "User Banner",
                    noBanner: "No banner set",
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
    name: 'banner',
    aliases: settings.commands?.banner?.aliases || [],
    enabled: settings.commands?.banner?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, _args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.banner.noPermission, 
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
                const reply = { content: locale.commands.banner.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.banner.title)
                .setDescription(locale.commands.banner.description.replace('{user}', member.user.tag))
                .setColor(member.displayHexColor || '#0099ff');

            if (guild?.bannerURL()) {
                const serverBannerURL = guild.bannerURL({ size: 4096 });
                embed.addFields({
                    name: locale.commands.banner.serverBanner,
                    value: serverBannerURL 
                        ? `[${locale.commands.banner.clickHere}](${serverBannerURL}) | [${locale.commands.banner.download}](${serverBannerURL}?size=4096)`
                        : locale.commands.banner.noBanner,
                    inline: false
                });
            }

            const user = await member.user.fetch(true);
            const userBannerURL = user.bannerURL({ size: 4096 });

            embed.addFields({
                name: locale.commands.banner.userBanner,
                value: userBannerURL 
                    ? `[${locale.commands.banner.clickHere}](${userBannerURL}) | [${locale.commands.banner.download}](${userBannerURL}?size=4096)`
                    : locale.commands.banner.noBanner,
                inline: false
            });

            if (userBannerURL) {
                embed.setImage(userBannerURL);
            } else if (guild?.bannerURL()) {
                embed.setImage(guild.bannerURL({ size: 4096 }) || null);
            }

            embed.setFooter({ 
                text: locale.commands.banner.requestedBy.replace(
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
            console.error('Error executing banner command:', error);
            const errorMessage = { 
                content: locale.commands.banner.commandError,
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
