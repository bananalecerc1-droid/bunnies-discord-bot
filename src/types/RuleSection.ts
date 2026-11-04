export interface RuleSection {
    enabled: boolean;
    name: string;
    emoji: string;
    description: string;
    rules: string | string[];
    embed: {
        color: string;
        thumbnail?: {
            enabled: boolean;
            url: string;
        };
        image?: {
            enabled: boolean;
            url: string;
        };
        footer?: {
            text: string;
            iconUrl: string;
        };
    };
} 
