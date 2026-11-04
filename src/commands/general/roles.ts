import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
    Role,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface RolesCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        roles: {
            title: string;
            description: string;
            total: string;
            managed: string;
            hoisted: string;
            mentionable: string;
            integrated: string;
            normal: string;
            noRoles: string;
            noPermission: string;
            commandError: string;
            requestedBy: string;
            roleCount: string;
            memberCount: string;
            page: string;
            notYourMessage: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Shows server roles information');

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.roles as RolesCommandSettings
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.roles) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.roles) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.roles) {
        locale = {
            commands: {
                roles: {
                    title: "Server Roles",
                    description: "List of all roles in the server",
                    total: "Total Roles",
                    managed: "Managed Roles",
                    hoisted: "Hoisted Roles",
                    mentionable: "Mentionable Roles",
                    integrated: "Integrated Roles",
                    normal: "Normal Roles",
                    noRoles: "No roles found",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    requestedBy: "Requested by {user}",
                    roleCount: "Role Count",
                    memberCount: "Members",
                    page: "Page {current}",
                    notYourMessage: "This message is not from you."
                }
            }
        };
    }
    
    return locale;
};

const ROLES_PER_PAGE = 15; // Number of roles to show per page

const formatRoleList = (roles: Role[], page: number = 1): { content: string, totalPages: number } => {
    if (roles.length === 0) return { content: '-', totalPages: 1 };

    const totalPages = Math.ceil(roles.length / ROLES_PER_PAGE);
    const startIndex = (page - 1) * ROLES_PER_PAGE;
    const endIndex = Math.min(startIndex + ROLES_PER_PAGE, roles.length);
    
    const pageRoles = roles.slice(startIndex, endIndex);
    const content = pageRoles.map(role => `<@&${role.id}> (${role.members.size})`).join('\n');

    return { content, totalPages };
};

export const command: Command = {
    name: 'roles',
    aliases: settings.commands?.roles?.aliases || [],
    enabled: settings.commands?.roles?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, _args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.roles.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            if (!guild) return;

            const roles = Array.from(guild.roles.cache.values())
                .sort((a, b) => b.position - a.position)
                .filter(role => role.id !== guild.id);

            const managedRoles = roles.filter(role => role.managed);
            const hoistedRoles = roles.filter(role => role.hoist && !role.managed);
            const mentionableRoles = roles.filter(role => role.mentionable && !role.managed && !role.hoist);
            const normalRoles = roles.filter(role => !role.managed && !role.hoist && !role.mentionable);

            let currentPage = 1;
            const createEmbed = (page: number) => {
                const embed = new EmbedBuilder()
                    .setTitle(locale.commands.roles.title)
                    .setDescription(locale.commands.roles.description)
                    .setColor('#0099ff')
                    .addFields(
                        {
                            name: `📊 ${locale.commands.roles.roleCount}`,
                            value: roles.length.toString(),
                            inline: true
                        },
                        {
                            name: `👥 ${locale.commands.roles.memberCount}`,
                            value: guild.memberCount.toString(),
                            inline: true
                        }
                    );

                if (managedRoles.length > 0) {
                    const { content: managedContent, totalPages: managedPages } = formatRoleList(managedRoles, page);
                    embed.addFields({
                        name: `🤖 ${locale.commands.roles.managed} (${managedRoles.length}) ${managedPages > 1 ? `- Page ${page}/${managedPages}` : ''}`,
                        value: managedContent,
                        inline: false
                    });
                }

                if (hoistedRoles.length > 0) {
                    const { content: hoistedContent, totalPages: hoistedPages } = formatRoleList(hoistedRoles, page);
                    embed.addFields({
                        name: `📌 ${locale.commands.roles.hoisted} (${hoistedRoles.length}) ${hoistedPages > 1 ? `- Page ${page}/${hoistedPages}` : ''}`,
                        value: hoistedContent,
                        inline: false
                    });
                }

                if (mentionableRoles.length > 0) {
                    const { content: mentionableContent, totalPages: mentionablePages } = formatRoleList(mentionableRoles, page);
                    embed.addFields({
                        name: `💬 ${locale.commands.roles.mentionable} (${mentionableRoles.length}) ${mentionablePages > 1 ? `- Page ${page}/${mentionablePages}` : ''}`,
                        value: mentionableContent,
                        inline: false
                    });
                }

                if (normalRoles.length > 0) {
                    const { content: normalContent, totalPages: normalPages } = formatRoleList(normalRoles, page);
                    embed.addFields({
                        name: `📝 ${locale.commands.roles.normal} (${normalRoles.length}) ${normalPages > 1 ? `- Page ${page}/${normalPages}` : ''}`,
                        value: normalContent,
                        inline: false
                    });
                }

                embed.setFooter({ 
                    text: `${locale.commands.roles.requestedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )} • ${locale.commands.roles.page.replace('{current}', page.toString())}`
                })
                .setTimestamp();

                return embed;
            };

            const maxPages = Math.max(
                Math.ceil(managedRoles.length / ROLES_PER_PAGE),
                Math.ceil(hoistedRoles.length / ROLES_PER_PAGE),
                Math.ceil(mentionableRoles.length / ROLES_PER_PAGE),
                Math.ceil(normalRoles.length / ROLES_PER_PAGE)
            );

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prevroles')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('nextroles')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(maxPages <= 1)
                );

            let initialMessage: Message;
            
            if (isSlash) {
                initialMessage = await (interaction as ChatInputCommandInteraction).reply({ 
                    embeds: [createEmbed(currentPage)], 
                    components: maxPages > 1 ? [row] : [],
                    fetchReply: true 
                }) as Message;
            } else {
                initialMessage = await (interaction as Message).reply({ 
                    embeds: [createEmbed(currentPage)], 
                    components: maxPages > 1 ? [row] : []
                }) as Message;
            }

            if (maxPages <= 1) return;

            const collector = initialMessage.createMessageComponentCollector({ 
                filter: i => {
                    const isAuthor = i.user.id === (isSlash ? interaction.user.id : (interaction as Message).author.id);
                    if (!isAuthor) {
                        i.reply({ 
                            content: locale.commands.roles.notYourMessage, 
                            ephemeral: true 
                        });
                        return false;
                    }
                    return true;
                },
                time: 60000 
            });

            collector.on('collect', async i => {
                if (i.customId === 'prevroles') {
                    currentPage--;
                } else if (i.customId === 'nextroles') {
                    currentPage++;
                }

                row.components[0].setDisabled(currentPage === 1);
                row.components[1].setDisabled(currentPage === maxPages);

                await i.update({ 
                    embeds: [createEmbed(currentPage)], 
                    components: [row] 
                });
            });

            collector.on('end', () => {
                row.components.forEach(component => component.setDisabled(true));
                initialMessage.edit({ components: [row] }).catch(() => {});
            });

        } catch (error) {
            console.error('Error executing roles command:', error);
            const errorMessage = { 
                content: locale.commands.roles.commandError,
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
