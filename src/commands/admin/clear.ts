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

interface ClearCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        clear: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            botNoPermission: string;
            commandError: string;
            invalidAmount: string;
            maxAmount: string;
            requestedBy: string;
            amount: string;
            channel: string;
            cleared: string;
            nothingToDelete: string;
            tooOld: string;
        }
    }
}

export const data = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clears messages from the channel')
    .addIntegerOption(option =>
        option
            .setName('amount')
            .setDescription('Number of messages to clear (default: 100, max: 100)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100)
    );

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.clear as ClearCommandSettings,
        PermissionFlagsBits.ManageMessages
    );
};

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.clear) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.clear) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.clear) {
        locale = {
            commands: {
                clear: {
                    title: "Messages Cleared",
                    description: "Messages have been cleared from the channel",
                    success: "Successfully cleared {count} messages",
                    error: "Failed to clear messages",
                    noPermission: "You do not have permission to use this command.",
                    botNoPermission: "I do not have permission to manage messages in this channel.",
                    commandError: "An error occurred while executing the command.",
                    invalidAmount: "Please provide a valid number between 1 and 100.",
                    maxAmount: "You can only clear up to 100 messages at once.",
                    requestedBy: "Requested by {user}",
                    amount: "Amount",
                    channel: "Channel",
                    cleared: "Cleared",
                    nothingToDelete: "No messages found to delete.",
                    tooOld: "Cannot delete messages older than 14 days."
                }
            }
        };
    }
    
    return locale;
};

export const command: Command = {
    name: 'clear',
    aliases: settings.commands?.clear?.aliases || [],
    enabled: settings.commands?.clear?.enabled ?? true,
    execute: async (interaction: ChatInputCommandInteraction | Message, args: string[], client: any) => {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.clear.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            const channel = isSlash ? interaction.channel : (interaction as Message).channel;
            if (!channel || channel.type !== ChannelType.GuildText) {
                const reply = { content: locale.commands.clear.commandError, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            let amount: number;
            if (isSlash) {
                amount = interaction.options.getInteger('amount') || 100;
            } else {
                amount = parseInt(args[0]) || 100;
            }

            if (isNaN(amount) || amount < 1) {
                const reply = { content: locale.commands.clear.invalidAmount, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (amount > 100) {
                const reply = { content: locale.commands.clear.maxAmount, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!isSlash) {
                await (interaction as Message).delete().catch(() => {});
            }

            const messages = await channel.messages.fetch({ limit: amount });
            const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const recentMessages = messages.filter(msg => msg.createdTimestamp > fourteenDaysAgo);
            const oldMessages = messages.filter(msg => msg.createdTimestamp <= fourteenDaysAgo);
            let deletedCount = 0;

            // Discord bulk deletion is limited to messages newer than 14 days.
            if (recentMessages.size > 0) {
                const deletedRecent = await channel.bulkDelete(recentMessages, true).catch(error => {
                    console.error('Error bulk deleting recent messages:', error);
                    return null;
                });
                if (deletedRecent) deletedCount += deletedRecent.size;
            }

            // Delete older messages individually; this supports messages older than 14 days,
            // including messages older than one month. Keep it sequential to respect rate limits.
            for (const message of oldMessages.values()) {
                try {
                    await message.delete();
                    deletedCount += 1;
                } catch (error) {
                    console.error(`Error deleting old message ${message.id}:`, error);
                }
            }

            if (deletedCount === 0) {
                const reply = { content: locale.commands.clear.nothingToDelete, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : channel.send(reply.content));
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.clear.title)
                .setDescription(locale.commands.clear.description)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: `#️⃣ ${locale.commands.clear.channel}`,
                        value: channel.toString(),
                        inline: true
                    },
                    {
                        name: `🗑️ ${locale.commands.clear.amount}`,
                        value: deletedCount.toString(),
                        inline: true
                    }
                )
                .setFooter({ 
                    text: locale.commands.clear.requestedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )
                })
                .setTimestamp();

            const reply = { embeds: [embed], flags: 1 << 6 };
            if (isSlash) {
                await interaction.reply(reply);
            } else {
                const msg = await channel.send(reply);
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            }

        } catch (error) {
            console.error('Error executing clear command:', error);
            const errorMessage = { 
                content: locale.commands.clear.commandError,
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
