export function isIgnorableDiscordStateError(error: unknown): boolean {
    const candidate = error as { code?: number; status?: number } | null;
    const code = candidate?.code ?? candidate?.status;
    return [10004, 10007, 10009, 50001, 50013].includes(Number(code));
}
