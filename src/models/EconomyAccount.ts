import { BaseModel, FieldSchema } from '../db/BaseModel';

export interface EconomyCooldowns {
    rob: number;
    daily: number;
    work: number;
    crime: number;
    bump: number;
}

export interface EconomyStockHolding {
    amount: number;
    avgPrice: number;
    company: string;
}

export interface EconomyProperty {
    id: string;
    name: string;
    price: number;
    rent: number;
    type: string;
    boughtAt: number;
    lastCollect: number;
}

export interface EconomyStats {
    totalEarned: number;
    totalRobs: number;
    successfulRobs: number;
    failedRobs: number;
    totalCrimes: number;
}

export interface EconomyTransaction {
    type: string;
    amount?: number;
    date: number;
    to?: string;
    from?: string;
    company?: string;
    price?: number;
    property?: string;
}

export class EconomyAccount extends BaseModel {
    static table = 'economy_accounts';
    static fields: FieldSchema = {
        guildId: 'string',
        userId: 'string',
        username: 'string',
        cash: 'number',
        bank: 'number',
        bankLimit: 'number',
        level: 'number',
        xp: 'number',
        xpNeeded: 'number',
        cooldowns: 'json',
        stocks: 'json',
        properties: 'json',
        stats: 'json',
        transactions: 'json',
    };
    static defaults = {
        cash: 5000,
        bank: 0,
        bankLimit: 50000,
        level: 1,
        xp: 0,
        xpNeeded: 100,
        cooldowns: () => ({ rob: 0, daily: 0, work: 0, crime: 0, bump: 0 }),
        stocks: () => ({}),
        properties: () => [],
        stats: () => ({
            totalEarned: 0,
            totalRobs: 0,
            successfulRobs: 0,
            failedRobs: 0,
            totalCrimes: 0,
        }),
        transactions: () => [],
    };

    guildId!: string;
    userId!: string;
    username!: string;
    cash!: number;
    bank!: number;
    bankLimit!: number;
    level!: number;
    xp!: number;
    xpNeeded!: number;
    cooldowns!: EconomyCooldowns;
    stocks!: Record<string, EconomyStockHolding>;
    properties!: EconomyProperty[];
    stats!: EconomyStats;
    transactions!: EconomyTransaction[];
}