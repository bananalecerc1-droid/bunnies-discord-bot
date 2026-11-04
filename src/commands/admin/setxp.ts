import { ChatInputCommandInteraction, GuildMember, Message, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { UserLevel } from '../../models/UserLevel';
import { levelFromXp } from '../../leveling/levelingManager';

export const data = new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Set a member\'s XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addUserOption(option => option.setName('user').setDescription('Member whose XP to set').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('Total XP amount').setMinValue(0).setMaxValue(1000000000).setRequired(true));

export const command: Command = {
    name: 'setxp',
    enabled: true,
    aliases: ['setxp'],
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
        const amount = isSlash ? (interaction.options.getInteger('amount') ?? -1) : Number.parseInt(args[1] || '', 10);
        if (!target || !Number.isInteger(amount) || amount < 0 || amount > 1000000000) {
            const content = 'Usage: `!setxp @user <amount>`';
            await (isSlash ? interaction.reply({ content, ephemeral: true }) : (interaction as Message).reply(content));
            return;
        }
        const doc = await UserLevel.findOne({ guildId: guild.id, userId: target.id }) || await UserLevel.create({ guildId: guild.id, userId: target.id });
        doc.xp = amount;
        doc.level = levelFromXp(amount);
        await doc.save();
        const content = `Set ${target} to **${doc.xp.toLocaleString()} XP** (level **${doc.level}**).`;
        await (isSlash ? interaction.reply({ content }) : (interaction as Message).reply(content));
    }
};
