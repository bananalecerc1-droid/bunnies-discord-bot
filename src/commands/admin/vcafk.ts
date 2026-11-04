import { ChatInputCommandInteraction, GuildMember, Message, PermissionFlagsBits, SlashCommandBuilder, VoiceChannel } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { checkCommandPermissions } from '../../utils/permissionChecker';
import { writeFileSync } from 'fs';
import { join } from 'path';

export const data = new SlashCommandBuilder()
    .setName('vcafk')
    .setDescription('Configure automatic voice AFK moving')
    .addSubcommand(subcommand =>
        subcommand
            .setName('setup')
            .setDescription('Set the AFK voice channel and timeout')
            .addChannelOption(option => option.setName('channel').setDescription('AFK voice channel').setRequired(true))
            .addIntegerOption(option => option.setName('minutes').setDescription('Muted and deafened minutes').setMinValue(1).setMaxValue(1440).setRequired(false))
    )
    .addSubcommand(subcommand => subcommand.setName('disable').setDescription('Disable VC AFK'))
    .addSubcommand(subcommand => subcommand.setName('status').setDescription('Show VC AFK status'));

function save(client: any, voiceAfk: any): void {
    const next = JSON.parse(JSON.stringify(client.settings));
    next.voiceAfk = voiceAfk;
    writeFileSync(join(process.cwd(), 'settings.json'), JSON.stringify(next, null, 4), 'utf8');
    client.settings = next;
}

async function reply(interaction: ChatInputCommandInteraction | Message, content: string): Promise<void> {
    if (interaction instanceof ChatInputCommandInteraction) await interaction.reply({ content, ephemeral: true });
    else await interaction.reply(content);
}

export const command: Command = {
    name: 'vcafk',
    enabled: true,
    aliases: ['vcafk', 'voiceafk'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any): Promise<void> {
        const guild = interaction.guild;
        if (!guild) return;
        const actor = interaction instanceof ChatInputCommandInteraction ? interaction.member as GuildMember : interaction.member;
        if (!actor || !checkCommandPermissions(actor, client.settings?.commands?.vcafk, PermissionFlagsBits.ManageGuild)) {
            await reply(interaction, '❌ You need Manage Server permission to configure VC AFK.');
            return;
        }

        const subcommand = interaction instanceof ChatInputCommandInteraction
            ? interaction.options.getSubcommand()
            : (args[0] || 'status').toLowerCase();
        const current = client.settings?.voiceAfk || { enabled: false, channelId: '', timeoutMinutes: 5, exemptRoleIds: [] };

        if (subcommand === 'disable' || subcommand === 'off') {
            save(client, { ...current, enabled: false });
            await reply(interaction, '✅ VC AFK disabled.');
            return;
        }
        if (subcommand === 'status') {
            await reply(interaction, current.enabled
                ? `✅ VC AFK is enabled for <#${current.channelId}> after ${current.timeoutMinutes} minutes.`
                : 'VC AFK is disabled.');
            return;
        }

        const channel = interaction instanceof ChatInputCommandInteraction
            ? interaction.options.getChannel('channel')
            : interaction.mentions.channels.first();
        const minutes = interaction instanceof ChatInputCommandInteraction
            ? interaction.options.getInteger('minutes') || 5
            : Number(args[2] || 5);
        if (!channel || !(channel instanceof VoiceChannel)) {
            await reply(interaction, '❌ Select a voice channel. Example: `!vcafk setup #afk 5`');
            return;
        }
        save(client, { ...current, enabled: true, channelId: channel.id, timeoutMinutes: Math.max(1, Math.min(1440, minutes)) });
        await reply(interaction, `✅ VC AFK enabled. Muted and deafened members move to ${channel} after ${minutes} minutes.`);
    }
};