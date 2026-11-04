import {
    VoiceConnection,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
    joinVoiceChannel
} from '@discordjs/voice';
import { Client, GuildBasedChannel } from 'discord.js';

let reconnectTimer: NodeJS.Timeout | null = null;
let reconnecting = false;

function scheduleReconnect(client: Client): void {
    if (reconnectTimer || reconnecting) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connectToAfkChannel(client);
    }, 5000);
}

function attachConnectionHandlers(client: Client, connection: VoiceConnection): void {
    connection.on('stateChange', (oldState, newState) => {
        console.log(`[voice-afk] State ${oldState.status} -> ${newState.status}`);
    });
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await entersState(connection, VoiceConnectionStatus.Connecting, 5_000);
        } catch {
            connection.destroy();
            scheduleReconnect(client);
        }
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => scheduleReconnect(client));
    connection.on('error', error => {
        console.error('[voice-afk] Voice connection error:', error.message);
        connection.destroy();
        scheduleReconnect(client);
    });
}

export async function connectToAfkChannel(client: Client): Promise<void> {
    if (reconnecting || !client.isReady()) return;
    const settings = (client as any).settings?.voiceAfk;
    const channelId = settings?.permanentChannelId || settings?.channelId;
    if (!settings?.enabled || !channelId || !client.user) return;
    console.log(`[voice-afk] Attempting connection to ${channelId}`);

    reconnecting = true;
    let retry = false;
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null) as GuildBasedChannel | null;
        if (!channel || !channel.isVoiceBased() || !channel.guild) {
            console.error(`[voice-afk] Channel ${channelId} was not found or is not a voice channel.`);
            return;
        }
        const guild = channel.guild;
        const currentChannelId = guild.members.me?.voice.channelId;
        const existing = getVoiceConnection(guild.id);
        if (currentChannelId === channelId && existing) return;
        existing?.destroy();
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });
        attachConnectionHandlers(client, connection);
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        console.log(`[voice-afk] Connected to ${channel.name} (${channel.id})`);
    } catch (error) {
        console.error('[voice-afk] Unable to connect:', error instanceof Error ? error.message : error);
        retry = true;
    } finally {
        reconnecting = false;
        if (retry) scheduleReconnect(client);
    }
}

export function keepAfkVoiceConnected(client: Client): void {
    void connectToAfkChannel(client);
}
