import { createClient, Client } from '@libsql/client';
import config from '../../config';

let client: Client | null = null;

/**
 * Returns a lazily-created, shared Turso (libSQL) client.
 *
 * Configure the connection via `tursoUrl` / `tursoAuthToken` in config.ts,
 * or the TURSO_DATABASE_URL / TURSO_AUTH_TOKEN environment variables.
 *
 * `tursoUrl` also accepts a local file path (e.g. `file:local.db`) for
 * development without a hosted Turso database.
 */
export function getClient(): Client {
    if (client) return client;

    const url = config.tursoUrl || process.env.TURSO_DATABASE_URL;
    const authToken = config.tursoAuthToken || process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        throw new Error(
            'Turso database URL is not configured. Set "tursoUrl" in config.ts ' +
            '(or the TURSO_DATABASE_URL environment variable).'
        );
    }

    client = createClient({ url, authToken });
    return client;
}

/** Closes the shared client. Mainly useful for tests / graceful shutdown. */
export function closeClient(): void {
    if (client) {
        client.close();
        client = null;
    }
}
