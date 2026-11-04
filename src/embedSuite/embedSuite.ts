import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client as DiscordClient,
    EmbedBuilder,
    GuildMember,
    Interaction,
    Message,
    MessageReaction,
    User,
    PartialMessageReaction,
    PartialUser,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import { getClient } from '../db/turso';

export interface EmbedButton {
    id: string;
    label: string;
    style?: keyof typeof ButtonStyle;
    color?: string;
    emoji?: string;
    url?: string;
    response?: {
        type?: 'message';
        text?: string;
        ephemeral?: boolean;
        format?: 'plain' | 'embed';
    };
}

interface EmbedSelectOption {
    id: string;
    label: string;
    description?: string;
    emoji?: string;
    response?: {
        type?: 'message' | 'role' | 'channel';
        text?: string;
        roleId?: string;
        channelId?: string;
        ephemeral?: boolean;
        format?: 'plain' | 'embed';
    };
}

interface EmbedSelectMenu {
    placeholder?: string;
    options: EmbedSelectOption[];
}

export interface ReactionRole {
    emoji: string;
    roleId: string;
}

export interface EmbedDefinition {
    content?: string;
    title?: string;
    description?: string;
    color?: string;
    url?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    footerText?: string;
    authorName?: string;
    authorIconUrl?: string;
    authorUrl?: string;
    timestamp?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    buttons?: EmbedButton[];
    selectMenu?: EmbedSelectMenu;
    reactionRoles?: ReactionRole[];
    reactionRoleMessageIds?: string[];
    updatedAt?: string;
    [key: string]: unknown;
}

export interface WelcomeSettings extends EmbedDefinition {
    enabled: boolean;
    channelId: string;
    mentionUser: boolean;
    menuEnabled: boolean;
    menuTitle: string;
    menuDescription: string;
    menuImageUrl: string;
    rulesText: string;
    rolesText: string;
    supportText: string;
}

interface PortableConfig {
    embeds: Record<string, EmbedDefinition>;
    welcome: WelcomeSettings;
    aliases: Record<string, string>;
}

const defaultWelcome: WelcomeSettings = {
    enabled: false,
    channelId: '',
    mentionUser: false,
    title: 'Welcome, {username}!',
    description: 'We are happy to have you in **{server}**.',
    color: '#777bc9',
    imageUrl: '',
    thumbnailUrl: '',
    footerText: '{memberCount} members',
    menuEnabled: true,
    menuTitle: 'Server Menu',
    menuDescription: 'Choose an option below.',
    menuImageUrl: '',
    rulesText: 'Please read the server rules.',
    rolesText: 'Choose your roles from the role channel.',
    supportText: 'Open a support ticket or contact the staff team.',
    buttons: []
};

const defaultConfig: PortableConfig = {
    embeds: {},
    welcome: defaultWelcome,
    aliases: {}
};

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeColor(value: unknown): string {
    const text = String(value || '').trim();
    return /^#?[0-9a-f]{6}$/i.test(text)
        ? (text.startsWith('#') ? text : `#${text}`)
        : '#777bc9';
}

function replaceVariables(value: unknown, variables: Record<string, unknown>): string {
    return String(value || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
        return variables[key] === undefined ? `{${key}}` : String(variables[key]);
    });
}

function mergeConfig(incoming: Partial<PortableConfig> | null | undefined): PortableConfig {
    const next = incoming || {};
    const welcome = {
        ...clone(defaultWelcome),
        ...(next.welcome || {})
    };
    if (!next.welcome?.color || String(next.welcome.color).toLowerCase() === '#2f8cff') {
        welcome.color = defaultWelcome.color;
    }
    welcome.mentionUser = welcome.mentionUser === true;
    if (!Array.isArray(welcome.buttons)) welcome.buttons = clone(defaultWelcome.buttons);

    return {
        embeds: { ...clone(defaultConfig.embeds), ...(next.embeds || {}) },
        welcome,
        aliases: { ...clone(defaultConfig.aliases), ...(next.aliases || {}) }
    };
}

