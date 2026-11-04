import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    GuildMember,
    Message,
    PermissionFlagsBits,
    TextChannel
} from 'discord.js';
import settings from '../../../settings.json';
import { createGiveaway } from '../../giveaway/giveawayManager';

const parseDuration = (input: string): number | null => {
    const match = input.match(/^(\d+)([mhdw])$/i);
    if (!match) return null;

    const [, amount, unit] = match;
    const value = parseInt(amount);

    switch (unit.toLowerCase()) {
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'w': 
            const days = value * 7;
            if (days > 28) return null;
            return days * 24 * 60 * 60 * 1000;
        default:
            return null;
    }
};

export const data = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create a new giveaway')
    .addStringOption(option => 
        option.setName('prize')
            .setDescription('What is being given away?')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('duration')
            .setDescription('How long should the giveaway last? (e.g., 1h, 1d)')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('winners')
            .setDescription('How many winners?')
            .setMinValue(1)
            .setMaxValue(Math.min(settings.giveaway?.maxWinners ?? 10, 25))
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Which channel to start the giveaway in?')
            .setRequired(false));

export const command: Command = {
    name: 'giveaway',
    enabled: settings.giveaway?.enabled ?? true,
    aliases: settings.giveaway?.aliases || ['gcreate', 'gstart', 'giveawaystart'],
    
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = interaction.guild;
        const locale = client.locales.get(guild?.preferredLocale || client.defaultLanguage)?.commands?.giveaway;

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!executingMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
                const response = locale?.error?.noPermission || "You don't have permission to create giveaways.";
                if (isSlash) {
                    await interaction.reply({ content: response, ephemeral: true });
                } else {
                    await (interaction as Message).reply(response);
                }
                return;
            }

            let prize: string, duration: number, winners: number, channel: TextChannel;

            if (isSlash) {
                const slashInteraction = interaction as ChatInputCommandInteraction;
                prize = slashInteraction.options.getString('prize', true);
                const durationStr = slashInteraction.options.getString('duration', true);
                duration = parseDuration(durationStr) || 0;
                if (!duration) {
                    const response = 'Invalid duration. Use a value such as 10m, 1h, or 1d.';
                    await interaction.reply({ content: response, ephemeral: true });
                    return;
                }
                winners = slashInteraction.options.getInteger('winners', true);
                channel = (slashInteraction.options.getChannel('channel') || interaction.channel) as TextChannel;
            } else {
                if (args.length < 3) {
                    await (interaction as Message).reply('Usage: !giveaway <duration> <winners> <prize>');
                    return;
                }
                duration = parseDuration(args[0]) || 0;
                winners = parseInt(args[1]);
                const maxWinners = Math.min(settings.giveaway?.maxWinners ?? 10, 25);
                if (!duration || !Number.isInteger(winners) || winners < 1 || winners > maxWinners) {
                    await (interaction as Message).reply('Usage: !giveaway <duration: 1h/1d> <winners: 1-10> <prize>');
                    return;
                }
                prize = args.slice(2).join(' ');
                channel = interaction.channel as TextChannel;
            }

            await createGiveaway(client, {
                prize,
                duration,
                winners,
                channel,
                hostId: isSlash ? interaction.user.id : (interaction as Message).author.id
            });

            const response = locale?.success?.created?.replace('{channel}', channel.toString()) || 
                           `Giveaway created in ${channel}!`;
            if (isSlash) {
                await interaction.reply({ content: response, ephemeral: true });
            } else {
                await (interaction as Message).reply(response);
            }

        } catch (error) {
            console.error('Error executing giveaway command:', error);
            const response = locale?.error?.unknown || 'An error occurred while creating the giveaway.';
            if (isSlash) {
                await interaction.reply({ content: response, ephemeral: true });
            } else {
                await (interaction as Message).reply(response);
            }
        }
    }
}; 
