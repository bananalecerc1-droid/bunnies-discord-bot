import { Message } from 'discord.js';
import { EconomyAccount, EconomyTransaction } from '../models/EconomyAccount';

export interface EconomySettings {
    enabled: boolean;
    currencyName: string;
    currencyEmoji: string;
    accentColor: string;
    startingCash: number;
    dailyRewardEnabled: boolean;
    dailyRewardMin: number;
    dailyRewardMax: number;
    dailyCooldownHours: number;
    transfersEnabled: boolean;
    bumpRewardEnabled: boolean;
    bumpRewardMin: number;
    bumpRewardMax: number;
    bumpCooldownMinutes: number;
    disboardBotId: string;
    gameRewards: Record<string, { min: number; max: number }>;
}

export const DEFAULT_ECONOMY_SETTINGS: EconomySettings = {
    enabled: true,
    currencyName: 'Coins',
    currencyEmoji: '🪙',
    accentColor: '#8B5CF6',
    startingCash: 5000,
    dailyRewardEnabled: true,
    dailyRewardMin: 500,
    dailyRewardMax: 1500,
    dailyCooldownHours: 24,
    transfersEnabled: true,
    bumpRewardEnabled: true,
    bumpRewardMin: 100,
    bumpRewardMax: 500,
    bumpCooldownMinutes: 120,
    disboardBotId: '302050872383242240',
    gameRewards: {"colors": {"min": 25, "max": 250}, "emoji": {"min": 25, "max": 250}, "crash": {"min": 25, "max": 250}, "dice": {"min": 25, "max": 250}, "button": {"min": 25, "max": 250}, "challenge": {"min": 25, "max": 250}, "numbers": {"min": 25, "max": 250}, "xo": {"min": 25, "max": 250}, "guess": {"min": 250, "max": 250}, "wheel": {"min": 100, "max": 1000}, "letter": {"min": 25, "max": 250}, "connect": {"min": 25, "max": 250}, "match": {"min": 25, "max": 250}, "fruits": {"min": 25, "max": 250}, "roulette": {"min": 100, "max": 1000}, "hide": {"min": 25, "max": 250}, "risk": {"min": 25, "max": 250}, "pattern": {"min": 25, "max": 250}, "mystery": {"min": 25, "max": 250}},
};

export interface Stock {
    symbol: string;
    price: number;
    volatility: number;
    history: number[];
}

export interface PropertyDefinition {
    id: string;
    name: string;
    price: number;
    rent: number;
    type: string;
}

export const stockMarket: Record<string, Stock> = {
    'شركة التقنية': { symbol: 'TECH', price: 100, volatility: 0.15, history: [] },
    'شركة النفط': { symbol: 'OIL', price: 80, volatility: 0.12, history: [] },
    'شركة الذهب': { symbol: 'GOLD', price: 150, volatility: 0.1, history: [] },
    'شركة العقارات': { symbol: 'REAL', price: 200, volatility: 0.08, history: [] },
    'شركة العملات': { symbol: 'CRYPTO', price: 50, volatility: 0.3, history: [] },
    'شركة الأغذية': { symbol: 'FOOD', price: 60, volatility: 0.15, history: [] },
};

export const properties: PropertyDefinition[] = [
    { id: 'house1', name: 'شقة صغيرة', price: 5000, rent: 200, type: 'سكني' },
    { id: 'house2', name: 'شقة متوسطة', price: 15000, rent: 700, type: 'سكني' },
    { id: 'house3', name: 'فيلا فاخرة', price: 50000, rent: 2500, type: 'سكني' },
    { id: 'shop1', name: 'محل تجاري صغير', price: 20000, rent: 1000, type: 'تجاري' },
    { id: 'shop2', name: 'مركز تجاري', price: 80000, rent: 5000, type: 'تجاري' },
    { id: 'building1', name: 'برج مكاتب', price: 200000, rent: 15000, type: 'مكتبي' },
];