function normalizeButton(button: EmbedButton, index: number): EmbedButton {
    const id = String(button?.id || `button-${index + 1}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
    const style = button?.style && button.style in ButtonStyle ? button.style : 'Primary';
    return {
        id: id || `button-${index + 1}`,
        label: String(button?.label || `Button ${index + 1}`).slice(0, 80),
        style,
        color: normalizeColor(button?.color || ''),
        emoji: button?.emoji ? String(button.emoji).slice(0, 32) : undefined,
        url: button?.url ? String(button.url).slice(0, 512) : undefined,
        response: button?.response
            ? {
                type: 'message',
                text: String(button.response.text || '').slice(0, 2000),
                ephemeral: button.response.ephemeral !== false,
                format: button.response.format === 'embed' ? 'embed' : 'plain'
            }
            : undefined
    };
}

function normalizeSelectMenu(value: unknown): EmbedSelectMenu | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const input = value as Partial<EmbedSelectMenu>;
    if (!Array.isArray(input.options)) return undefined;

    const options = input.options.slice(0, 10).map((option, index) => {
        const item = option || {};
        const id = String(item.id || `option-${index + 1}`)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-');
        const response = item.response;
        return {
            id: id || `option-${index + 1}`,
            label: String(item.label || `Option ${index + 1}`).slice(0, 100),
            description: item.description ? String(item.description).slice(0, 100) : undefined,
            emoji: item.emoji ? String(item.emoji).slice(0, 32) : undefined,
            response: response
                ? {
                     type: response.type === 'role'
                         ? 'role' as const
                         : response.type === 'channel'
                             ? 'channel' as const
                             : 'message' as const,
                    text: response.text ? String(response.text).slice(0, 2000) : undefined,
                    roleId: response.roleId ? String(response.roleId) : undefined,
                     channelId: response.channelId ? String(response.channelId) : undefined,
                    ephemeral: response.ephemeral !== false,
                    format: response.format === 'embed' ? 'embed' as const : 'plain' as const
                }
                : undefined
        };
    });

    return {
        placeholder: String(input.placeholder || 'Choose an option...').slice(0, 150),
        options
    };
}

function normalizeReactionRoles(value: unknown): ReactionRole[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 20).map(item => ({
        emoji: String(item?.emoji || '').trim().slice(0, 64),
        roleId: String(item?.roleId || '').trim()
    })).filter(item => item.emoji && item.roleId);
}

export class EmbedSuite {
    private initialized: Promise<void> | null = null;
    private cache: PortableConfig | null = null;

    constructor(
        private readonly client: DiscordClient,
        private readonly db = getClient()
    ) {}

    async init(): Promise<void> {
        if (!this.initialized) {
            this.initialized = this.db.execute(`
                CREATE TABLE IF NOT EXISTS portable_bot_config (
                    config_key TEXT PRIMARY KEY,
                    config_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `).then(() => undefined);
        }
        await this.initialized;
    }

    private async getConfig(): Promise<PortableConfig> {
        await this.init();
        if (this.cache) return clone(this.cache);

        const result = await this.db.execute({
            sql: 'SELECT config_json FROM portable_bot_config WHERE config_key = ?',
            args: ['main']
        });
        const raw = result.rows[0]?.config_json;
        let saved: Partial<PortableConfig> = {};
        if (raw) {
            try {
                saved = JSON.parse(String(raw)) as Partial<PortableConfig>;
            } catch (error) {
                console.error('[embed-suite] Invalid saved configuration:', error);
            }
        }
        this.cache = mergeConfig(saved);
        return clone(this.cache);
    }

    private async updateConfig(mutator: (config: PortableConfig) => PortableConfig): Promise<PortableConfig> {
        const next = mergeConfig(mutator(await this.getConfig()));
        this.cache = next;
        await this.db.execute({
            sql: `INSERT INTO portable_bot_config (config_key, config_json, updated_at)
                  VALUES (?, ?, ?)
                  ON CONFLICT(config_key) DO UPDATE SET
                    config_json = excluded.config_json,
                    updated_at = excluded.updated_at`,
            args: ['main', JSON.stringify(next), Date.now()]
        });
        return clone(next);
    }

    async listEmbeds(): Promise<Record<string, EmbedDefinition>> {
        return (await this.getConfig()).embeds;
    }

    async saveEmbed(name: string, definition: EmbedDefinition): Promise<EmbedDefinition> {
        const key = String(name || '').trim();
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(key)) {
            throw new Error('Embed name must use letters, numbers, _ or -');
        }
        if (!definition || typeof definition !== 'object') {
            throw new Error('Embed definition must be an object');
        }

        const saved = {
            ...definition,
            buttons: Array.isArray(definition.buttons)
                ? definition.buttons.slice(0, 25).map(normalizeButton)
                : [],
            selectMenu: normalizeSelectMenu(definition.selectMenu),
            reactionRoles: normalizeReactionRoles(definition.reactionRoles),
            reactionRoleMessageIds: Array.isArray(definition.reactionRoleMessageIds)
                ? definition.reactionRoleMessageIds.map(id => String(id)).slice(-20)
                : [],
            updatedAt: new Date().toISOString()
        };
        await this.updateConfig(config => ({
            ...config,
            embeds: { ...config.embeds, [key]: saved }
        }));
        return saved;
    }

    async removeEmbed(name: string): Promise<void> {
        await this.updateConfig(config => {
            const embeds = { ...config.embeds };
            delete embeds[String(name)];
            return { ...config, embeds };
        });
    }

    async getWelcomeSettings(): Promise<WelcomeSettings> {
        return (await this.getConfig()).welcome;
    }

    async saveWelcomeSettings(input: Partial<WelcomeSettings>): Promise<WelcomeSettings> {
        const nextColor = normalizeColor(input.color ?? (await this.getWelcomeSettings()).color);
        const nextImageUrl = input.menuImageUrl === undefined
            ? undefined
            : String(input.menuImageUrl || '').trim().slice(0, 512);
        if (nextImageUrl && !/^https?:\/\/\S+$/i.test(nextImageUrl)) {
            throw new Error('Embed image URL must start with http:// or https://');
        }

        const config = await this.updateConfig(current => ({
            ...current,
            welcome: {
                ...current.welcome,
                ...input,
                menuEnabled: true,
                color: nextColor,
                ...(nextImageUrl === undefined ? {} : { menuImageUrl: nextImageUrl }),
                buttons: Array.isArray(input.buttons)
                    ? input.buttons.slice(0, 25).map(normalizeButton)
                    : current.welcome.buttons,
                selectMenu: input.selectMenu
                    ? normalizeSelectMenu(input.selectMenu)
                    : (input.selectMenu === undefined ? current.welcome.selectMenu : undefined)
            }
        }));
        return config.welcome;
    }

    async listAliases(): Promise<Record<string, string>> {
        return (await this.getConfig()).aliases;
    }

    async saveAlias(alias: string, command: string): Promise<{ alias: string; command: string }> {
        const key = String(alias || '').trim().replace(/^[/!]/, '').toLowerCase();
        const target = String(command || '').trim().replace(/^[/!]/, '').toLowerCase();
        if (!/^[a-z0-9 _-]{1,64}$/i.test(key)) throw new Error('Alias contains invalid characters');
        if (!/^[a-z0-9_-]{1,64}$/i.test(target)) throw new Error('Command name is invalid');
        await this.updateConfig(config => ({
            ...config,
            aliases: { ...config.aliases, [key]: target }
        }));
        return { alias: key, command: target };
    }

    async removeAlias(alias: string): Promise<void> {
        await this.updateConfig(config => {
            const aliases = { ...config.aliases };
            delete aliases[String(alias).trim().replace(/^[/!]/, '').toLowerCase()];
            return { ...config, aliases };
        });
    }

    async resolveAlias(value: string): Promise<string | null> {
        const key = String(value || '').trim().replace(/^[/!]/, '').toLowerCase();
        return (await this.getConfig()).aliases[key] || null;
    }

    buildEmbedPayload(
        definition: EmbedDefinition,
        variables: Record<string, unknown> = {},
        buttonPrefix = 'portable_embed:',
        selectId?: string
    ): {
        content?: string;
        embeds: EmbedBuilder[];
        components?: Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>>;
    } {
        const embed = new EmbedBuilder()
            .setColor(normalizeColor(definition.color) as `#${string}`);
        const title = replaceVariables(definition.title || '', variables);
        if (title) embed.setTitle(title.slice(0, 256));
        const description = replaceVariables(definition.description || '', variables);
        if (description) embed.setDescription(description.slice(0, 4096));
        if (definition.url) embed.setURL(String(definition.url).slice(0, 512));
        if (definition.imageUrl) embed.setImage(String(definition.imageUrl).slice(0, 512));
        if (definition.thumbnailUrl) embed.setThumbnail(String(definition.thumbnailUrl).slice(0, 512));
        if (definition.footerText) {
            embed.setFooter({ text: replaceVariables(definition.footerText, variables).slice(0, 2048) });
        }
        if (definition.authorName) {
            embed.setAuthor({
                name: replaceVariables(definition.authorName, variables).slice(0, 256),
                iconURL: definition.authorIconUrl,
                url: definition.authorUrl
            });
        }
        if (definition.timestamp) embed.setTimestamp(new Date(definition.timestamp));
        if (Array.isArray(definition.fields)) {
            const fields = definition.fields
                .filter(field => field?.name && field?.value)
                .slice(0, 25)
                .map(field => ({
                    name: replaceVariables(field.name, variables).slice(0, 256),
                    value: replaceVariables(field.value, variables).slice(0, 1024),
                    inline: Boolean(field.inline)
                }));
            if (fields.length) embed.addFields(fields);
        }

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const buttons = Array.isArray(definition.buttons) ? definition.buttons : [];
        for (let index = 0; index < buttons.length; index += 5) {
            const row = new ActionRowBuilder<ButtonBuilder>();
            buttons.slice(index, index + 5).forEach((button, offset) => {
                const normalized = normalizeButton(button, index + offset);
                const builder = new ButtonBuilder().setLabel(normalized.label);
                if (normalized.url) {
                    builder.setStyle(ButtonStyle.Link).setURL(normalized.url);
                } else {
                    builder
                        .setStyle(ButtonStyle[normalized.style || 'Primary'])
                        .setCustomId(`${buttonPrefix}${normalized.id}`);
                }
                if (normalized.emoji) builder.setEmoji(normalized.emoji);
                row.addComponents(builder);
            });
            if (row.components.length) rows.push(row);
        }

        const components: Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> = rows;
        const selectMenu = normalizeSelectMenu(definition.selectMenu);
        if (selectMenu && selectMenu.options.length && selectId) {
            const menu = new StringSelectMenuBuilder()
                .setCustomId(selectId)
                .setPlaceholder(selectMenu.placeholder || 'Choose an option...')
                .setMinValues(1)
                .setMaxValues(1);

            selectMenu.options.forEach((option, index) => {
                const builder = new StringSelectMenuOptionBuilder()
                    .setValue(option.id || `option-${index + 1}`)
                    .setLabel(option.label || `Option ${index + 1}`);
                if (option.description) builder.setDescription(option.description);
                if (option.emoji) {
                    try {
                        builder.setEmoji(option.emoji);
                    } catch {
                        // Ignore invalid optional emoji values and keep the option usable.
                    }
                }
                menu.addOptions(builder);
            });

            components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
        }

        const payload: {
            content?: string;
            embeds: EmbedBuilder[];
            components?: Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>>;
        } = {
            embeds: [embed]
        };
        if (definition.content) payload.content = replaceVariables(definition.content, variables).slice(0, 2000);
        if (components.length) payload.components = components;
        return payload;
    }

    async sendEmbed(name: string, channelId: string, variables: Record<string, unknown> = {}): Promise<Message> {
        const definition = (await this.listEmbeds())[name];
        if (!definition) throw new Error(`Embed not found: ${name}`);
        const channel = await this.client.channels.fetch(channelId);
        if (!channel || !('send' in channel)) throw new Error('A Discord text channel is required');
        const message = await channel.send(this.buildEmbedPayload(definition, variables, `portable_embed:${name}:`, `portable_select:${name}`)) as Message;
        const reactionRoles = normalizeReactionRoles(definition.reactionRoles);
        for (const reactionRole of reactionRoles) {
            await message.react(reactionRole.emoji).catch(error =>
                console.error('[reaction-roles] Failed to add reaction:', error)
            );
        }
        if (reactionRoles.length) {
            await this.updateConfig(config => ({
                ...config,
                embeds: {
                    ...config.embeds,
                    [name]: {
                        ...config.embeds[name],
                        reactionRoleMessageIds: [
                            ...(config.embeds[name]?.reactionRoleMessageIds || []),
                            message.id
                        ].slice(-20)
                    }
                }
            }));
        }
        return message;
    }

    async handleReaction(
        reaction: MessageReaction | PartialMessageReaction,
        user: User | PartialUser,
        add: boolean
    ): Promise<boolean> {
        if (user.bot) return false;
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch {
                return false;
            }
        }
        const messageId = reaction.message.id;
        const config = await this.getConfig();
        const definition = Object.values(config.embeds).find(item =>
            Array.isArray(item.reactionRoleMessageIds) && item.reactionRoleMessageIds.includes(messageId)
        );
        if (!definition || !reaction.message.guild) return false;

        const emojiKey = reaction.emoji.id || reaction.emoji.name || '';
        const mapping = normalizeReactionRoles(definition.reactionRoles).find(item =>
            item.emoji === emojiKey || item.emoji === reaction.emoji.toString()
        );
        if (!mapping) return false;
        const role = reaction.message.guild.roles.cache.get(mapping.roleId);
        if (!role || role.managed || !role.editable) return false;
        const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
        if (!member) return false;
        if (add) await member.roles.add(role, 'Reaction role');
        else await member.roles.remove(role, 'Reaction role removed');
        return true;
    }

    async sendWelcome(member: GuildMember): Promise<Message | null> {
        const settings = await this.getWelcomeSettings();
        if (!settings.enabled || !settings.channelId) return null;
        const channel = await this.client.channels.fetch(settings.channelId);
        if (!channel ||
            (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
            throw new Error('Welcome channel is not a text channel');
        }
        const variables = {
            user: `<@${member.id}>`,
            username: member.user.globalName || member.user.username,
            server: member.guild.name,
            memberCount: member.guild.memberCount
        };
        const payload = this.buildEmbedPayload({
            ...settings,
            buttons: []
        }, variables, 'welcome_menu:');
        if (settings.mentionUser) payload.content = variables.user as string;
        const menu = this.buildEmbedPayload({
            title: settings.menuTitle,
            description: settings.menuDescription,
            color: settings.color,
            imageUrl: settings.menuImageUrl,
            buttons: [],
            selectMenu: settings.selectMenu
        }, variables, 'welcome_menu:', 'welcome_select');
        payload.components = menu.components;
        return channel.send(payload) as Promise<Message>;
    }

    async handleInteraction(interaction: Interaction): Promise<boolean> {
        if (interaction.isStringSelectMenu() && interaction.customId === 'welcome_select') {
            const settings = await this.getWelcomeSettings();
            const option = settings.selectMenu?.options.find(item => item.id === interaction.values[0]);
            if (!option) {
                await interaction.reply({ content: 'This menu option is no longer configured.', ephemeral: true });
                return true;
            }

            const message = replaceVariables(option.response?.text || `You selected **${option.label}**.`, {
                user: `<@${interaction.user.id}>`,
                username: interaction.user.globalName || interaction.user.username,
                server: interaction.guild?.name || 'Server',
                memberCount: interaction.guild?.memberCount || 0
            });
            if (option.response?.type === 'role' && option.response.roleId) {
                if (!interaction.guild) {
                    await interaction.reply({ content: 'Roles can only be assigned inside a server.', ephemeral: true });
                    return true;
                }
                const role = interaction.guild.roles.cache.get(option.response.roleId);
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (!role || role.managed || !role.editable) {
                    await interaction.reply({
                        content: 'I cannot manage that role. Make sure it is below my highest role and is not managed by an integration.',
                        ephemeral: true
                    });
                    return true;
                }
                const hasRole = member.roles.cache.has(role.id);
                if (hasRole) {
                    await member.roles.remove(role, 'Welcome dropdown role toggle');
                } else {
                    await member.roles.add(role, 'Welcome dropdown role toggle');
                }
                await interaction.reply({
                    content: hasRole ? `Removed the **${role.name}** role.` : `Added the **${role.name}** role.`,
                    ephemeral: true
                });
                return true;
            }
            if (option.response?.type === 'channel' && option.response.channelId) {
                await interaction.reply({ content: `Open this channel: <#${option.response.channelId}>`, ephemeral: true });
                return true;
            }
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(normalizeColor(settings.color) as `#${string}`)
                    .setTitle(option.label)
                    .setDescription(message)],
                ephemeral: option.response?.ephemeral !== false
            });
            return true;
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('portable_select:')) {
            const embedName = interaction.customId.slice('portable_select:'.length);
            const definition = (await this.getConfig()).embeds[embedName];
            const option = definition?.selectMenu?.options.find(item => item.id === interaction.values[0]);
            if (!option) {
                await interaction.reply({ content: 'This select menu option is no longer configured.', ephemeral: true });
                return true;
            }

            const response = option.response;
            if (response?.type === 'role' && response.roleId) {
                if (!interaction.guild) {
                    await interaction.reply({ content: 'Roles can only be assigned inside a server.', ephemeral: true });
                    return true;
                }

                const role = interaction.guild.roles.cache.get(response.roleId);
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (!role || role.managed || !role.editable) {
                    await interaction.reply({
                        content: 'I cannot manage that role. Make sure it is below my highest role and is not managed by an integration.',
                        ephemeral: true
                    });
                    return true;
                }

                const hasRole = member.roles.cache.has(role.id);
                if (hasRole) {
                    await member.roles.remove(role, 'Embed select menu role toggle');
                } else {
                    await member.roles.add(role, 'Embed select menu role toggle');
                }

                const fallback = hasRole ? `Removed the ${role.name} role.` : `Added the ${role.name} role.`;
                const message = replaceVariables(response.text || fallback, {
                    role: role.name,
                    user: `<@${interaction.user.id}>`,
                    username: interaction.user.globalName || interaction.user.username,
                    server: interaction.guild.name,
                    memberCount: interaction.guild.memberCount
                });
                await interaction.reply({
                    ...(response.format === 'embed'
                        ? { embeds: [new EmbedBuilder().setColor(normalizeColor(definition?.color) as `#${string}`).setDescription(message)] }
                        : { content: message }),
                    ephemeral: response.ephemeral !== false
                });
                return true;
            }

            const message = replaceVariables(response?.text || 'Your selection was received.', {
                user: `<@${interaction.user.id}>`,
                username: interaction.user.globalName || interaction.user.username,
                server: interaction.guild?.name || 'Server',
                memberCount: interaction.guild?.memberCount || 0
            });
            await interaction.reply({
                ...(response?.format === 'embed'
                    ? { embeds: [new EmbedBuilder().setColor(normalizeColor(definition?.color) as `#${string}`).setDescription(message)] }
                    : { content: message }),
                ephemeral: response?.ephemeral !== false
            });
            return true;
        }

        if (!interaction.isButton()) return false;
        if (interaction.customId.startsWith('welcome_menu:')) {
            const settings = await this.getWelcomeSettings();
            const id = interaction.customId.slice('welcome_menu:'.length);
            const configuredButton = settings.buttons?.find(button => button.id === id);
            const responses: Record<string, [string, string]> = {
                rules: ['Rules', configuredButton?.response?.text || settings.rulesText],
                roles: ['Roles', configuredButton?.response?.text || settings.rolesText],
                support: ['Support', configuredButton?.response?.text || settings.supportText],
                'server-info': [
                    'Server Info',
                    `Server: **${interaction.guild?.name || 'Server'}**\nMembers: **${interaction.guild?.memberCount || '—'}**`
                ]
            };
            const response = responses[id] || ['Menu', 'This menu option is not configured yet.'];
            await interaction.reply({
                embeds: [new EmbedBuilder().setColor(normalizeColor(settings.color) as `#${string}`).setTitle(response[0]).setDescription(response[1])],
                ephemeral: true
            });
            return true;
        }
        if (interaction.customId.startsWith('portable_embed:')) {
            const suffix = interaction.customId.slice('portable_embed:'.length);
            const parts = suffix.split(':');
            const embedName = parts.length > 1 ? parts[0] : '';
            const buttonId = parts.length > 1 ? parts.slice(1).join(':') : suffix;
            const config = await this.getConfig();
            const definition = embedName ? config.embeds[embedName] : undefined;
            const button = definition?.buttons?.find(item => item.id === buttonId)
                || Object.values(config.embeds).flatMap(item => item.buttons || []).find(item => item.id === buttonId);
            const response = button?.response;
            const message = replaceVariables(response?.text || 'This embed button is configured and ready for a custom action.', {
                user: `<@${interaction.user.id}>`,
                username: interaction.user.globalName || interaction.user.username,
                server: interaction.guild?.name || 'Server',
                memberCount: interaction.guild?.memberCount || 0
            });
            await interaction.reply({
                ...(response?.format === 'embed'
                    ? { embeds: [new EmbedBuilder().setColor(normalizeColor(definition?.color) as `#${string}`).setDescription(message)] }
                    : { content: message }),
                ephemeral: response?.ephemeral !== false
            });
            return true;
        }
        return false;
    }
}