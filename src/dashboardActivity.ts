import { getClient } from './db/turso';

const HOUR_MS = 60 * 60 * 1000;

export async function recordServerMessage(guildId: string): Promise<void> {
    const bucketStart = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    try {
        const db = getClient();
        await db.execute({
            sql: `INSERT INTO server_activity (id, guildId, bucketStart, messageCount, updatedAt)
                 VALUES (?, ?, ?, 1, ?)
                 ON CONFLICT(guildId, bucketStart)
                 DO UPDATE SET messageCount = messageCount + 1, updatedAt = excluded.updatedAt`,
            args: [`${guildId}:${bucketStart}`, guildId, bucketStart, new Date().toISOString()]
        });
    } catch (error) {
        console.error('[activity] Failed to record message:', error);
    }
}

export async function getServerActivity(guildId?: string) {
    const nowHour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    const start = nowHour - (11 * HOUR_MS);
    const values = Array.from({ length: 12 }, (_, index) => {
        const timestamp = start + (index * HOUR_MS);
        return {
            timestamp,
            label: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            count: 0
        };
    });
    if (guildId) {
        try {
            const result = await getClient().execute({
                sql: 'SELECT bucketStart, messageCount FROM server_activity WHERE guildId = ? AND bucketStart BETWEEN ? AND ?',
                args: [guildId, start, nowHour]
            });
            const counts = new Map(result.rows.map(row => [Number(row.bucketStart), Number(row.messageCount)]));
            values.forEach(value => { value.count = counts.get(value.timestamp) || 0; });
        } catch (error) {
            console.error('[activity] Failed to load message activity:', error);
        }
    }
    const max = Math.max(1, ...values.map(value => value.count));
    return {
        buckets: values.map(value => ({ ...value, percentage: Math.max(6, Math.round((value.count / max) * 100)) })),
        total: values.reduce((sum, value) => sum + value.count, 0)
    };
}