export function getEconomySettings(source?: any): EconomySettings {
    const raw = source?.settings?.economy || source?.economy || {};
    const numberOrDefault = (value: unknown, fallback: number): number =>
        typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    const minMax = (minValue: unknown, maxValue: unknown, fallbackMin: number, fallbackMax: number) => {
        const min = Math.max(0, Math.floor(numberOrDefault(minValue, fallbackMin)));
        const max = Math.max(min, Math.floor(numberOrDefault(maxValue, fallbackMax)));
        return { min, max };
    };
    const daily = minMax(raw.dailyRewardMin, raw.dailyRewardMax, DEFAULT_ECONOMY_SETTINGS.dailyRewardMin, DEFAULT_ECONOMY_SETTINGS.dailyRewardMax);
    const bump = minMax(raw.bumpRewardMin, raw.bumpRewardMax, DEFAULT_ECONOMY_SETTINGS.bumpRewardMin, DEFAULT_ECONOMY_SETTINGS.bumpRewardMax);
    const gameRewards = { ...DEFAULT_ECONOMY_SETTINGS.gameRewards };
    if (raw.gameRewards && typeof raw.gameRewards === 'object') {
        for (const key of Object.keys(gameRewards)) {
            const value = raw.gameRewards[key];
            if (value && typeof value === 'object') gameRewards[key] = minMax(value.min, value.max, gameRewards[key].min, gameRewards[key].max);
        }
    }

    return {
        enabled: raw.enabled !== false,
        currencyName: typeof raw.currencyName === 'string' && raw.currencyName.trim()
            ? raw.currencyName.trim().slice(0, 24)
            : DEFAULT_ECONOMY_SETTINGS.currencyName,
        currencyEmoji: typeof raw.currencyEmoji === 'string' && raw.currencyEmoji.trim()
            ? raw.currencyEmoji.trim().slice(0, 8)
            : DEFAULT_ECONOMY_SETTINGS.currencyEmoji,
        accentColor: typeof raw.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accentColor)
            ? raw.accentColor.toUpperCase()
            : DEFAULT_ECONOMY_SETTINGS.accentColor,
        startingCash: Math.max(0, Math.floor(numberOrDefault(raw.startingCash, DEFAULT_ECONOMY_SETTINGS.startingCash))),
        dailyRewardEnabled: raw.dailyRewardEnabled !== false,
        dailyRewardMin: daily.min,
        dailyRewardMax: daily.max,
        dailyCooldownHours: Math.max(1, numberOrDefault(raw.dailyCooldownHours, DEFAULT_ECONOMY_SETTINGS.dailyCooldownHours)),
        transfersEnabled: raw.transfersEnabled !== false,
        bumpRewardEnabled: raw.bumpRewardEnabled !== false,
        bumpRewardMin: bump.min,
        bumpRewardMax: bump.max,
        bumpCooldownMinutes: Math.max(1, numberOrDefault(raw.bumpCooldownMinutes, DEFAULT_ECONOMY_SETTINGS.bumpCooldownMinutes)),
        disboardBotId: typeof raw.disboardBotId === 'string' && /^\d{15,22}$/.test(raw.disboardBotId)
            ? raw.disboardBotId
            : DEFAULT_ECONOMY_SETTINGS.disboardBotId,
        gameRewards,
    };
}

export function formatMoney(amount: number, settings: EconomySettings = DEFAULT_ECONOMY_SETTINGS): string {
    return `${settings.currencyEmoji} ${Math.max(0, Math.floor(amount)).toLocaleString('en-US')} ${settings.currencyName}`;
}

export function updateStockPrices(): void {
    for (const stock of Object.values(stockMarket)) {
        const change = (Math.random() - 0.5) * 2 * stock.volatility;
        stock.price = Math.max(10, stock.price * (1 + change));
        stock.history.push(stock.price);
        if (stock.history.length > 100) stock.history.shift();
    }
}

export async function getEconomyAccount(
    guildId: string,
    userId: string,
    username: string,
    settings: EconomySettings = DEFAULT_ECONOMY_SETTINGS,
): Promise<EconomyAccount> {
    const existing = await EconomyAccount.findOne({ guildId, userId });
    if (existing) {
        if (existing.username !== username) {
            existing.username = username;
            await existing.save();
        }
        return existing;
    }

    return EconomyAccount.create({ guildId, userId, username, cash: settings.startingCash });
}

