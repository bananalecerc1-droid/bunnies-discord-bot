import { TextChannel, AttachmentBuilder } from 'discord.js';
import discordTranscripts from 'discord-html-transcripts';

export async function createTranscript(channel: TextChannel): Promise<AttachmentBuilder> {
    try {
        const transcript = await discordTranscripts.createTranscript(channel, {
            limit: -1, // Fetch all messages
            filename: `transcript-${channel.id}-${Date.now()}.html`,
            saveImages: true,
            poweredBy: false
        });

        return transcript;
    } catch (error) {
        console.error('Error creating transcript:', error);
        throw error;
    }
} 
