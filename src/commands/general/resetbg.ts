import { ChatInputCommandInteraction, Message, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { UserRankBackground } from '../../models/UserRankBackground';

export const data = new SlashCommandBuilder().setName('resetbg').setDescription('Reset your rank card background to the server default');

export const command: Command = {
    name: 'resetbg',
    enabled: true,
    aliases: ['resetbg'],
    async execute(interaction: ChatInputCommandInteraction | Message, _args: string[], _client: any) {
        if (!(interaction instanceof ChatInputCommandInteraction)) { await (interaction as Message).reply('Use `/resetbg` to reset your rank background.'); return; }
        await UserRankBackground.deleteMany({ userId: interaction.user.id });
        await interaction.reply({ content: 'Your rank card background was reset to the server default.', flags: MessageFlags.Ephemeral });
    }
};
