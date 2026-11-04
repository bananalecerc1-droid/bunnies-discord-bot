import { Message } from 'discord.js';
import { randomUUID } from 'crypto';
import { getClient } from '../db/turso';

export interface AfkStatus {
    guildId: string;
    userId: string;
    reason: string;
    setAt: string;
    lastMentionUrl?: string;
}

export async function setAfk(guildId: string, userId: string, reason: string): Promise<void> {
    const db = getClient();
    await db.execute({
        sql: `INSERT INTO afk_status (id, guildId, userId, reason, setAt, lastMentionUrl)
              VALUES (?, ?, ?, ?, ?, NULL)
              ON CONFLICT(guildId, userId) DO UPDATE SET
                reason = excluded.reason,
                setAt = excluded.setAt,
                lastMentionUrl = NULL`,
        args: [randomUUID(), guildId, userId, reason || 'AFK', new Date().toISOString()]
    });
}

export async function getAfk(guildId: string, userId: string): Promise<AfkStatus | null> {
    const result = await getClient().execute({
        sql: 'SELECT guildId, userId, reason, setAt, lastMentionUrl FROM afk_status WHERE guildId = ? AND userId = ?',
        args: [guildId, userId]
    });
    const row = result.rows[0];
    return row ? {
        guildId: String(row.guildId),
        userId: String(row.userId),
        reason: String(row.reason || 'AFK'),
        setAt: String(row.setAt),
        lastMentionUrl: row.lastMentionUrl ? String(row.lastMentionUrl) : undefined
    } : null;
}

export async function clearAfk(guildId: string, userId: string): Promise<boolean> {
    const result = await getClient().execute({
        sql: 'DELETE FROM afk_status WHERE guildId = ? AND userId = ?',
        args: [guildId, userId]
    });
    return Number(result.rowsAffected || 0) > 0;
}

export async function recordAfkMention(guildId: string, userId: string, messageUrl: string): Promise<void> {
    await getClient().execute({
        sql: 'UPDATE afk_status SET lastMentionUrl = ? WHERE guildId = ? AND userId = ?',
        args: [messageUrl, guildId, userId]
    });
}

export async function handleAfkMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const ownStatus = await getAfk(message.guild.id, message.author.id);
    if (ownStatus) {
        await clearAfk(message.guild.id, message.author.id);
        const mentionLink = ownStatus.lastMentionUrl
            ? ` You were mentioned or replied to here: [Open message](${ownStatus.lastMentionUrl})`
            : '';
        await message.reply(`✅ Welcome back! Your AFK status has been removed.${mentionLink}`).catch(() => undefined);
    }

    const mentionedUsers = new Map([...message.mentions.users.values()].map(user => [user.id, user]));
    if (message.reference?.messageId) {
        const referenced = await message.fetchReference().catch(() => null);
        if (referenced?.author) mentionedUsers.set(referenced.author.id, referenced.author);
    }
    const mentioned = [...mentionedUsers.values()]
        .filter(user => !user.bot && user.id !== message.author.id)
        .slice(0, 10);
    const statuses = await Promise.all(mentioned.map(async user => ({
        user,
        status: await getAfk(message.guild!.id, user.id)
    })));
    const active = statuses.filter(item => item.status);
    if (active.length) {
        const text = active.map(item => `💤 **${item.user.username}** is AFK: ${item.status!.reason}`).join('\n');
        await message.reply(text).catch(() => undefined);
        await Promise.all(active.map(item => recordAfkMention(message.guild!.id, item.user.id, message.url)));
    }
}