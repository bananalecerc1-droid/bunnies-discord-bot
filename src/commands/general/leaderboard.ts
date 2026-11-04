import { ChatInputCommandInteraction, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { getGuildLeaderboard, levelProgress } from '../../leveling/levelingManager';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard')
    .addStringOption(option => option.setName('period').setDescription('Leaderboard period').setRequired(false).addChoices(
        { name: 'All time', value: 'all' },
        { name: 'Today', value: 'daily' },
        { name: 'This week', value: 'weekly' },
        { name: 'This month', value: 'monthly' }
    ));

export const command: Command = {
    name: 'leaderboard',
    enabled: true,
    aliases: ['leaderboard', 'lb'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], _client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        if (!guild) return;
        const period = isSlash ? interaction.options.getString('period') || 'all' : args[0] || 'all';
        if (isSlash) await interaction.deferReply();
        try {
            const validPeriod = ['all', 'daily', 'weekly', 'monthly'].includes(period) ? period as 'all' | 'daily' | 'weekly' | 'monthly' : 'all';
            const entries = await getGuildLeaderboard(guild.id, 10, validPeriod);
            if (!entries.length) {
                const empty = 'No XP data is available in this server yet.';
                if (isSlash) await interaction.editReply(empty); else await (interaction as Message).reply(empty);
                return;
            }
            const lines = entries.map((entry: any, index: number) => {
                const progress = levelProgress(entry.xp);
                const periodXp = validPeriod === 'daily' ? entry.dailyXp : validPeriod === 'weekly' ? entry.weeklyXp : validPeriod === 'monthly' ? entry.monthlyXp : entry.xp;
                return `**${index + 1}.** <@${entry.userId}> — **Level ${progress.level}** · **${Number(periodXp || 0).toLocaleString()} XP**`;
            });
            const periodLabel = validPeriod === 'all' ? 'All-time XP' : validPeriod === 'daily' ? 'Today' : validPeriod === 'weekly' ? 'This week' : 'This month';
            const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('🏆 XP Leaderboard').setDescription(lines.join('\n')).setFooter({ text: `${guild.name} • ${periodLabel}` });
            if (isSlash) await interaction.editReply({ embeds: [embed] }); else await (interaction as Message).reply({ embeds: [embed] });
        } catch (error) {
            console.error('[leaderboard] Failed:', error);
            const message = 'Failed to generate the leaderboard.';
            if (isSlash) await interaction.editReply(message); else await (interaction as Message).reply(message);
        }
    }
};
