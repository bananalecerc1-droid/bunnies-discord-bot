import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
    GuildVerificationLevel,
    GuildExplicitContentFilter,
    GuildPremiumTier
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface ServerCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        server: {
            title: string;
            owner: string;
            created: string;
            members: string;
            channels: string;
            roles: string;
            emojis: string;
            boosts: string;
            boostTier: string;
            verificationLevel: string;
            contentFilter: string;
            features: string;
            description: string;
            error: string;
            noPermission: string;
            commandError: string;
            rolesMore: string;
            none: string;
            requestedBy: string;
            total: string;
            online: string;
            text: string;
            voice: string;
            categories: string;
            animated: string;
            static: string;
            stickers: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('server')
    .setDescription('Shows server information');

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.server as ServerCommandSettings
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.server) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.server) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.server) {
        locale = {
            commands: {
                server: {
                    title: "Server Information",
                    owner: "Owner",
                    created: "Created",
                    members: "Members",
                    channels: "Channels",
                    roles: "Roles",
                    emojis: "Emojis",
                    boosts: "Boosts",
                    boostTier: "Boost Tier",
                    verificationLevel: "Verification Level",
                    contentFilter: "Content Filter",
                    features: "Features",
                    description: "Description",
                    error: "Failed to fetch server information",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    rolesMore: "...and {count} more",
                    none: "None",
                    requestedBy: "Requested by {user}",
                    total: "Total: {count}",
                    online: "Online: {count}",
                    text: "Text: {count}",
                    voice: "Voice: {count}",
                    categories: "Categories: {count}",
                    animated: "Animated: {count}",
                    static: "Static: {count}",
                    stickers: "Stickers: {count}"
                }
            }
        };
    }
    
    return locale;
};

const MAX_DISPLAYED_ROLES = 8;

const getVerificationLevel = (level: GuildVerificationLevel): string => {
    const levels: { [key: number]: string } = {
        [GuildVerificationLevel.None]: "None",
        [GuildVerificationLevel.Low]: "Low",
        [GuildVerificationLevel.Medium]: "Medium",
        [GuildVerificationLevel.High]: "High",
        [GuildVerificationLevel.VeryHigh]: "Highest"
    };
    return levels[level] || "Unknown";
};

const getContentFilter = (filter: GuildExplicitContentFilter): string => {
    const filters: { [key: number]: string } = {
        [GuildExplicitContentFilter.Disabled]: "Disabled",
        [GuildExplicitContentFilter.MembersWithoutRoles]: "No Role Members",
        [GuildExplicitContentFilter.AllMembers]: "All Members"
    };
    return filters[filter] || "Unknown";
};

const getBoostTier = (tier: GuildPremiumTier): string => {
    const tiers: { [key: number]: string } = {
        [GuildPremiumTier.None]: "None",
        [GuildPremiumTier.Tier1]: "Level 1",
        [GuildPremiumTier.Tier2]: "Level 2",
        [GuildPremiumTier.Tier3]: "Level 3"
    };
    return tiers[tier] || "Unknown";
};

export const command: Command = {
    name: 'server',
    aliases: settings.commands?.server?.aliases || [],
    enabled: settings.commands?.server?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, _args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            if (!guild) {
                throw new Error('Command must be used in a server');
            }

            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.server.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            if (guild.members.cache.size !== guild.memberCount) {
                await guild.members.fetch();
            }

            const roles = guild.roles.cache
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position);

            let rolesDisplay: string;
            if (roles.size > MAX_DISPLAYED_ROLES) {
                const topRoles = Array.from(roles.values())
                    .slice(0, MAX_DISPLAYED_ROLES);
                
                rolesDisplay = topRoles.map(role => `<@&${role.id}>`).join(', ') + 
                    ` *${locale.commands.server.rolesMore.replace('{count}', (roles.size - MAX_DISPLAYED_ROLES).toString())}*`;
            } else {
                rolesDisplay = roles.size ? roles.map(role => `<@&${role.id}>`).join(', ') : locale.commands.server.none;
            }

            const onlineMembers = guild.members.cache.filter(member => 
                member.presence?.status === 'online' || 
                member.presence?.status === 'idle' || 
                member.presence?.status === 'dnd'
            ).size;

            const features = guild.features
                .map(feature => feature.toLowerCase()
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                )
                .join(', ') || locale.commands.server.none;

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.server.title)
                .setColor('#0099ff')
                .setThumbnail(guild.iconURL({ size: 1024 }) || null)
                .setImage(guild.bannerURL({ size: 1024 }) || null)
                .addFields(
                    { 
                        name: '👑 ' + locale.commands.server.owner, 
                        value: `<@${guild.ownerId}>`, 
                        inline: true 
                    },
                    { 
                        name: '📅 ' + locale.commands.server.created, 
                        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, 
                        inline: true 
                    },
                    { 
                        name: '👥 ' + locale.commands.server.members, 
                        value: [
                            locale.commands.server.total.replace('{count}', guild.memberCount.toString()),
                            locale.commands.server.online.replace('{count}', onlineMembers.toString())
                        ].join('\n'), 
                        inline: true 
                    },
                    { 
                        name: '📊 ' + locale.commands.server.channels, 
                        value: [
                            locale.commands.server.categories.replace('{count}', guild.channels.cache.filter(c => c.type === 4).size.toString()),
                            locale.commands.server.text.replace('{count}', guild.channels.cache.filter(c => c.type === 0).size.toString()),
                            locale.commands.server.voice.replace('{count}', guild.channels.cache.filter(c => c.type === 2).size.toString())
                        ].join('\n'), 
                        inline: true 
                    },
                    { 
                        name: '😄 ' + locale.commands.server.emojis, 
                        value: [
                            locale.commands.server.total.replace('{count}', guild.emojis.cache.size.toString()),
                            locale.commands.server.animated.replace('{count}', guild.emojis.cache.filter(e => e.animated).size.toString()),
                            locale.commands.server.static.replace('{count}', guild.emojis.cache.filter(e => !e.animated).size.toString())
                        ].join('\n'), 
                        inline: true 
                    },
                    { 
                        name: '🎨 ' + locale.commands.server.stickers, 
                        value: locale.commands.server.total.replace('{count}', guild.stickers.cache.size.toString()), 
                        inline: true 
                    },
                    { 
                        name: '🚀 ' + locale.commands.server.boosts, 
                        value: [
                            locale.commands.server.total.replace('{count}', guild.premiumSubscriptionCount?.toString() || '0'),
                            locale.commands.server.boostTier + ': ' + getBoostTier(guild.premiumTier)
                        ].join('\n'), 
                        inline: true 
                    },
                    { 
                        name: '🛡️ ' + locale.commands.server.verificationLevel, 
                        value: getVerificationLevel(guild.verificationLevel), 
                        inline: true 
                    },
                    { 
                        name: '⚔️ ' + locale.commands.server.contentFilter, 
                        value: getContentFilter(guild.explicitContentFilter), 
                        inline: true 
                    },
                    { 
                        name: '✨ ' + locale.commands.server.features, 
                        value: features 
                    },
                    { 
                        name: `👑 ${locale.commands.server.roles} [${roles.size}]`, 
                        value: rolesDisplay 
                    }
                )
                .setFooter({ 
                    text: locale.commands.server.requestedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )
                })
                .setTimestamp();

            if (guild.description) {
                embed.setDescription(guild.description);
            }

            if (isSlash) {
                await (interaction as ChatInputCommandInteraction).reply({ embeds: [embed] });
            } else {
                await (interaction as Message).reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error executing server command:', error);
            const errorMessage = { 
                content: locale.commands.server.commandError,
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
