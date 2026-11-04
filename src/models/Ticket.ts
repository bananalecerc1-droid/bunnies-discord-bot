import { BaseModel, FieldSchema } from '../db/BaseModel';

export interface ITicket {
    _id: string;
    id: string;
    guildId: string;
    channelId: string;
    userId: string;
    section: string;
    panelId?: string;
    ticketName?: string;
    status: 'open' | 'claimed' | 'closed';
    claimedBy?: string;
    closedBy?: string;
    createdAt: Date;
    claimedAt?: Date;
    closedAt?: Date;
    transcriptUrl?: string;
    save(): Promise<ITicket>;
}

export class Ticket extends BaseModel implements ITicket {
    static table = 'tickets';
    static fields: FieldSchema = {
        guildId: 'string',
        channelId: 'string',
        userId: 'string',
        section: 'string',
        panelId: 'string',
        ticketName: 'string',
        status: 'string',
        claimedBy: 'string',
        closedBy: 'string',
        createdAt: 'date',
        claimedAt: 'date',
        closedAt: 'date',
        transcriptUrl: 'string',
    };
    static defaults = {
        status: 'open',
        createdAt: () => new Date(),
    };

    guildId!: string;
    channelId!: string;
    userId!: string;
    section!: string;
    panelId?: string;
    ticketName?: string;
    status!: 'open' | 'claimed' | 'closed';
    claimedBy?: string;
    closedBy?: string;
    createdAt!: Date;
    claimedAt?: Date;
    closedAt?: Date;
    transcriptUrl?: string;
}
