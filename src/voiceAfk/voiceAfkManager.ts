import { VoiceState } from 'discord.js';

interface VoiceAfkTimer {
    timer: NodeJS.Timeout;
    channelId: string;
}

const timers = new Map<string, VoiceAfkTimer>();

function key(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
}

function clearTimer(id: string): void {
    const current = timers.get(id);
    if (current) clearTimeout(current.timer);
    timers.delete(id);
}

export async function handleVoiceAfkState(oldState: VoiceState, newState: VoiceState, client: any): Promise<void> {
    const config = client.settings?.voiceAfk;
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const timerKey = key(member.guild.id, member.id);
    clearTimer(timerKey);
    if (!config?.enabled || !config.channelId || !newState.channelId) return;
    if (newState.channelId === config.channelId) return;
    if (!(newState.selfMute && newState.selfDeaf)) return;
    if ((config.exemptRoleIds || []).some((roleId: string) => member.roles.cache.has(roleId))) return;

    const timeoutMs = Math.max(1, Number(config.timeoutMinutes) || 5) * 60 * 1000;
    const timer = setTimeout(async () => {
        try {
            const current = member.voice;
            if (current.channelId && current.selfMute && current.selfDeaf && current.channelId !== config.channelId) {
                await member.voice.setChannel(config.channelId, 'Moved to the configured VC AFK channel');
            }
        } catch (error) {
            console.error('[voice-afk] Failed to move member:', error);
        } finally {
            timers.delete(timerKey);
        }
    }, timeoutMs);
    timers.set(timerKey, { timer, channelId: newState.channelId });
}