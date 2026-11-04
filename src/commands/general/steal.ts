import { ChatInputCommandInteraction, GuildMember, Message, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';

const emojiPattern = /^<(a?):([A-Za-z0-9_]{2,32}):(\d+)>$/;
const imageUrlPattern = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?$/i;

async function download(url: string): Promise<Buffer> {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 8 * 1024 * 1024) throw new Error('The asset is larger than 8 MB.');
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 8 * 1024 * 1024) throw new Error('The asset is larger than 8 MB.');
    return data;
}

function cleanName(value: string | undefined, fallback: string): string {
    const name = (value || fallback).replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
    return name || fallback;
}

async function addEmoji(guild: NonNullable<Message['guild']>, name: string, url: string): Promise<string> {
    if (guild.emojis.cache.some(emoji => emoji.name?.toLowerCase() === name.toLowerCase())) {
        throw new Error(`An emoji named **${name}** already exists in this server.`);
    }
    const data = await download(url);
    const created = await guild.emojis.create({ attachment: data, name, reason: 'Added with the steal command' });
    return `Added emoji ${created} **${name}** to this server.`;
}

async function addSticker(guild: NonNullable<Message['guild']>, name: string, url: string, tags = '✨'): Promise<string> {
    if (guild.stickers.cache.some(sticker => sticker.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`A sticker named **${name}** already exists in this server.`);
    }
    const data = await download(url);
    const created = await guild.stickers.create({ file: data, name: name.slice(0, 30), tags: tags.slice(0, 200), reason: 'Added with the steal command' });
    return `Added sticker **${created.name}** to this server.`;
}

export const data = new SlashCommandBuilder()
    .setName('steal')
    .setDescription('Add an emoji or sticker to this server')
    .addStringOption(option => option.setName('asset').setDescription('Custom emoji markup or direct image/sticker URL').setRequired(true))
    .addStringOption(option => option.setName('type').setDescription('Asset type for a direct URL').setRequired(false).addChoices({ name: 'Emoji', value: 'emoji' }, { name: 'Sticker', value: 'sticker' }))
    .addStringOption(option => option.setName('name').setDescription('Name for a direct URL asset').setRequired(false))
    .addStringOption(option => option.setName('tags').setDescription('Sticker tags, such as ✨').setRequired(false));

export const command: Command = {
    name: 'steal',
    enabled: true,
    aliases: ['steal'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], _client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        if (!guild) return;
        const member = isSlash ? interaction.member as GuildMember : (interaction as Message).member;
        if (!member || !('permissions' in member) || !member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
            const content = 'You need the Manage Emojis and Stickers permission to use this command.';
            await (isSlash ? interaction.reply({ content, ephemeral: true }) : (interaction as Message).reply(content));
            return;
        }
        const prefixArgs = [...args];
        const requestedType = isSlash ? interaction.options.getString('type') : (prefixArgs[0]?.toLowerCase() === 'sticker' || prefixArgs[0]?.toLowerCase() === 'emoji' ? prefixArgs.shift()?.toLowerCase() : undefined);
        const asset = isSlash ? interaction.options.getString('asset', true) : prefixArgs[0];
        const requestedName = isSlash ? (interaction.options.getString('name') || undefined) : prefixArgs[1];
        const tags = isSlash ? (interaction.options.getString('tags') || '✨') : '✨';
        if (!asset) {
            const content = 'Usage: `!steal <:emoji:ID>` or `!steal sticker URL name`.';
            await (isSlash ? interaction.reply({ content, ephemeral: true }) : (interaction as Message).reply(content));
            return;
        }
        await (isSlash ? interaction.deferReply() : Promise.resolve());
        try {
            const emojiMatch = asset.match(emojiPattern);
            let result: string;
            if (emojiMatch) {
                const animated = emojiMatch[1] === 'a';
                const name = cleanName(requestedName, emojiMatch[2]);
                const url = `https://cdn.discordapp.com/emojis/${emojiMatch[3]}.${animated ? 'gif' : 'png'}?size=1024&quality=lossless`;
                result = await addEmoji(guild, name, url);
            } else if (imageUrlPattern.test(asset)) {
                const isSticker = requestedType === 'sticker';
                const fallbackName = asset.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || (isSticker ? 'stolen_sticker' : 'stolen_emoji');
                const name = cleanName(requestedName, fallbackName);
                result = isSticker ? await addSticker(guild, name, asset, tags) : await addEmoji(guild, name, asset);
            } else {
                throw new Error('Use a custom emoji like `<:name:id>` or a direct PNG/GIF/WEBP image URL.');
            }
            if (isSlash) await interaction.editReply({ content: `✅ ${result}` });
            else await (interaction as Message).reply(`✅ ${result}`);
        } catch (error: any) {
            const content = `❌ ${error?.message || 'Unable to add that asset.'}`;
            if (isSlash) await interaction.editReply({ content });
            else await (interaction as Message).reply(content);
        }
    }
};
