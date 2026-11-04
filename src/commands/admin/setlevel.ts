import { ChatInputCommandInteraction, GuildMember, Message, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { UserLevel } from '../../models/UserLevel';
import { levelFromXp, xpNeededForLevel } from '../../leveling/levelingManager';

function xpForLevel(level: number): number {
    let xp = 0;
    for (let current = 0; current < level; current++) xp += xpNeededForLevel(current);
    return xp;
}

export const data = new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('Set a member\'s level')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addUserOption(option => option.setName('user').setDescription('Member whose level to set').setRequired(true))
    .addIntegerOption(option => option.setName('level').setDescription('Level to set').setMinValue(0).setMaxValue(2000).setRequired(true));

export const command: Command = {
    name: 'setlevel',
    enabled: true,
    aliases: ['setlevel'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[]) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const actor = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
        if (!guild || !actor?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            const content = 'You need the **Manage Server** permission to use this command.';
            await (isSlash ? interaction.reply({ content, ephemeral: true }) : (interaction as Message).reply(content));
            return;
        }
        const targetUser = isSlash ? interaction.options.getUser('user') : null;
        const target = isSlash
            ? (targetUser ? await guild.members.fetch(targetUser.id).catch(() => null) : null)
            : await guild.members.fetch(args[0]?.replace(/[<@!>]/g, '') || '').catch(() => null);
        const level = isSlash ? (interaction.options.getInteger('level') ?? -1) : Number.parseInt(args[1] || '', 10);
        if (!target || !Number.isInteger(level) || level < 0 || level > 2000) {
            const content = 'Usage: `!setlevel @user <level>`';
            await (isSlash ? interaction.reply({ content, ephemeral: true }) : (interaction as Message).reply(content));
            return;
        }
        const xp = xpForLevel(level);
        const doc = await UserLevel.findOne({ guildId: guild.id, userId: target.id }) || await UserLevel.create({ guildId: guild.id, userId: target.id });
        doc.xp = xp;
        doc.level = levelFromXp(xp);
        await doc.save();
        const content = `Set ${target} to **level ${doc.level}** (${doc.xp.toLocaleString()} XP).`;
        await (isSlash ? interaction.reply({ content }) : (interaction as Message).reply(content));
    }
};
