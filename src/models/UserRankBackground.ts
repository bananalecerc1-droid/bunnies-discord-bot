import { BaseModel, FieldSchema } from '../db/BaseModel';

export interface IUserRankBackground {
    _id: string;
    id: string;
    userId: string;
    data: { base64: string };
    updatedAt: Date;
    save(): Promise<IUserRankBackground>;
}

export class UserRankBackground extends BaseModel implements IUserRankBackground {
    static table = 'user_rank_backgrounds';
    static fields: FieldSchema = {
        userId: 'string',
        data: 'json',
        updatedAt: 'date'
    };
    static defaults = {
        updatedAt: () => new Date()
    };
    userId!: string;
    data!: { base64: string };
    updatedAt!: Date;
}
