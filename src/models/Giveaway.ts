import { BaseModel, FieldSchema } from '../db/BaseModel';

export interface IGiveaway {
    _id: string;
    id: string;
    messageId: string;
    channelId: string;
    guildId: string;
    hostId: string;
    prize: string;
    winners: number;
    endsAt: Date;
    ended: boolean;
    winnerIds: string[];
    participants: string[];
    createdAt: Date;
    save(): Promise<IGiveaway>;
}

export class Giveaway extends BaseModel implements IGiveaway {
    static table = 'giveaways';
    static fields: FieldSchema = {
        messageId: 'string',
        channelId: 'string',
        guildId: 'string',
        hostId: 'string',
        prize: 'string',
        winners: 'number',
        endsAt: 'date',
        ended: 'boolean',
        winnerIds: 'json',
        participants: 'json',
        createdAt: 'date',
    };
    static defaults = {
        ended: false,
        winnerIds: () => [],
        participants: () => [],
        createdAt: () => new Date(),
    };

    messageId!: string;
    channelId!: string;
    guildId!: string;
    hostId!: string;
    prize!: string;
    winners!: number;
    endsAt!: Date;
    ended!: boolean;
    winnerIds!: string[];
    participants!: string[];
    createdAt!: Date;
}
