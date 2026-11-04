import { mkdir, unlink, readdir } from 'fs/promises';
import { join } from 'path';

const TRANSCRIPT_AGE_LIMIT = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function cleanupOldTranscripts(): Promise<void> {
    try {
        const transcriptsDir = join(process.cwd(), 'transcripts');
        await mkdir(transcriptsDir, { recursive: true });
        const files = await readdir(transcriptsDir);
        const now = Date.now();

        for (const file of files) {
            if (!file.endsWith('.html')) continue;

            const filePath = join(transcriptsDir, file);
            const timestamp = parseInt(file.split('-')[2]?.split('.')[0] || '0');

            if (now - timestamp > TRANSCRIPT_AGE_LIMIT) {
                await unlink(filePath).catch(console.error);
            }
        }
    } catch (error) {
        console.error('Error cleaning up transcripts:', error);
    }
}

export function startTranscriptCleanup(): void {
    setInterval(cleanupOldTranscripts, 24 * 60 * 60 * 1000);
    cleanupOldTranscripts().catch(console.error);
} 
