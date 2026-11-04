import { Command } from '../../interfaces/Command';
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AttachmentBuilder,
    Message,
    GuildMember
} from 'discord.js';
import { getUserRank, levelProgress } from '../../leveling/levelingManager';
import { generateRankCard } from '../../leveling/rankCard';
import { UserRankBackground } from '../../models/UserRankBackground';

export const data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Shows your (or another member\'s) level and XP')
    .addUserOption(option =>
        option.setName('user').setDescription('The member to check').setRequired(false)
    );

export const command: Command = {
    name: 'rank',
    enabled: true,
    aliases: ['rank', 'level'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], _client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        if (!guild) return;
        let targetMember: GuildMember | null | undefined;
        if (isSlash) {
            const targetUser = interaction.options.getUser('user');
            targetMember = targetUser
                ? await guild.members.fetch(targetUser.id).catch(() => null)
                : (interaction.member as GuildMember);
        } else {
            const msg = interaction as Message;
            if (args.length > 0) {
                const targetId = args[0].replace(/[<@!>]/g, '');
                targetMember = await guild.members.fetch(targetId).catch(() => null);
            } else {
                targetMember = msg.member;
            }
        }
        if (!targetMember) {
            const reply = { content: 'User not found.', flags: 1 << 6 };
            await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
            return;
        }
        const data = await getUserRank(guild.id, targetMember.id);
        if (!data) {
            const content = `${targetMember.id === (isSlash ? interaction.user.id : (interaction as Message).author.id) ? 'You have' : `${targetMember.user.username} has`} no XP yet.`;
            await (isSlash ? interaction.reply({ content }) : (interaction as Message).reply(content));
            return;
        }
        const progress = levelProgress(data.xp);
        const backgroundRecord: any = await UserRankBackground.findOne({ userId: targetMember.id }).lean();
        const customBackground = backgroundRecord?.data?.base64 ? Buffer.from(backgroundRecord.data.base64, 'base64') : undefined;
        try {
            const card = await generateRankCard({
                username: targetMember.user.username,
                discriminator: targetMember.user.discriminator,
                avatarUrl: targetMember.user.displayAvatarURL({ extension: 'png', size: 256 }),
                level: progress.level,
                currentXp: progress.currentLevelXp,
                xpNeeded: progress.neededXp,
                totalXp: data.xp,
                rank: data.rank,
                customBackground
            });
            const reply = { files: [new AttachmentBuilder(card, { name: 'rank.png' })] };
            await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply));
        } catch (error) {
            console.error('[rank] Failed to generate rank card:', error);
            const fallback = `Rank #${data.rank} • Level ${progress.level} • ${progress.currentLevelXp}/${progress.neededXp} XP • Total ${data.xp} XP`;
            await (isSlash ? interaction.reply({ content: fallback }) : (interaction as Message).reply(fallback));
        }
    }
};
