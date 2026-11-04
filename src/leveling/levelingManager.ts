import {
    Message,
    VoiceState,
    EmbedBuilder,
    GuildMember,
    TextChannel,
    NewsChannel,
    ThreadChannel
} from 'discord.js';
import { UserLevel } from '../models/UserLevel';

export interface RoleReward {
    level: number;
    roleId: string;
}

export interface LevelingSettings {
    enabled: boolean;
    xpPerMessage: { min: number; max: number };
    messageCooldown: number; // ms
    xpPerVoiceMinute: number;
    ignoredChannels: string[];
    ignoredRoles: string[];
    levelUpMessage: {
        enabled: boolean;
        channelId: string; // empty = send in the channel where it happened
        content: string; // supports {user}, {mention}, {level}, {server}
    };
    roleRewards: RoleReward[];
    removeLowerRewards: boolean;
}

export const DEFAULT_LEVELING_SETTINGS: LevelingSettings = {
    enabled: false,
    xpPerMessage: { min: 15, max: 25 },
    messageCooldown: 60000,
    xpPerVoiceMinute: 10,
    ignoredChannels: [],
    ignoredRoles: [],
    levelUpMessage: {
        enabled: true,
        channelId: '',
        content: '🎉 {mention} just reached **Level {level}**!'
    },
    roleRewards: [],
    removeLowerRewards: false
};

// In-memory state (per process, resets on restart — acceptable for cooldowns/voice tracking)
const messageCooldowns = new Map<string, number>();
const voiceSessions = new Map<string, number>();

function key(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
}

/** XP required to go from `level` to `level + 1`. */
export function xpNeededForLevel(level: number): number {
    return 5 * level * level + 50 * level + 100;
}

/** Total accumulated XP -> current level. */
export function levelFromXp(xp: number): number {
    let level = 0;
    let remaining = xp;
    while (remaining >= xpNeededForLevel(level)) {
        remaining -= xpNeededForLevel(level);
        level++;
        if (level > 2000) break; // sanity guard
    }
    return level;
}

/** XP progress within the current level, and XP needed for the next one. */
export function levelProgress(xp: number): { level: number; currentLevelXp: number; neededXp: number } {
    let level = 0;
    let remaining = xp;
    while (remaining >= xpNeededForLevel(level)) {
        remaining -= xpNeededForLevel(level);
        level++;
        if (level > 2000) break;
    }
    return { level, currentLevelXp: remaining, neededXp: xpNeededForLevel(level) };
}

function getLevelingSettings(client: any): LevelingSettings {
    return { ...DEFAULT_LEVELING_SETTINGS, ...(client.settings?.leveling || {}) };
}

function formatMessage(template: string, member: GuildMember, level: number): string {
    return template
        .replace(/\{user\}/g, member.user.username)
        .replace(/\{mention\}/g, `<@${member.id}>`)
        .replace(/\{level\}/g, String(level))
        .replace(/\{server\}/g, member.guild.name);
}

async function applyRoleRewards(
    member: GuildMember,
    newLevel: number,
    config: LevelingSettings
): Promise<void> {
    if (!config.roleRewards?.length) return;

    const earned = config.roleRewards.filter(r => r.level <= newLevel);
    if (earned.length === 0) return;

    try {
        if (config.removeLowerRewards) {
            const highest = earned.reduce((a, b) => (a.level > b.level ? a : b));
            for (const reward of config.roleRewards) {
                const has = member.roles.cache.has(reward.roleId);
                if (reward.roleId === highest.roleId) {
                    if (!has) await member.roles.add(reward.roleId).catch(() => {});
                } else if (has) {
                    await member.roles.remove(reward.roleId).catch(() => {});
                }
            }
        } else {
            for (const reward of earned) {
                if (!member.roles.cache.has(reward.roleId)) {
                    await member.roles.add(reward.roleId).catch(() => {});
                }
            }
        }
    } catch (error) {
        console.error('[leveling] Error applying role rewards:', error);
    }
}

async function sendLevelUpMessage(
    member: GuildMember,
    newLevel: number,
    fallbackChannel: TextChannel | NewsChannel | ThreadChannel | null,
    config: LevelingSettings
): Promise<void> {
    if (!config.levelUpMessage?.enabled) return;

    const template = config.levelUpMessage.content || DEFAULT_LEVELING_SETTINGS.levelUpMessage.content;
    // Keep the member mention as regular message content, outside the embed.
    const mention = `<@${member.id}>`;
    const embedContent = formatMessage(template.replace(/\{mention\}/g, ''), member, newLevel).trim() || `Reached Level ${newLevel}!`;

    let target: any = fallbackChannel;
    if (config.levelUpMessage.channelId) {
        const channel = member.guild.channels.cache.get(config.levelUpMessage.channelId);
        if (channel && channel.isTextBased()) target = channel;
    }
    if (!target || !target.isTextBased?.()) return;

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(embedContent)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

    await target.send({ content: mention, embeds: [embed], allowedMentions: { users: [member.id] } }).catch((e: unknown) => console.error('[leveling] Failed to send level-up message:', e));
}

