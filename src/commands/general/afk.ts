import { ChatInputCommandInteraction, Message, SlashCommandBuilder } from 'discord.js';
import { setAfk } from '../../afk/afkManager';
import { Command } from '../../interfaces/Command';

export const data = new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status; it clears automatically when you send a message')
    .addStringOption(option =>
        option.setName('reason').setDescription('Why you are AFK').setRequired(false)
    );

export const command: Command = {
    name: 'afk',
    enabled: true,
    aliases: ['afk'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[]): Promise<void> {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = interaction.guild;
        if (!guild) return;

        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const reason = (isSlash ? interaction.options.getString('reason') : args.join(' '))?.trim() || 'AFK';
        await setAfk(guild.id, userId, reason.slice(0, 200));
        const content = `💤 You are now AFK: ${reason.slice(0, 200)}`;
        if (isSlash) await interaction.reply({ content, ephemeral: true });
        else await interaction.reply(content);
    }
};