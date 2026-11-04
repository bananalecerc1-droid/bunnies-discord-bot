import { BaseModel, FieldSchema } from '../db/BaseModel';

export interface IWarning {
    _id: string;
    id: string;
    guildId: string;
    userId: string;
    moderatorId: string;
    reason: string;
    timestamp: Date;
    save(): Promise<IWarning>;
}

export class Warning extends BaseModel implements IWarning {
    static table = 'warnings';
    static fields: FieldSchema = {
        guildId: 'string',
        userId: 'string',
        moderatorId: 'string',
        reason: 'string',
        timestamp: 'date',
    };
    static defaults = {
        timestamp: () => new Date(),
    };

    guildId!: string;
    userId!: string;
    moderatorId!: string;
    reason!: string;
    timestamp!: Date;
}
