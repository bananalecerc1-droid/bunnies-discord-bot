export interface PositionRequirements {
    minimumAge: number; // In days
    minimumGuildAge: number;
    requiredRoles: string[];
    blacklistedRoles: string[];
}

export interface Reviewers {
    roles: string[];
}

export interface Position {
    name: string;
    emoji: string;
    color: string;
    enabled: boolean;
    description?: string;
    logChannel: string;
    reviewers: Reviewers;
    cooldown: number; // Hours
    questions: string[];
    requirements: PositionRequirements;
    acceptRoles?: string[]; // Array of role IDs to assign when accepted
    acceptMessage?: string; // Custom message to send when accepted
}

export interface GlobalRequirements {
    minimumAge?: number; // In days
    minimumGuildAge?: number;
} 
