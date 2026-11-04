import { Client } from 'discord.js';
import { isIgnorableDiscordStateError } from './utils/discordErrors';

const PROTECTED_CHANNEL_ID = '1540727304513257492';
const PROTECTED_USER_ID = '1517621685745090633';
const REQUIRED_PERMISSIONS = {
    SendMessages: true,
    AttachFiles: true,
} as const;

let repairInFlight = false;
let staleProtectionTargetReported = false;

export async function ensureProtectedMediaPermissions(client: Client): Promise<void> {
    if (repairInFlight) return;
    repairInFlight = true;
    try {
        const channel = await client.channels.fetch(PROTECTED_CHANNEL_ID);
        if (!channel || !channel.isTextBased() || !('permissionOverwrites' in channel)) return;
        const guild = 'guild' in channel ? channel.guild : null;
        if (!guild) return;
        try {
            await guild.members.fetch(PROTECTED_USER_ID);
        } catch (error) {
            if (isIgnorableDiscordStateError(error)) {
                if (!staleProtectionTargetReported) {
                    console.warn(`[permission-guard] Skipping stale protected user ${PROTECTED_USER_ID}; the user is no longer in the guild.`);
                    staleProtectionTargetReported = true;
                }
                return;
            }
            throw error;
        }
        const overwrite = (channel as any).permissionOverwrites.cache.get(PROTECTED_USER_ID);
        const missing = !overwrite || !overwrite.allow.has('SendMessages') || !overwrite.allow.has('AttachFiles');
        if (missing) {
            await (channel as any).permissionOverwrites.edit(PROTECTED_USER_ID, REQUIRED_PERMISSIONS, {
                reason: 'Restore protected media permissions requested by server owner',
            });
            console.log(`[permission-guard] Restored SendMessages and AttachFiles for ${PROTECTED_USER_ID} in ${PROTECTED_CHANNEL_ID}`);
        }
    } catch (error) {
        if (isIgnorableDiscordStateError(error)) return;
        console.error('[permission-guard] Failed to restore media permissions:', error);
    } finally {
        repairInFlight = false;
    }
}

export function isProtectedPermissionChannel(channelId: string): boolean {
    return channelId === PROTECTED_CHANNEL_ID;
}
