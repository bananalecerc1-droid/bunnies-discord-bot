import { Message } from 'discord.js';
import { createHash } from 'crypto';
import { ModBot } from '../types/ModBot';

interface AssetImportSettings {
    enabled?: boolean;
    emojiChannelId?: string;
    stickerChannelId?: string;
}

const recentAssets = new Set<string>();
const emojiPattern = /<(a?):([A-Za-z0-9_]+):(\d+)>/g;
const imageExtensions = /\.(png|jpe?g|gif|webp)(?:\?.*)?$/i;

function settingsOf(client: ModBot): AssetImportSettings {
    return client.settings.assetImport || {};
}

function channelMatches(message: Message, channelId: string | undefined): boolean {
    return Boolean(channelId && message.guild && message.channelId === channelId);
}

async function download(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok) return null;
        const length = Number(response.headers.get('content-length') || 0);
        if (length > 8 * 1024 * 1024) return null;
        const data = Buffer.from(await response.arrayBuffer());
        return data.length > 8 * 1024 * 1024 ? null : data;
    } catch (error) {
        console.error('[asset-import] Download failed:', error);
        return null;
    }
}

function digest(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

async function addEmoji(message: Message, client: ModBot, name: string, id: string, animated: boolean): Promise<void> {
    if (!message.guild || !channelMatches(message, settingsOf(client).emojiChannelId)) return;
    const key = `emoji:${message.guild.id}:${id}`;
    if (recentAssets.has(key)) return;
    recentAssets.add(key);
    try {
        if (message.guild.emojis.cache.some(emoji => emoji.name?.toLowerCase() === name.toLowerCase())) return;
        const extension = animated ? 'gif' : 'png';
        const data = await download(`https://cdn.discordapp.com/emojis/${id}.${extension}?size=1024&quality=lossless`);
        if (!data) return;
        const hash = digest(data);
        if (message.guild.emojis.cache.some(emoji => emoji.url && emoji.name?.toLowerCase() === name.toLowerCase())) return;
        await message.guild.emojis.create({ attachment: data, name, reason: `Imported from #${(message.channel as any).name || message.channelId}` });
        console.log(`[asset-import] Added emoji ${name} (${hash.slice(0, 12)}) to ${message.guild.id}`);
    } catch (error: any) {
        if (error?.code !== 30008) console.error(`[asset-import] Failed to add emoji ${name}:`, error);
    }
}

async function addSticker(message: Message, client: ModBot, name: string, url: string, tags = '✨'): Promise<void> {
    if (!message.guild || !channelMatches(message, settingsOf(client).stickerChannelId)) return;
    const key = `sticker:${message.guild.id}:${url}`;
    if (recentAssets.has(key)) return;
    recentAssets.add(key);
    try {
        if (message.guild.stickers.cache.some(sticker => sticker.name.toLowerCase() === name.toLowerCase())) return;
        const data = await download(url);
        if (!data || !imageExtensions.test(url)) return;
        const hash = digest(data);
        await message.guild.stickers.create({
            file: data,
            name: name.slice(0, 30),
            tags: (tags || '✨').slice(0, 200),
            reason: `Imported from #${(message.channel as any).name || message.channelId}`
        });
        console.log(`[asset-import] Added sticker ${name} (${hash.slice(0, 12)}) to ${message.guild.id}`);
    } catch (error: any) {
        if (error?.code !== 30039) console.error(`[asset-import] Failed to add sticker ${name}:`, error);
    }
}

export async function handleAssetImport(message: Message, client: ModBot): Promise<void> {
    const settings = settingsOf(client);
    if (settings.enabled === false || !message.guild) return;
    if (!channelMatches(message, settings.emojiChannelId) && !channelMatches(message, settings.stickerChannelId)) return;

    // Custom emoji markup is present in ordinary, forwarded, and webhook messages.
    if (channelMatches(message, settings.emojiChannelId)) {
        const matches = [...message.content.matchAll(emojiPattern)];
        for (const match of matches) await addEmoji(message, client, match[2], match[3], match[1] === 'a');
    }

    if (channelMatches(message, settings.stickerChannelId)) {
        for (const sticker of message.stickers.values()) {
            await addSticker(message, client, sticker.name, sticker.url);
        }
        for (const attachment of message.attachments.values()) {
            const contentType = attachment.contentType || '';
            if (contentType.startsWith('image/') || imageExtensions.test(attachment.url)) {
                const baseName = (attachment.name || 'imported-sticker').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 30) || 'imported-sticker';
                await addSticker(message, client, baseName, attachment.url);
            }
        }
    }
}
