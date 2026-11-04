import { BaseModel, FieldSchema } from '../db/BaseModel';

export interface IApplication {
    _id: string;
    id: string;
    userId: string;
    guildId: string;
    channelId: string;
    position: string;
    status: 'pending' | 'accepted' | 'rejected';
    answers: string[];
    appliedAt: Date;
    reviewedAt?: Date;
    reviewedBy?: string;
    reviewNote?: string;
    messageId?: string;
    save(): Promise<IApplication>;
}

export class Application extends BaseModel implements IApplication {
    static table = 'applications';
    static fields: FieldSchema = {
        userId: 'string',
        guildId: 'string',
        channelId: 'string',
        position: 'string',
        status: 'string',
        answers: 'json',
        appliedAt: 'date',
        reviewedAt: 'date',
        reviewedBy: 'string',
        reviewNote: 'string',
        messageId: 'string',
    };
    static defaults = {
        status: 'pending',
        answers: () => [],
        appliedAt: () => new Date(),
    };

    userId!: string;
    guildId!: string;
    channelId!: string;
    position!: string;
    status!: 'pending' | 'accepted' | 'rejected';
    answers!: string[];
    appliedAt!: Date;
    reviewedAt?: Date;
    reviewedBy?: string;
    reviewNote?: string;
    messageId?: string;
}
