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

interface PingCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        ping: {
            title: string;
            description: string;
            websocket: string;
            roundtrip: string;
            message: string;
            database: string;
            api: string;
            calculating: string;
            noPermission: string;
            commandError: string;
            requestedBy: string;
            status: string;
            excellent: string;
            good: string;
            okay: string;
            poor: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Shows bot latency information');

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.ping as PingCommandSettings
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.ping) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.ping) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.ping) {
        locale = {
            commands: {
                ping: {
                    title: "Bot Latency",
                    description: "Current latency metrics for the bot",
                    websocket: "WebSocket",
                    roundtrip: "Roundtrip",
                    message: "Message",
                    database: "Database",
                    api: "API",
                    calculating: "Calculating...",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    requestedBy: "Requested by {user}",
                    status: "Status",
                    excellent: "Excellent",
                    good: "Good",
                    okay: "Okay",
                    poor: "Poor"
                }
            }
        };
    }
    
    return locale;
};

const getLatencyColor = (ping: number): number => {
    if (ping < 100) return 0x00ff00; // Green
    if (ping < 200) return 0xffff00; // Yellow
    if (ping < 300) return 0xffa500; // Orange
    return 0xff0000; // Red
};

const getLatencyStatus = (ping: number, locale: LocaleData): string => {
    if (ping < 100) return `🟢 ${locale.commands.ping.excellent}`;
    if (ping < 200) return `🟡 ${locale.commands.ping.good}`;
    if (ping < 300) return `🟠 ${locale.commands.ping.okay}`;
    return `🔴 ${locale.commands.ping.poor}`;
};

const formatPing = (ping: number): string => {
    return `${Math.round(ping)}ms`;
};

export const command: Command = {
    name: 'ping',
    aliases: settings.commands?.ping?.aliases || [],
    enabled: settings.commands?.ping?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, _args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.ping.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            const wsLatency = client.ws.ping;
            
            const embed = new EmbedBuilder()
                .setTitle(locale.commands.ping.title)
                .setDescription(locale.commands.ping.description)
                .setColor(getLatencyColor(wsLatency))
                .addFields(
                    {
                        name: `📡 ${locale.commands.ping.websocket}`,
                        value: formatPing(wsLatency),
                        inline: true
                    },
                    {
                        name: `🔄 ${locale.commands.ping.roundtrip}`,
                        value: locale.commands.ping.calculating,
                        inline: true
                    },
                    {
                        name: `📊 ${locale.commands.ping.status}`,
                        value: getLatencyStatus(wsLatency, locale),
                        inline: false
                    }
                )
                .setFooter({ 
                    text: locale.commands.ping.requestedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )
                })
                .setTimestamp();

            const start = Date.now();
            const response = await (isSlash 
                ? (interaction as ChatInputCommandInteraction).reply({ embeds: [embed], fetchReply: true })
                : (interaction as Message).reply({ embeds: [embed] })) as Message;

            const roundtripLatency = Date.now() - start;

            embed.setColor(getLatencyColor(Math.max(wsLatency, roundtripLatency)))
                .spliceFields(1, 1, {
                    name: `🔄 ${locale.commands.ping.roundtrip}`,
                    value: formatPing(roundtripLatency),
                    inline: true
                })
                .spliceFields(2, 1, {
                    name: `📊 ${locale.commands.ping.status}`,
                    value: getLatencyStatus(Math.max(wsLatency, roundtripLatency), locale),
                    inline: false
                });

            await response.edit({ embeds: [embed] });

        } catch (error) {
            console.error('Error executing ping command:', error);
            const errorMessage = { 
                content: locale.commands.ping.commandError,
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