export function addExperience(account: EconomyAccount, amount: number): boolean {
    account.xp += amount;
    let leveledUp = false;

    while (account.xp >= account.xpNeeded) {
        account.xp -= account.xpNeeded;
        account.level += 1;
        account.xpNeeded = Math.floor(account.xpNeeded * 1.5);
        account.bankLimit += 10000;
        account.cash += 1000;
        leveledUp = true;
    }

    return leveledUp;
}

export function totalStockValue(account: EconomyAccount): number {
    return Object.values(account.stocks).reduce(
        (sum, holding) => sum + (holding.amount * (stockMarket[holding.company]?.price ?? 0)),
        0,
    );
}

export function totalPropertyValue(account: EconomyAccount): number {
    return account.properties.reduce((sum, property) => sum + property.price, 0);
}

export function totalWealth(account: EconomyAccount): number {
    return account.cash + account.bank + totalStockValue(account) + totalPropertyValue(account);
}

function transactionForBump(amount: number): EconomyTransaction {
    return { type: 'DISBOARD bump', amount, date: Date.now() };
}

const pendingBumps = new Map<string, { guildId: string; userId: string; createdAt: number }>();

function messageText(message: Message): string {
    const embedText = message.embeds
        .flatMap(embed => [
            embed.title,
            embed.description,
            ...embed.fields.map(field => `${field.name} ${field.value}`),
        ])
        .filter(Boolean)
        .join(' ');
    return `${message.content} ${embedText}`.toLowerCase();
}

function isBumpCommand(content: string, prefix: string): boolean {
    const commandText = content.startsWith(prefix) ? content.slice(prefix.length).trim() : content.trim();
    return /^(?:d(?:isboard)?\s+)?bump\b/i.test(commandText);
}

function isSuccessfulDisboardBump(content: string): boolean {
    return /\bbump\s+done\b|\bbump(?:ed)?\s+successfully\b|\bsuccessfully\s+bump/i.test(content);
}

export async function handleDisboardBump(message: Message, source: any, prefix: string): Promise<void> {
    const settings = getEconomySettings(source);
    if (!settings.enabled || !settings.bumpRewardEnabled || !message.guild) return;

    if (!message.author.bot) {
        if (isBumpCommand(message.content, prefix)) {
            pendingBumps.set(message.channelId, {
                guildId: message.guild.id,
                userId: message.author.id,
                createdAt: Date.now(),
            });
        }
        return;
    }

    if (message.author.id !== settings.disboardBotId || !isSuccessfulDisboardBump(messageText(message))) return;
    const pending = pendingBumps.get(message.channelId);
    pendingBumps.delete(message.channelId);
    if (!pending || pending.guildId !== message.guild.id || Date.now() - pending.createdAt > 60 * 1000) return;

    const account = await getEconomyAccount(message.guild.id, pending.userId, 'DISBOARD bumper', settings);
    const cooldowns = account.cooldowns || { rob: 0, daily: 0, work: 0, crime: 0, bump: 0 };
    const lastBump = cooldowns.bump || 0;
    if (Date.now() - lastBump < settings.bumpCooldownMinutes * 60 * 1000) return;

    const reward = Math.floor(Math.random() * (settings.bumpRewardMax - settings.bumpRewardMin + 1)) + settings.bumpRewardMin;
    account.cash += reward;
    account.stats.totalEarned += reward;
    account.cooldowns = { ...cooldowns, bump: Date.now() };
    account.transactions.push(transactionForBump(reward));
    if (account.transactions.length > 100) account.transactions.shift();
    await account.save();

    const member = await message.guild.members.fetch(pending.userId).catch(() => null);
    const mention = member ? `<@${pending.userId}>` : 'Bumper';
    const channel = message.channel;
    if ('send' in channel && typeof channel.send === 'function') {
        await channel.send(`🎉 ${mention} earned ${formatMoney(reward, settings)} for bumping the server!`).catch(() => undefined);
    }
}

updateStockPrices();
setInterval(updateStockPrices, 5 * 60 * 1000);