async function awardXp(
    client: any,
    member: GuildMember,
    amount: number,
    fallbackChannel: TextChannel | NewsChannel | ThreadChannel | null
): Promise<void> {
    const config = getLevelingSettings(client);
    if (config.ignoredRoles?.some((roleId: string) => member.roles.cache.has(roleId))) return;

    const doc = await UserLevel.findOneAndUpdate(
        { guildId: member.guild.id, userId: member.id },
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (!doc) return;

    const now = new Date();
    const previous = doc.periodUpdatedAt;
    const dayKey = now.toISOString().slice(0, 10);
    const weekKey = `${now.getUTCFullYear()}-${Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 1)) / 604800000)}`;
    const monthKey = now.toISOString().slice(0, 7);
    const previousDayKey = previous?.toISOString().slice(0, 10);
    const previousWeekKey = previous ? `${previous.getUTCFullYear()}-${Math.floor((Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth(), previous.getUTCDate()) - Date.UTC(previous.getUTCFullYear(), 0, 1)) / 604800000)}` : undefined;
    const previousMonthKey = previous?.toISOString().slice(0, 7);
    if (previousDayKey !== dayKey) doc.dailyXp = 0;
    if (previousWeekKey !== weekKey) doc.weeklyXp = 0;
    if (previousMonthKey !== monthKey) doc.monthlyXp = 0;
    const beforeLevel = levelFromXp(doc.xp);
    doc.xp += amount;
    doc.dailyXp += amount;
    doc.weeklyXp += amount;
    doc.monthlyXp += amount;
    doc.periodUpdatedAt = now;
    const afterLevel = levelFromXp(doc.xp);
    doc.level = afterLevel;
    await doc.save();

    if (afterLevel > beforeLevel) {
        await applyRoleRewards(member, afterLevel, config);
        await sendLevelUpMessage(member, afterLevel, fallbackChannel, config);
    }
}

/** Call from the messageCreate handler. */
export async function handleLevelingMessage(message: Message, client: any): Promise<void> {
    if (message.author.bot || !message.guild || !message.member) return;

    const config = getLevelingSettings(client);
    if (!config.enabled) return;

    if (config.ignoredChannels?.includes(message.channel.id)) return;
    if (config.ignoredRoles?.some(r => message.member!.roles.cache.has(r))) return;

    const cdKey = key(message.guild.id, message.author.id);
    const now = Date.now();
    const last = messageCooldowns.get(cdKey) || 0;
    if (now - last < config.messageCooldown) return;
    messageCooldowns.set(cdKey, now);

    const { min, max } = config.xpPerMessage;
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;

    const channel = message.channel.isTextBased() ? (message.channel as TextChannel) : null;
    await awardXp(client, message.member, amount, channel).catch(err =>
        console.error('[leveling] Error awarding message XP:', err)
    );
}

/** Call from the voiceStateUpdate handler. */
export async function handleLevelingVoiceState(oldState: VoiceState, newState: VoiceState, client: any): Promise<void> {
    const config = getLevelingSettings(client);
    if (!config.enabled || config.xpPerVoiceMinute <= 0) return;

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    if (getLevelingSettings(client).ignoredRoles?.some((roleId: string) => member.roles.cache.has(roleId))) {
        voiceSessions.delete(key((newState.guild || oldState.guild).id, member.id));
        return;
    }

    const guildId = (newState.guild || oldState.guild).id;
    const sessionKey = key(guildId, member.id);

    const wasIn = oldState.channelId;
    const isIn = newState.channelId;
    const wasEligible = !!wasIn && wasIn !== oldState.guild.afkChannelId && !oldState.selfDeaf && !oldState.deaf;
    const isEligible = !!isIn && isIn !== newState.guild.afkChannelId && !newState.selfDeaf && !newState.deaf;

    // Flush XP if we were tracking a session and something changed (left, muted/deafened, moved).
    const startedAt = voiceSessions.get(sessionKey);
    if (startedAt && (!isEligible || isIn !== wasIn)) {
        const minutes = (Date.now() - startedAt) / 60000;
        voiceSessions.delete(sessionKey);
        if (minutes >= 1) {
            const amount = Math.floor(minutes) * config.xpPerVoiceMinute;
            if (amount > 0) {
                await awardXp(client, member, amount, null).catch(err =>
                    console.error('[leveling] Error awarding voice XP:', err)
                );
            }
        }
    }

    // Start a new session if eligible and not already tracking one.
    if (isEligible && !voiceSessions.has(sessionKey)) {
        voiceSessions.set(sessionKey, Date.now());
    }

    void wasEligible;
}

export async function getGuildLeaderboard(guildId: string, limit = 10, period: 'all' | 'daily' | 'weekly' | 'monthly' = 'all') {
    const sortField = period === 'daily' ? 'dailyXp' : period === 'weekly' ? 'weeklyXp' : period === 'monthly' ? 'monthlyXp' : 'xp';
    return UserLevel.find({ guildId }).sort({ [sortField]: -1 }).limit(limit).lean();
}

export async function getUserRank(guildId: string, userId: string) {
    const doc = await UserLevel.findOne({ guildId, userId }).lean();
    if (!doc) return null;
    const rank = (await UserLevel.countDocuments({ guildId, xp: { $gt: doc.xp } })) + 1;
    return { ...doc, rank };
}
