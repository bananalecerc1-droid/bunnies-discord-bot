import { getClient } from './turso';

/**
 * Table definitions for the bot's Turso (libSQL) database.
 * These replace the Mongoose schemas that used to live in src/models/*.
 *
 * Notes on encoding, since SQLite has no native array/boolean types:
 *  - booleans are stored as INTEGER 0/1
 *  - dates are stored as ISO-8601 TEXT strings
 *  - arrays (answers, winnerIds, participants) are stored as JSON TEXT
 */
const STATEMENTS: string[] = [
    `CREATE TABLE IF NOT EXISTS protected_role_members (guildId TEXT NOT NULL, roleId TEXT NOT NULL, userId TEXT NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY (guildId, roleId, userId))`,
    `CREATE INDEX IF NOT EXISTS idx_protected_role_members_role ON protected_role_members (guildId, roleId)`,
    `CREATE TABLE IF NOT EXISTS warnings (
        id TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        moderatorId TEXT,
        reason TEXT,
        timestamp TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings (guildId, userId)`,

    `CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        channelId TEXT NOT NULL,
        userId TEXT NOT NULL,
        section TEXT NOT NULL,
        panelId TEXT,
        ticketName TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        claimedBy TEXT,
        closedBy TEXT,
        createdAt TEXT NOT NULL,
        claimedAt TEXT,
        closedAt TEXT,
        transcriptUrl TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_guild_user ON tickets (guildId, userId)`,

    `CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        channelId TEXT NOT NULL,
        position TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        answers TEXT NOT NULL DEFAULT '[]',
        appliedAt TEXT NOT NULL,
        reviewedAt TEXT,
        reviewedBy TEXT,
        reviewNote TEXT,
        messageId TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status)`,

    `CREATE TABLE IF NOT EXISTS giveaways (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL UNIQUE,
        channelId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        hostId TEXT NOT NULL,
        prize TEXT NOT NULL,
        winners INTEGER NOT NULL,
        endsAt TEXT NOT NULL,
        ended INTEGER NOT NULL DEFAULT 0,
        winnerIds TEXT NOT NULL DEFAULT '[]',
        participants TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS user_levels (
        id TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 0,
        messageCount INTEGER NOT NULL DEFAULT 0,
        voiceMinutes INTEGER NOT NULL DEFAULT 0,
        lastMessageAt TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS server_activity (id TEXT PRIMARY KEY, guildId TEXT NOT NULL, bucketStart INTEGER NOT NULL, messageCount INTEGER NOT NULL DEFAULT 0, updatedAt TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_server_activity_guild_bucket ON server_activity (guildId, bucketStart)`,
    `CREATE INDEX IF NOT EXISTS idx_server_activity_bucket ON server_activity (bucketStart)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_levels_guild_user ON user_levels (guildId, userId)`,
    `CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp ON user_levels (guildId, xp DESC)`,

    `CREATE TABLE IF NOT EXISTS user_rank_backgrounds (id TEXT PRIMARY KEY, userId TEXT NOT NULL UNIQUE, data TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_rank_background_user ON user_rank_backgrounds (userId)`,
    `CREATE TABLE IF NOT EXISTS afk_status (
        id TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT 'AFK',
        setAt TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_afk_status_guild_user ON afk_status (guildId, userId)`,

    `CREATE TABLE IF NOT EXISTS economy_accounts (
        id TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        cash INTEGER NOT NULL DEFAULT 5000,
        bank INTEGER NOT NULL DEFAULT 0,
        bankLimit INTEGER NOT NULL DEFAULT 50000,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        xpNeeded INTEGER NOT NULL DEFAULT 100,
        cooldowns TEXT NOT NULL DEFAULT '{}',
        stocks TEXT NOT NULL DEFAULT '{}',
        properties TEXT NOT NULL DEFAULT '[]',
        stats TEXT NOT NULL DEFAULT '{}',
        transactions TEXT NOT NULL DEFAULT '[]'
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_economy_accounts_guild_user ON economy_accounts (guildId, userId)`,
    `CREATE INDEX IF NOT EXISTS idx_economy_accounts_guild_wealth ON economy_accounts (guildId, cash, bank)`,
];

/** Creates all tables/indexes if they don't already exist. Safe to call on every boot. */
export async function initSchema(): Promise<void> {
    const client = getClient();
    for (const alter of [
        'ALTER TABLE tickets ADD COLUMN panelId TEXT',
        'ALTER TABLE tickets ADD COLUMN ticketName TEXT',
        'ALTER TABLE tickets ADD COLUMN panelId TEXT',
        'ALTER TABLE tickets ADD COLUMN ticketName TEXT',
        'ALTER TABLE user_levels ADD COLUMN dailyXp INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE user_levels ADD COLUMN weeklyXp INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE user_levels ADD COLUMN monthlyXp INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE user_levels ADD COLUMN periodUpdatedAt TEXT'
    ]) {
        try { await client.execute(alter); } catch (error) { if (!String(error).toLowerCase().includes('duplicate column')) throw error; }
    }
    try { await client.execute('UPDATE user_levels SET dailyXp = 0 WHERE dailyXp IS NULL'); } catch (error) { console.error('[schema] XP period backfill failed:', error); }
    try { await client.execute('UPDATE user_levels SET weeklyXp = 0 WHERE weeklyXp IS NULL'); } catch (error) { console.error('[schema] XP period backfill failed:', error); }
    try { await client.execute('UPDATE user_levels SET monthlyXp = 0 WHERE monthlyXp IS NULL'); } catch (error) { console.error('[schema] XP period backfill failed:', error); }
    for (const sql of STATEMENTS) {
        await client.execute(sql);
    }
    try { await client.execute('ALTER TABLE protected_role_members ADD COLUMN roleName TEXT'); } catch (error) { if (!String(error).toLowerCase().includes('duplicate column')) throw error; }
    try {
        await client.execute('ALTER TABLE afk_status ADD COLUMN lastMentionUrl TEXT');
    } catch (error) {
        if (!String(error).toLowerCase().includes('duplicate column')) throw error;
    }
}
