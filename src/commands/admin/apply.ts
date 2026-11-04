import { Command } from '../../interfaces/Command';
import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder,
    ChannelType,
    TextChannel,
    Message
} from 'discord.js';
import settings from '../../../settings.json';
import { ApplicationManager } from '../../apply/applyManager';

export const data = new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Manage the application system')
    .addSubcommand(subcommand =>
        subcommand
            .setName('setup')
            .setDescription('Set up the application system in a channel')
            .addChannelOption(option => 
                option.setName('channel')
                    .setDescription('The channel to set up the application system in')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Check the status of the application system')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('clear')
            .setDescription('Clear all applications from the database (Admin only)')
    );

export const command: Command = {
    name: 'apply',
    aliases: settings.commands?.apply?.aliases || [],
    enabled: settings.commands?.apply?.enabled ?? true,
    async execute(interaction: ChatInputCommandInteraction | Message, _args: string[], client: any) {
        if (!(interaction instanceof ChatInputCommandInteraction)) return;

        try {
            if (!interaction.guild || !interaction.channel) return;

            const settings = client.settings.apply;
            const locale = client.locales.get(client.settings.defaultLanguage)?.commands?.apply;

            if (!settings.enabled) {
                await interaction.reply({
                    content: locale?.disabled || '❌ The application system is currently disabled.',
                    ephemeral: true
                });
                return;
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'setup': {
                    const channel = interaction.options.getChannel('channel');
                    if (!channel || !(channel instanceof TextChannel)) {
                        await interaction.reply({
                            content: locale?.invalidChannel || '❌ Please select a valid text channel.',
                            ephemeral: true
                        });
                        return;
                    }

                    const applicationManager = new ApplicationManager(client);
                    await applicationManager.setupSystem(channel);

                    await interaction.reply({
                        content: locale?.success?.replace('{channel}', `<#${channel.id}>`) || 
                                `✅ Application system has been setup in ${channel}`,
                        ephemeral: true
                    });
                    break;
                }

                case 'status': {
                    const applicationManager = new ApplicationManager(client);
                    const stats = await applicationManager.getSystemStatus();
                    
                    await interaction.reply({
                        content: locale?.status
                            ?.replace('{total}', stats.total.toString())
                            ?.replace('{pending}', stats.pending.toString())
                            ?.replace('{accepted}', stats.accepted.toString())
                            ?.replace('{rejected}', stats.rejected.toString()) || 
                            `📊 Application System Status:\n• Total: ${stats.total}\n• Pending: ${stats.pending}\n• Accepted: ${stats.accepted}\n• Rejected: ${stats.rejected}`,
                        ephemeral: true
                    });
                    break;
                }

                case 'clear': {
                    if (!interaction.memberPermissions?.has('Administrator')) {
                        await interaction.reply({
                            content: locale?.noPermission || '❌ You need Administrator permission to use this command.',
                            ephemeral: true
                        });
                        return;
                    }

                    const applicationManager = new ApplicationManager(client);
                    await applicationManager.clearApplications();

                    await interaction.reply({
                        content: locale?.cleared || '✅ All applications have been cleared from the database.',
                        ephemeral: true
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('Error executing apply command:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the command.',
                ephemeral: true
            });
        }
    }
}; 
