import { BaseModel, FieldSchema } from '../db/BaseModel';

export interface IUserLevel {
    _id: string;
    id: string;
    guildId: string;
    userId: string;
    xp: number;
    level: number;
    messageCount: number;
    voiceMinutes: number;
    lastMessageAt?: Date;
    dailyXp: number;
    weeklyXp: number;
    monthlyXp: number;
    periodUpdatedAt?: Date;
    save(): Promise<IUserLevel>;
}

export class UserLevel extends BaseModel implements IUserLevel {
    static table = 'user_levels';
    static fields: FieldSchema = {
        guildId: 'string',
        userId: 'string',
        xp: 'number',
        level: 'number',
        messageCount: 'number',
        voiceMinutes: 'number',
        lastMessageAt: 'date',
        dailyXp: 'number',
        weeklyXp: 'number',
        monthlyXp: 'number',
        periodUpdatedAt: 'date',
    };
    static defaults = {
        xp: 0,
        level: 0,
        messageCount: 0,
        voiceMinutes: 0,
        dailyXp: 0,
        weeklyXp: 0,
        monthlyXp: 0,
    };

    guildId!: string;
    userId!: string;
    xp!: number;
    level!: number;
    messageCount!: number;
    voiceMinutes!: number;
    dailyXp!: number;
    weeklyXp!: number;
    monthlyXp!: number;
    periodUpdatedAt?: Date;
    lastMessageAt?: Date;
}
