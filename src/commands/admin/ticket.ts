import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    Message,
    PermissionFlagsBits,
    TextChannel
} from 'discord.js';
import { TicketManager } from '../../ticket/ticketManager';
import { checkCommandPermissions } from '../../utils/permissionChecker';

export const data = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket system')
    .addSubcommand(subcommand =>
        subcommand
            .setName('setup')
            .setDescription('Setup the ticket system')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The channel to setup the ticket system in')
                    .setRequired(true)
            )
    );

export const command: Command = {
    name: 'ticket',
    enabled: true,
    aliases: ['tickets'],
    async execute(interaction: ChatInputCommandInteraction | Message, _: string[], client: any) {
        try {
            if (!(interaction instanceof ChatInputCommandInteraction)) return;
            if (!interaction.guild) return;

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const locale = client.locales.get(client.settings.defaultLanguage)?.ticket;

            const hasPermission = checkCommandPermissions(
                member,
                client.settings.commands?.ticket,
                PermissionFlagsBits.Administrator
            );

            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.noPermission || '❌ You do not have permission to use this command.',
                    ephemeral: true
                });
                return;
            }

            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'setup') {
                const channel = interaction.options.getChannel('channel') as TextChannel;
                if (!channel || !channel.isTextBased()) {
                    await interaction.reply({
                        content: '❌ Please provide a valid text channel.',
                        ephemeral: true
                    });
                    return;
                }

                const ticketManager = new TicketManager(client);
                await ticketManager.setupSystem(channel);

                await interaction.reply({
                    content: '✅ Ticket system has been set up successfully!',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error executing ticket command:', error);
            if (interaction instanceof ChatInputCommandInteraction) {
                await interaction.reply({
                    content: '❌ An error occurred while executing the command.',
                    ephemeral: true
                });
            }
        }
    }
}; 
