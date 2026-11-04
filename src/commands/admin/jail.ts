import {
    ChatInputCommandInteraction,
    ChannelType,
    GuildMember,
    Message,
    PermissionFlagsBits,
    Role,
    SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { checkCommandPermissions } from '../../utils/permissionChecker';

export const data = new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Jail or release a member')
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Jail a member')
            .addUserOption(option => option.setName('user').setDescription('Member to jail').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Reason').setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Release a member')
            .addUserOption(option => option.setName('user').setDescription('Member to release').setRequired(true))
    );

async function ensureJailRole(guild: NonNullable<Message['guild']>): Promise<Role> {
    let role = guild.roles.cache.find(item => item.name.toLowerCase() === 'jailed');
    if (!role) {
        role = await guild.roles.create({
            name: 'Jailed',
            color: '#4b5563',
            permissions: [],
            reason: 'Create role for jail system'
        });
    }

    for (const channel of guild.channels.cache.values()) {
        if (
            channel.type !== ChannelType.GuildText &&
            channel.type !== ChannelType.GuildAnnouncement &&
            channel.type !== ChannelType.GuildVoice &&
            channel.type !== ChannelType.GuildStageVoice &&
            channel.type !== ChannelType.GuildForum
        ) continue;

        await channel.permissionOverwrites.edit(role, {
            SendMessages: false,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            SendMessagesInThreads: false,
            Connect: false,
            Speak: false,
            Stream: false
        }).catch(error => console.error('[jail] Failed to set channel overwrite:', error));
    }
    return role;
}

function getTarget(
    interaction: ChatInputCommandInteraction | Message,
    args: string[],
    remove: boolean
): Promise<GuildMember | null> {
    const guild = interaction.guild;
    if (!guild) return Promise.resolve(null);
    if (interaction instanceof ChatInputCommandInteraction) {
        const user = interaction.options.getUser('user');
        return user ? guild.members.fetch(user.id).catch(() => null) : Promise.resolve(null);
    }
    const raw = args[remove ? 1 : 0] || args[0];
    const id = raw?.replace(/[<@!>]/g, '');
    return id ? guild.members.fetch(id).catch(() => null) : Promise.resolve(null);
}

async function reply(interaction: ChatInputCommandInteraction | Message, content: string): Promise<void> {
    if (interaction instanceof ChatInputCommandInteraction) await interaction.reply({ content, ephemeral: true });
    else await interaction.reply(content);
}

export const command: Command = {
    name: 'jail',
    enabled: true,
    aliases: ['jail', 'unjail', 'prison', 'releasejail'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any): Promise<void> {
        const guild = interaction.guild;
        if (!guild) return;
        const actor = interaction instanceof ChatInputCommandInteraction
            ? interaction.member as GuildMember
            : interaction.member;
        if (!actor || !checkCommandPermissions(actor, client.settings?.commands?.jail, PermissionFlagsBits.ManageRoles)) {
            await reply(interaction, '❌ You need Manage Roles permission to use the jail system.');
            return;
        }

        const commandName = interaction instanceof ChatInputCommandInteraction
            ? interaction.options.getSubcommand()
            : (interaction.content.split(/\s+/)[0] || '').slice(1).toLowerCase();
        const remove = commandName === 'remove' || commandName === 'unjail' || commandName === 'releasejail' || args[0]?.toLowerCase() === 'remove';
        const target = await getTarget(interaction, args, remove);
        if (!target) {
            await reply(interaction, remove ? '❌ Mention a member to release.' : '❌ Mention a member to jail.');
            return;
        }
        if (target.id === guild.ownerId || target.id === actor.id) {
            await reply(interaction, '❌ You cannot jail that member.');
            return;
        }

        const role = await ensureJailRole(guild);
        if (!role.editable) {
            await reply(interaction, '❌ I cannot manage the Jailed role. Move it below my highest role.');
            return;
        }

        if (remove) {
            await target.roles.remove(role, 'Jail release');
            await reply(interaction, `✅ Released **${target.user.tag}** from jail.`);
        } else {
            const reason = interaction instanceof ChatInputCommandInteraction
                ? interaction.options.getString('reason')
                : args.slice(1).join(' ');
            await target.roles.add(role, reason || 'Jailed member');
            await reply(interaction, `🔒 Jailed **${target.user.tag}**${reason ? `: ${reason}` : '.'}`);
        }
    }
};