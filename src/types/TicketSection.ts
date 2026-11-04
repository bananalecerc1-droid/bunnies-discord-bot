export interface TicketSection {
    name: string;
    nameAr: string;
    emoji: string;
    description: string;
    descriptionAr: string;
    enabled: boolean;
    categoryId: string;
    logChannelId: string;
    adminRoles: string[];
    cooldown: number;
    rules: string[];
    rulesAr: string[];
} 
