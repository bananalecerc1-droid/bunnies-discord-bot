import express, { Request, Response } from 'express';
import path from 'path';
import { ModBot } from '../src/types/ModBot';
import config from '../config';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import expressLayouts from 'express-ejs-layouts';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import cookieParser from 'cookie-parser';
import { EmbedSuite, EmbedDefinition, WelcomeSettings } from '../src/embedSuite/embedSuite';
import { syncTagRolesForGuild } from '../src/tagRoles/tagRoleManager';
import { getServerActivity } from '../src/dashboardActivity';

interface CommandSettings {
    enabled: boolean;
    aliases: string[];
    cooldown: number;
    permissions: {
        enabledRoleIds: string[];
        disabledRoleIds: string[];
    };
    [key: string]: any;
}

export class Dashboard {
    private app: express.Application;
    private locales: { [key: string]: any } = {};
    private startTime: Date;

    constructor(private client: ModBot, private embedSuite: EmbedSuite) {
        this.app = express();
        this.startTime = new Date();
        this.loadLocales();
        this.setup();
        this.routes();
    }

    private loadLocales(): void {
        try {
            const localesPath = path.join(__dirname, 'locales');
            this.locales = {
                en: JSON.parse(readFileSync(path.join(localesPath, 'en.json'), 'utf-8')),
                ar: JSON.parse(readFileSync(path.join(localesPath, 'ar.json'), 'utf-8'))
            };
        } catch (error) {
            console.error('Error loading dashboard locales:', error);
        }
    }

    private getLocale(lang: string = 'en'): any {
        return this.locales[lang] || this.locales['en'];
    }

    private getUptime(): string {
        const now = new Date();
        const diff = now.getTime() - this.startTime.getTime();
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    private getPing(): number {
        return Math.round(this.client.ws.ping);
    }

    private getBreadcrumbs(path: string): string {
        const parts = path.split('/').filter(Boolean);
        if (parts.length === 0) return 'Dashboard';
        
        return parts.map((part, index) => {
            const isLast = index === parts.length - 1;
            const formattedPart = part.charAt(0).toUpperCase() + part.slice(1);
            return isLast ? formattedPart : `${formattedPart} /`;
        }).join(' ');
    }

    private setup(): void {
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, 'views'));
        
        this.app.use(expressLayouts);
        this.app.set('layout', 'layouts/main');
        this.app.set('layout extractScripts', true);
        this.app.set('layout extractStyles', true);

        this.app.use((req: Request, res: Response, next) => {
            res.locals = {
                ...res.locals,
                locale: this.getLocale(res.locals.currentLang),
                path: req.path,
                currentLang: res.locals.currentLang || 'en',
                title: 'Dashboard',
                    renderPartial: (name: string, extraLocals: Record<string, unknown> = {}) => {
                    try {
                        const partialPath = path.join(__dirname, 'views', 'partials', `${name}.ejs`);
                        return require('ejs').render(
                            require('fs').readFileSync(partialPath, 'utf8'),
                                { ...res.locals, ...extraLocals }
                        );
                    } catch (error) {
                        console.error(`Error rendering partial ${name}:`, error);
                        return `<div class="error">Error loading ${name}</div>`;
                    }
                }
            };
            next();
        });
        
        this.app.use(express.static(path.join(__dirname, 'public')));

        this.app.use((req: Request, res: Response, next) => {
            res.locals.path = req.path;
            next();
        });

        const isProduction = process.env.NODE_ENV === 'production';
        
        this.app.use(express.json());
        this.app.use(cookieParser());

        this.app.use((req: Request, res: Response, next) => {
            const lang = (req.query.lang as string) || 
                        req.cookies?.preferredLanguage || 
                        'en';
            
            const validLang = ['en', 'ar'].includes(lang) ? lang : 'en';
            
            res.cookie('preferredLanguage', validLang, {
                maxAge: 365 * 24 * 60 * 60 * 1000,
                httpOnly: false,
                path: '/',
                secure: isProduction
            });
            
            res.locals.locale = this.getLocale(validLang);
            res.locals.currentLang = validLang;
            res.setHeader('Content-Language', validLang);
            next();
        });

        this.app.use((req: Request, res: Response, next) => {
            res.locals.ping = this.getPing();
            res.locals.uptime = this.getUptime();
            res.locals.path = req.path;
            res.locals.breadcrumbs = this.getBreadcrumbs(req.path);
            next();
        });

    }

    private routes(): void {
        this.app.get('/', async (_req: Request, res: Response) => {
            const currentLang = res.locals.currentLang || 'en';
            const locale = this.getLocale(currentLang);
            
            try {
                const stats = await this.generateDashboardStats();

                const moduleStatus = this.getModuleStatus();
                
                const recentActivity = await this.getRecentActivity();

                const trends = {
                    servers: { percentage: 5, direction: 'up', period: 'week' },
                    users: { percentage: 12, direction: 'up', period: 'month' },
                    commands: { percentage: 8, direction: 'up', period: 'day' }
                };

                return res.render('index', {
                    title: locale.dashboard.title,
                    stats,
                    trends,
                    moduleStatus,
                    recentActivity,
                    settings: this.client.settings,
                    client: this.client,
                    config,
                    path: '/',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/')
                });
            } catch (error) {
                console.error('Error rendering index page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale
                });
            }
        });

        this.app.get('/embeds', async (_req: Request, res: Response) => {
            try {
                return res.render('embeds', {
                    title: 'Embed Studio',
                    embeds: await this.embedSuite.listEmbeds(),
                    settings: this.client.settings,
                    client: this.client,
                    config,
                    path: '/embeds',
                    currentLang: res.locals.currentLang || 'en',
                    locale: this.getLocale(res.locals.currentLang || 'en'),
                    breadcrumbs: this.getBreadcrumbs('/embeds')
                });
            } catch (error) {
                console.error('Error rendering embed studio:', error);
                return res.status(500).render('error', {
                    title: 'Embed Studio',
                    error: { code: 500, message: 'Unable to load Embed Studio' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });

        this.app.get('/welcome', async (_req: Request, res: Response) => {
            try {
                return res.render('welcome-system', {
                    title: 'Welcome System',
                    welcome: await this.embedSuite.getWelcomeSettings(),
                    settings: this.client.settings,
                    client: this.client,
                    config,
                    path: '/welcome',
                    currentLang: res.locals.currentLang || 'en',
                    locale: this.getLocale(res.locals.currentLang || 'en'),
                    breadcrumbs: this.getBreadcrumbs('/welcome')
                });
            } catch (error) {
                console.error('Error rendering welcome system:', error);
                return res.status(500).render('error', {
                    title: 'Welcome System',
                    error: { code: 500, message: 'Unable to load Welcome System' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });

        this.app.get('/api/embeds', async (_req: Request, res: Response) => {
            try {
                return res.json({ ok: true, embeds: await this.embedSuite.listEmbeds() });
            } catch (error) {
                return res.status(500).json({ ok: false, error: 'Unable to load embeds' });
            }
        });

        this.app.post('/api/embeds/:name', async (req: Request, res: Response) => {
            try {
                const embed = await this.embedSuite.saveEmbed(req.params.name, req.body as EmbedDefinition);
                return res.json({ ok: true, embed });
            } catch (error) {
                return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Unable to save embed' });
            }
        });

        this.app.delete('/api/embeds/:name', async (req: Request, res: Response) => {
            try {
                await this.embedSuite.removeEmbed(req.params.name);
                return res.json({ ok: true });
            } catch (error) {
                return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Unable to delete embed' });
            }
        });

        this.app.post('/api/embeds/:name/send', async (req: Request, res: Response) => {
            try {
                const message = await this.embedSuite.sendEmbed(
                    req.params.name,
                    String(req.body?.channelId || ''),
                    req.body?.variables || {}
                );
                return res.json({ ok: true, messageId: message.id, channelId: message.channelId });
            } catch (error) {
                return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Unable to send embed' });
            }
        });

        this.app.get('/api/welcome-embed', async (_req: Request, res: Response) => {
            try {
                return res.json({ ok: true, welcome: await this.embedSuite.getWelcomeSettings() });
            } catch (error) {
                return res.status(500).json({ ok: false, error: 'Unable to load welcome settings' });
            }
        });

        this.app.get('/api/welcome-targets', async (_req: Request, res: Response) => {
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId) || this.client.guilds.cache.first();
                if (!guild) return res.json({ ok: true, guild: null, channels: [], roles: [] });

                const channels = guild.channels.cache
                    .filter((channel: any) =>
                        !channel.isThread?.() &&
                        (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
                    )
                    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
                    .map((channel: any) => ({
                        id: channel.id,
                        name: channel.name,
                        type: channel.type
                    }));
                const roles = guild.roles.cache
                    .filter((role: any) => role.id !== guild.id && !role.managed)
                    .sort((a: any, b: any) => b.position - a.position)
                    .map((role: any) => ({
                        id: role.id,
                        name: role.name,
                        color: role.hexColor
                    }));

                return res.json({
                    ok: true,
                    guild: { id: guild.id, name: guild.name },
                    channels,
                    roles
                });
            } catch (error) {
                console.error('Error loading welcome targets:', error);
                return res.status(500).json({ ok: false, error: 'Unable to load Discord channels and roles' });
            }
        });

        this.app.post('/api/welcome-embed', async (req: Request, res: Response) => {
            try {
                const input = req.body as Partial<WelcomeSettings>;
                if (input.enabled) {
                    const guild = this.client.guilds.cache.get(config.mainGuildId) || this.client.guilds.cache.first();
                    const channel = guild?.channels.cache.get(String(input.channelId || ''));
                    if (!channel ||
                        (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
                        return res.status(400).json({ ok: false, error: 'Choose a text channel for welcome messages.' });
                    }
                }
                const welcome = await this.embedSuite.saveWelcomeSettings(input);
                return res.json({ ok: true, welcome });
            } catch (error) {
                return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Unable to save welcome settings' });
            }
        });

        this.app.get('/api/aliases', async (_req: Request, res: Response) => {
            try {
                return res.json({ ok: true, aliases: await this.embedSuite.listAliases() });
            } catch (error) {
                return res.status(500).json({ ok: false, error: 'Unable to load aliases' });
            }
        });

        this.app.post('/api/aliases', async (req: Request, res: Response) => {
            try {
                const result = await this.embedSuite.saveAlias(req.body?.alias, req.body?.command);
                return res.json({ ok: true, ...result });
            } catch (error) {
                return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Unable to save alias' });
            }
        });

        this.app.delete('/api/aliases/:alias', async (req: Request, res: Response) => {
            try {
                await this.embedSuite.removeAlias(req.params.alias);
                return res.json({ ok: true });
            } catch (error) {
                return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Unable to delete alias' });
            }
        });

        this.app.get('/docs', (_req: Request, res: Response) => {
            try {
                const currentLang = res.locals.currentLang || 'en';
                const locale = this.getLocale(currentLang);
                
                return res.render('docs', {
                    page: 'docs',
                    title: locale.docs.title || 'Documentation',
                    settings: this.client.settings,
                    client: this.client,
                    config,
                    path: '/docs',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/docs')
                });
            } catch (error) {
                console.error('Error rendering documentation page:', error);
                return res.status(500).render('error', { 
                    page: 'error',
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en'),
                    path: '/docs'
                });
            }
        });

        this.app.get('/settings', async (_req: Request, res: Response) => {
            const currentLang = res.locals.currentLang || 'en';
            const locale = this.getLocale(currentLang);
            
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                const roles = guild
                    ? guild.roles.cache
                        .filter(role => role.id !== guild.id)
                        .sort((a, b) => b.position - a.position)
                        .map(role => ({ id: role.id, name: role.name, position: role.position }))
                    : [];
                return res.render('settings', {
                    title: locale.dashboard.settings?.title || 'Bot Settings',
                    settings: this.client.settings,
                    roles,
                    client: this.client,
                    config,
                    path: '/settings',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/settings')
                });
            } catch (error) {
                console.error('Error rendering settings page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale
                });
            }
        });

        this.app.get('/economy', async (_req: Request, res: Response) => {
            const currentLang = res.locals.currentLang || 'en';
            const locale = this.getLocale(currentLang);

            try {
                return res.render('economy', {
                    title: locale.dashboard.economy?.title || 'Economy Settings',
                    settings: this.client.settings,
                    path: '/economy',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/economy')
                });
            } catch (error) {
                console.error('Error rendering economy page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/economy'
                });
            }
        });

        this.app.get('/commands', (_req: Request, res: Response) => {
            const currentLang = res.locals.currentLang || 'en';
            const locale = this.getLocale(currentLang);
            
            const categories = [
                { 
                    id: 'general',
                    name: locale.dashboard.commands.general,
                    icon: 'users',
                    color: 'blue'
                },
                {
                    id: 'moderation',
                    name: locale.dashboard.commands.moderation,
                    icon: 'shield-alt',
                    color: 'purple'
                },
                {
                    id: 'utility',
                    name: locale.dashboard.commands.utility || 'Utility',
                    icon: 'tools',
                    color: 'green'
                }
            ];
            
            res.render('command-categories', {
                title: locale.dashboard.commands.title,
                categories,
                path: '/commands',
                currentLang,
                locale,
                breadcrumbs: this.getBreadcrumbs('/commands')
            });
        });

        this.app.get('/commands/general', (_req: Request, res: Response) => {
            const generalCommands = ['avatar', 'banner', 'ping', 'roles', 'server', 'user'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));

            res.render('commands', {
                title: res.locals.locale.dashboard.commands.general,
                page: 'general',
                commands: generalCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });

        this.app.get('/commands/moderation', (_req: Request, res: Response) => {
            const modCommands = ['ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn', 'clear', 'lock', 'unlock', 'hide', 'unhide', 'move', 'timeout', 'rtimeout'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));

            res.render('commands', {
                title: res.locals.locale.dashboard.commands.moderation,
                page: 'moderation',
                commands: modCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });

        this.app.get('/commands/utility', (_req: Request, res: Response) => {
            const utilityCommands = ['setnick', 'role', 'rrole', 'warns', 'apply', 'ticket', 'unban', 'setlevel', 'rank', 'steal', 'setbg', 'resetbg', 'leaderboard'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));

            res.render('commands', {
                title: res.locals.locale.dashboard.commands.utility || 'Utility Commands',
                page: 'utility',
                commands: utilityCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });

        this.app.post('/api/commands/toggle', async (req: Request, res: Response): Promise<Response> => {
            try {
                const { command, enabled } = req.body;
                console.log('Toggling command:', command, enabled);

                if (!command) {
                    return res.status(400).json({ error: 'Command name is required' });
                }

                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.commands[command]) {
                    currentSettings.commands[command] = {
                        enabled: enabled,
                        aliases: [],
                        cooldown: 5,
                        permissions: {
                            enabledRoleIds: [],
                            disabledRoleIds: []
                        }
                    };
                } else {
                    currentSettings.commands[command].enabled = enabled;
                }

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                
                this.client.settings = currentSettings;

                const verifySettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                console.log('Verified settings update:', {
                    command,
                    enabled: verifySettings.commands[command].enabled,
                    fileContent: verifySettings.commands[command]
                });

                return res.json({ 
                    success: true, 
                    command, 
                    enabled,
                    settings: verifySettings.commands[command]
                });
            } catch (error) {
                console.error('Error toggling command:', error);
                return res.status(500).json({ error: 'Failed to toggle command' });
            }
        });

        this.app.get('/api/commands/:command/permissions', (req: Request, res: Response): Response | void => {
            try {
                const command = req.params.command;
                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }

                const permissions = this.client.settings.commands[command]?.permissions ?? {
                    enabledRoleIds: [],
                    disabledRoleIds: []
                };
                
                return res.json(permissions);
            } catch (error) {
                console.error('Error getting permissions:', error);
                return res.status(500).json({ error: 'Failed to get permissions' });
            }
        });

        this.app.post('/api/commands/:command/permissions', async (req: Request, res: Response): Promise<Response | void> => {
            try {
                const { command } = req.params;
                const { enabledRoleIds, disabledRoleIds } = req.body;

                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }

                this.client.settings.commands[command].permissions = {
                    enabledRoleIds,
                    disabledRoleIds
                };

                await this.saveSettings();
                
                return res.json({ success: true });
            } catch (error) {
                console.error('Error updating permissions:', error);
                return res.status(500).json({ error: 'Failed to update permissions' });
            }
        });

        this.app.post('/api/commands/:command/update', async (req: Request, res: Response): Promise<Response> => {
            try {
                const { command } = req.params;
                const settings = req.body;

                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }

                this.client.settings.commands[command] = {
                    ...this.client.settings.commands[command],
                    ...settings
                };

                await this.saveSettings();
                
                return res.json({ success: true });
            } catch (error) {
                console.error('Error updating command settings:', error);
                return res.status(500).json({ error: 'Failed to update command settings' });
            }
        });

        this.app.get('/api/roles', async (_req: Request, res: Response) => {
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }

                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id) // Exclude @everyone
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                        id: role.id,
                        name: role.name,
                        color: role.color,
                        position: role.position
                    }));

                return res.json(roles);
            } catch (error) {
                console.error('Error fetching roles:', error);
                return res.status(500).json({ error: 'Failed to fetch roles' });
            }
        });

        this.app.get('/api/commands/:command/settings', async (req: Request, res: Response) => {
            try {
                const { command } = req.params;
                const settingsPath = join(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }

                return res.json(currentSettings.commands[command]);
            } catch (error) {
                console.error('Error fetching command settings:', error);
                return res.status(500).json({ error: 'Failed to fetch command settings' });
            }
        });

        this.app.post('/api/commands/:command/settings', async (req: Request, res: Response) => {
            try {
                const { command } = req.params;
                const { aliases, permissions } = req.body;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }

                currentSettings.commands[command] = {
                    ...currentSettings.commands[command],
                    aliases: Array.isArray(aliases) ? [...new Set(aliases.map((alias: unknown) => String(alias).trim().toLowerCase()).filter(Boolean))] : [],
                    permissions: {
                        enabledRoleIds: permissions?.enabledRoleIds || [],
                        disabledRoleIds: permissions?.disabledRoleIds || []
                    }
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.commands[command]
                });
            } catch (error) {
                console.error('Error saving command settings:', error);
                return res.status(500).json({ error: 'Failed to save command settings' });
            }
        });

        this.app.get('/api/channels', async (_req: Request, res: Response) => {
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }

                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0) // TextChannel
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name,
                        type: channel.type
                    }));

                return res.json(channels);
            } catch (error) {
                console.error('Error fetching channels:', error);
                return res.status(500).json({ error: 'Failed to fetch channels' });
            }
        });

        this.app.get('/logs', (_req: Request, res: Response) => {
            const currentLang = res.locals.currentLang || 'en';
            const locale = this.getLocale(currentLang);
            
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/logs'
                    });
                }

                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0) // TextChannel
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    }));

                return res.render('logs', {
                    title: locale.dashboard.logs.title,
                    settings: { ...(this.client.settings as any), ticketPanels: ensureTicketPanels() },
                    channels,
                    roles: guild.roles.cache.filter(role => role.id !== guild.id).sort((a, b) => b.position - a.position).map(role => ({ id: role.id, name: role.name, color: role.hexColor })),
                    path: '/logs',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/logs')
                });
            } catch (error) {
                console.error('Error rendering logs page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/logs'
                });
            }
        });

        this.app.post('/api/asset-import/settings', async (req: Request, res: Response): Promise<Response> => {
            try {
                const body = req.body || {};
                const next = {
                    enabled: body.enabled !== false,
                    emojiChannelId: typeof body.emojiChannelId === 'string' ? body.emojiChannelId.trim() : '',
                    stickerChannelId: typeof body.stickerChannelId === 'string' ? body.stickerChannelId.trim() : '',
                    logBypassRoleIds: Array.isArray(body.logBypassRoleIds) ? body.logBypassRoleIds.filter((id: unknown) => typeof id === 'string' && id.trim()).map((id: string) => id.trim()) : []
                };
                const settingsPath = join(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                currentSettings.assetImport = next;
                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({ success: true, settings: next });
            } catch (error) {
                console.error('Error updating asset import settings:', error);
                return res.status(500).json({ error: 'Failed to update asset import settings' });
            }
        });

        this.app.post('/api/logs/update', async (req: Request, res: Response): Promise<Response> => {
            try {
                const { logType, settings } = req.body;

                if (!logType || !settings) {
                    return res.status(400).json({ error: 'Missing required parameters' });
                }

                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.logs[logType]) {
                    return res.status(404).json({ error: 'Log type not found' });
                }

                currentSettings.logs[logType] = {
                    ...currentSettings.logs[logType],
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.logs[logType]
                });
            } catch (error) {
                console.error('Error updating log settings:', error);
                return res.status(500).json({ error: 'Failed to update log settings' });
            }
        });

        this.app.get('/protection', async (_req: Request, res: Response) => {
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }

                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0) // TextChannel
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    }));

                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id) // Exclude @everyone
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                        id: role.id,
                        name: role.name,
                        color: role.hexColor
                    }));

                res.render('protection', {
                    title: res.locals.locale.dashboard.protection.title,
                    settings: this.client.settings,
                    channels: channels,
                    roles: roles,
                    path: '/protection'
                });
            } catch (error) {
                console.error('Error rendering protection page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });

        this.app.post('/api/protection/settings', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.protection = {
                    ...currentSettings.protection,
                    ...settings,
                    role: {
                        ...currentSettings.protection?.role,
                        ...settings.role,
                        action: {
                            ...currentSettings.protection?.role?.action,
                            ...settings.role?.action,
                            protectedRoles: Array.isArray(settings.role?.action?.protectedRoles)
                                ? [...new Set(settings.role.action.protectedRoles.filter((id: any) => typeof id === 'string' && id.trim()).map((id: string) => id.trim()))]
                                : (Array.isArray(currentSettings.protection?.role?.action?.protectedRoles) ? currentSettings.protection.role.action.protectedRoles : [])
                        }
                    }
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ success: true });
            } catch (error) {
                console.error('Error saving protection settings:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to save protection settings' 
                });
            }
        });

        this.app.post('/api/protection/update', async (req: Request, res: Response) => {
            try {
                const { section, settings } = req.body;
                
                if (!section || !settings) {
                    return res.status(400).json({ error: 'Missing required parameters' });
                }

                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.protection) {
                    currentSettings.protection = {};
                }
                if (!currentSettings.protection[section]) {
                    currentSettings.protection[section] = {};
                }

                currentSettings.protection[section] = {
                    ...currentSettings.protection[section],
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.protection[section]
                });
            } catch (error) {
                console.error('Error updating protection settings:', error);
                return res.status(500).json({ error: 'Failed to update protection settings' });
            }
        });

        const ensureTicketPanels = (): any[] => {
            const settings: any = this.client.settings as any;
            if (!Array.isArray(settings.ticketPanels)) {
                const sections = Array.isArray(settings.ticket?.sections) ? settings.ticket.sections : [];
                settings.ticketPanels = sections.map((section: any, index: number) => ({
                    id: `section-${index}`,
                    name: section.name || `Panel ${index + 1}`,
                    embedTitle: settings.ticket?.embed?.footer || '🎫 فتح تكت',
                    embedDescription: section.description || 'اضغط على الزر أدناه لفتح تذكرة.',
                    embedColor: settings.ticket?.embed?.color || '#5865F2',
                    embedImage: section.imageUrl || '',
                    panelChannelId: '',
                    staffRoleId: section.adminRoles?.[0] || '',
                    logChannelId: section.logChannelId || '',
                    welcomeMessage: '',
                    buttons: [{ label: `${section.emoji || '🎫'} ${section.name || 'فتح تكت'}`, ticketName: 'support', style: 'Primary', categoryId: section.categoryId || '', emoji: '' }],
                }));
                const settingsPath = join(process.cwd(), 'settings.json');
                writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8');
            }
            return settings.ticketPanels;
        };

        this.app.get('/tickets', async (_req: Request, res: Response) => {
            const currentLang = res.locals.currentLang || 'en';
            const locale = this.getLocale(currentLang);
            
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/tickets'
                    });
                }

                const channels = guild.channels.cache
                    .filter(channel => channel.type === ChannelType.GuildText)
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    }));

                const categories = guild.channels.cache
                    .filter(channel => channel.type === ChannelType.GuildCategory)
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    }));

                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                        id: role.id,
                        name: role.name,
                        color: role.hexColor || '#ffffff'
                    }));

                return res.render('tickets', {
                    title: locale.dashboard.tickets.title,
                    settings: this.client.settings,
                    channels,
                    categories,
                    roles,
                    path: '/tickets',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/tickets')
                });
            } catch (error) {
                console.error('Error rendering tickets page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/tickets'
                });
            }
        });

        this.app.get('/api/ticket-panels', async (_req: Request, res: Response) => {
            try { return res.json(ensureTicketPanels()); }
            catch (error) { console.error('[ticket-panels:get]', error); return res.status(500).json([]); }
        });

        this.app.post('/api/ticket-panels', async (req: Request, res: Response) => {
            try {
                const panels = ensureTicketPanels();
                const body: any = req.body || {};
                const id = String(body.id || `panel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
                const entry = {
                    id, name: String(body.name || 'Unnamed panel').slice(0, 80),
                    embedTitle: String(body.embedTitle || '').slice(0, 256),
                    embedDescription: String(body.embedDescription || '').slice(0, 4096),
                    embedColor: String(body.embedColor || '#5865F2'),
                    embedImage: String(body.embedImage || ''), panelChannelId: String(body.panelChannelId || ''), defaultCategoryId: String(body.defaultCategoryId || ''),
                    staffRoleId: String(body.staffRoleId || ''), logChannelId: String(body.logChannelId || ''),
                    welcomeMessage: String(body.welcomeMessage || '').slice(0, 2000),
                    selectMenus: (Array.isArray(body.selectMenus) ? body.selectMenus : []).slice(0, 5).map((menu: any) => ({ placeholder: String(menu.placeholder || 'اختر نوع التذكرة').slice(0, 150), options: (Array.isArray(menu.options) ? menu.options : []).slice(0, 25).map((option: any) => ({ label: String(option.label || option.value || 'خيار').slice(0, 100), value: String(option.value || option.label || 'option').slice(0, 100), description: String(option.description || '').slice(0, 100), emoji: String(option.emoji || ''), ticketName: String(option.ticketName || option.value || 'support').slice(0, 40), categoryId: String(option.categoryId || ''), mentionRoleIds: Array.isArray(option.mentionRoleIds) ? option.mentionRoleIds.slice(0, 10).map((id: any) => String(id)).filter((id: string) => /^\d{17,20}$/.test(id)) : [] })) })),
                    buttons: (Array.isArray(body.buttons) ? body.buttons : []).slice(0, 25).map((button: any) => ({
                        label: String(button.label || '🎫 فتح تكت').slice(0, 80), ticketName: String(button.ticketName || 'support').slice(0, 40),
                        style: ['Primary','Secondary','Success','Danger'].includes(button.style) ? button.style : 'Primary',
                        categoryId: String(button.categoryId || ''), emoji: String(button.emoji || ''), mentionRoleIds: Array.isArray(button.mentionRoleIds) ? button.mentionRoleIds.slice(0, 10).map((id: any) => String(id)).filter((id: string) => /^\d{17,20}$/.test(id)) : [],
                    })),
                };
                const index = panels.findIndex((panel: any) => panel.id === id);
                if (index >= 0) panels[index] = entry; else panels.push(entry);
                const settingsPath = join(process.cwd(), 'settings.json');
                const settings: any = this.client.settings as any; settings.ticketPanels = panels;
                writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8'); this.client.settings = settings;
                return res.json({ ok: true, id, panel: entry, panels });
            } catch (error) { console.error('[ticket-panels:save]', error); return res.status(500).json({ ok: false, error: 'Failed to save ticket panel' }); }
        });

        this.app.delete('/api/ticket-panels/:id', async (req: Request, res: Response) => {
            try {
                const panels = ensureTicketPanels().filter((panel: any) => panel.id !== req.params.id);
                const settings: any = this.client.settings as any; settings.ticketPanels = panels;
                writeFileSync(join(process.cwd(), 'settings.json'), JSON.stringify(settings, null, 4), 'utf8'); this.client.settings = settings;
                return res.json({ ok: true, panels });
            } catch (error) { console.error('[ticket-panels:delete]', error); return res.status(500).json({ ok: false, error: 'Failed to delete ticket panel' }); }
        });

        this.app.post('/api/ticket-panels/:id/send', async (req: Request, res: Response) => {
            try {
                const panel = ensureTicketPanels().find((item: any) => item.id === req.params.id);
                if (!panel) return res.status(404).json({ ok: false, error: 'Panel not found' });
                if (!panel.panelChannelId) return res.status(400).json({ ok: false, error: 'Select a panel channel first' });
                const channel: any = await this.client.channels.fetch(panel.panelChannelId);
                if (!channel?.isTextBased()) return res.status(400).json({ ok: false, error: 'Invalid panel channel' });
                const embed = new EmbedBuilder().setColor(panel.embedColor || '#5865F2');
                if (panel.embedTitle) embed.setTitle(panel.embedTitle);
                if (panel.embedDescription) embed.setDescription(panel.embedDescription);
                if (panel.embedImage) embed.setImage(panel.embedImage);
                const rows: any[] = [];
                for (let mi = 0; mi < (panel.selectMenus || []).length && mi < 5; mi++) { const menu = panel.selectMenus[mi]; const select = new StringSelectMenuBuilder().setCustomId(`ticket_select_${panel.id}:${mi}`).setPlaceholder(menu.placeholder || 'اختر نوع التذكرة').addOptions((menu.options || []).map((o: any) => ({ label: o.label, value: o.value, description: o.description || undefined, emoji: o.emoji || undefined }))); rows.push(new ActionRowBuilder<any>().addComponents(select)); }
                const styleMap: any = { Primary: ButtonStyle.Primary, Secondary: ButtonStyle.Secondary, Success: ButtonStyle.Success, Danger: ButtonStyle.Danger };
                for (let i = 0; i < panel.buttons.length; i += 5) {
                    const row = new ActionRowBuilder<ButtonBuilder>();
                    panel.buttons.slice(i, i + 5).forEach((button: any, offset: number) => {
                        const builder = new ButtonBuilder().setCustomId(`ticket_open_${panel.id}:${i + offset}`).setLabel(button.label || '🎫 فتح تكت').setStyle(styleMap[button.style] || ButtonStyle.Primary);
                        if (button.emoji) builder.setEmoji(button.emoji); row.addComponents(builder);
                    }); rows.push(row);
                }
                await channel.send({ embeds: [embed], components: rows });
                return res.json({ ok: true });
            } catch (error) { console.error('[ticket-panels:send]', error); return res.status(500).json({ ok: false, error: 'Failed to send ticket panel' }); }
        });

        this.app.post('/api/tickets/settings', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                
                if (settings.embed) {
                    if (settings.embed.thumbnail === '') settings.embed.thumbnail = null;
                    if (settings.embed.footerIcon === '') settings.embed.footerIcon = null;
                }
                
                if (settings.sections && Array.isArray(settings.sections)) {
                    settings.sections.forEach((section: any) => {
                        if (section.imageUrl === '') section.imageUrl = null;
                    });
                }
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.ticket = {
                    ...currentSettings.ticket,
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.ticket
                });
            } catch (error) {
                console.error('Error saving ticket settings:', error);
                return res.status(500).json({ error: 'Failed to save ticket settings' });
            }
        });

        this.app.get('/api/tickets/:section/settings', async (req: Request, res: Response) => {
            try {
                const { section } = req.params;
                const settingsPath = join(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.ticket.sections[section]) {
                    return res.status(404).json({ error: 'Section not found' });
                }

                return res.json(currentSettings.ticket.sections[section]);
            } catch (error) {
                console.error('Error fetching ticket section settings:', error);
                return res.status(500).json({ error: 'Failed to fetch section settings' });
            }
        });

        this.app.post('/api/tickets/:section/settings', async (req: Request, res: Response) => {
            try {
                const { section } = req.params;
                const settings = req.body;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.ticket.sections[section]) {
                    return res.status(404).json({ error: 'Section not found' });
                }

                currentSettings.ticket.sections[section] = {
                    ...currentSettings.ticket.sections[section],
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.ticket.sections[section]
                });
            } catch (error) {
                console.error('Error updating ticket section settings:', error);
                return res.status(500).json({ error: 'Failed to update section settings' });
            }
        });

        this.app.post('/api/tickets/sections/add', async (req: Request, res: Response) => {
            try {
                const newSection = req.body;
                
                if (newSection.imageUrl === '') {
                    newSection.imageUrl = null;
                }
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.ticket.sections.push(newSection);

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    section: newSection
                });
            } catch (error) {
                console.error('Error adding ticket section:', error);
                return res.status(500).json({ error: 'Failed to add ticket section' });
            }
        });

        this.app.delete('/api/tickets/sections/:index', async (req: Request, res: Response) => {
            try {
                const { index } = req.params;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.ticket.sections[index]) {
                    return res.status(404).json({ error: 'Section not found' });
                }

                currentSettings.ticket.sections.splice(parseInt(index), 1);

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ success: true });
            } catch (error) {
                console.error('Error deleting ticket section:', error);
                return res.status(500).json({ error: 'Failed to delete ticket section' });
            }
        });

        this.app.get('/apply', async (_req: Request, res: Response) => {
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }

                const channels = guild.channels.cache
                    .filter(channel => channel.type === ChannelType.GuildText)
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    }));

                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                        id: role.id,
                        name: role.name,
                        color: role.hexColor,
                        position: role.position
                    }));

                res.render('apply', {
                    title: res.locals.locale.dashboard.apply.title,
                    settings: this.client.settings,
                    channels,
                    roles,
                    path: '/apply'
                });
            } catch (error) {
                console.error('Error rendering apply page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });

        this.app.get('/api/apply/settings', async (_req: Request, res: Response) => {
            try {
                const settingsPath = join(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                return res.json(currentSettings.apply || {
                    enabled: false,
                    embed: {
                        color: "#3498db",
                        thumbnail: "",
                        footer: "",
                        footerIcon: "",
                        timestamp: true
                    },
                    positions: []
                });
            } catch (error) {
                console.error('Error fetching apply settings:', error);
                return res.status(500).json({ error: 'Failed to fetch apply settings' });
            }
        });

        this.app.post('/api/apply/settings', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.apply = {
                    ...currentSettings.apply,
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.apply
                });
            } catch (error) {
                console.error('Error saving apply settings:', error);
                return res.status(500).json({ error: 'Failed to save apply settings' });
            }
        });

        this.app.delete('/api/apply/positions/:index', async (req: Request, res: Response) => {
            try {
                const { index } = req.params;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.apply?.positions[index]) {
                    return res.status(404).json({ error: 'Position not found' });
                }

                currentSettings.apply.positions.splice(parseInt(index), 1);

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ success: true });
            } catch (error) {
                console.error('Error deleting position:', error);
                return res.status(500).json({ error: 'Failed to delete position' });
            }
        });

        this.app.post('/api/apply/positions/add', async (req: Request, res: Response) => {
            try {
                const newPosition = req.body;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.apply) {
                    currentSettings.apply = {
                        enabled: false,
                        embed: {
                            color: "#3498db",
                            thumbnail: "",
                            footer: "",
                            footerIcon: "",
                            timestamp: true
                        },
                        positions: []
                    };
                }

                currentSettings.apply.positions.push(newPosition);

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    position: newPosition
                });
            } catch (error) {
                console.error('Error adding position:', error);
                return res.status(500).json({ error: 'Failed to add position' });
            }
        });

        this.app.get('/rules', async (_req: Request, res: Response) => {
            try {
                res.render('rules', {
                    title: res.locals.locale.dashboard.rules.title,
                    settings: this.client.settings,
                    path: '/rules',
                    script: `<script>
                        window.settings = ${JSON.stringify(this.client.settings)};
                        console.log('Settings loaded:', window.settings);
                    </script>`
                });
            } catch (error) {
                console.error('Error rendering rules page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });

        this.app.post('/api/rules/settings', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.rules = {
                    ...currentSettings.rules,
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.rules
                });
            } catch (error) {
                console.error('Error saving rules settings:', error);
                return res.status(500).json({ error: 'Failed to save rules settings' });
            }
        });

        this.app.get('/giveaway', async (_req: Request, res: Response) => {
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }

                const channels = guild.channels.cache
                    .filter(channel => channel.type === ChannelType.GuildText)
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    }));

                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                        id: role.id,
                        name: role.name,
                        color: role.hexColor
                    }));

                res.render('giveaway', {
                    title: res.locals.locale.dashboard.giveaway.title,
                    settings: this.client.settings,
                    channels,
                    roles,
                    path: '/giveaway'
                });
            } catch (error) {
                console.error('Error rendering giveaway page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });

        this.app.post('/api/giveaway/settings', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.giveaway = {
                    ...currentSettings.giveaway,
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.giveaway
                });
            } catch (error) {
                console.error('Error saving giveaway settings:', error);
                return res.status(500).json({ error: 'Failed to save giveaway settings' });
            }
        });

        this.app.get('/tempchannels', async (_req: Request, res: Response) => {
            const currentLang = res.locals.currentLang || 'en';
            const locale = this.getLocale(currentLang);
            
            try {
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/tempchannels'
                    });
                }

                const channels = guild.channels.cache
                    .filter(channel => channel.type === ChannelType.GuildVoice)
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    }));

                const categories = guild.channels.cache
                    .filter(channel => channel.type === ChannelType.GuildCategory)
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    }));

                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                        id: role.id,
                        name: role.name,
                        color: role.hexColor || '#ffffff'
                    }));

                return res.render('tempChannels', {
                    title: locale.dashboard.tempChannels.title,
                    settings: this.client.settings,
                    channels,
                    categories,
                    roles,
                    path: '/tempchannels',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/tempchannels')
                });
            } catch (error) {
                console.error('Error rendering temp channels page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/tempchannels'
                });
            }
        });

        this.app.post('/api/tempchannels/settings', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.tempChannels = {
                    ...currentSettings.tempChannels,
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.tempChannels
                });
            } catch (error) {
                console.error('Error saving temp channels settings:', error);
                return res.status(500).json({ error: 'Failed to save temp channels settings' });
            }
        });

        this.app.get('/autoreply', async (_req: Request, res: Response) => {
            try {
                const settings = JSON.parse(readFileSync(join(process.cwd(), 'settings.json'), 'utf8'));
                
                res.render('autoReply', {
                    title: res.locals.locale.dashboard.autoReply.title,
                    settings,
                    path: '/autoreply',
                    locale: res.locals.locale,
                    currentLang: res.locals.currentLang || 'en',
                    script: `<script>window.settings = ${JSON.stringify(settings)};</script>`
                });
            } catch (error) {
                console.error('Error loading auto reply page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });

        this.app.post('/api/autoreply/settings', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                const incomingSections = settings.sections;
                if (incomingSections && typeof incomingSections === 'object' && !Array.isArray(incomingSections)) {
                    const uniqueSections: Record<string, any> = {};
                    for (const [rawName, section] of Object.entries(incomingSections)) {
                        const baseName = String(rawName).trim() || 'New Section';
                        let name = baseName;
                        let suffix = 2;
                        while (Object.prototype.hasOwnProperty.call(uniqueSections, name)) name = `${baseName} ${suffix++}`;
                        uniqueSections[name] = section;
                    }
                    settings.sections = uniqueSections;
                }
                currentSettings.autoReply = {
                    ...currentSettings.autoReply,
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.autoReply
                });
            } catch (error) {
                console.error('Error saving auto reply settings:', error);
                return res.status(500).json({ error: 'Failed to save settings' });
            }
        });

        this.app.get('/suggestions', async (_req: Request, res: Response) => {
            try {
                const settings = JSON.parse(readFileSync(join(process.cwd(), 'settings.json'), 'utf-8'));
                
                res.render('suggestions', {
                    title: res.locals.locale.dashboard.suggestions.title,
                    settings,
                    path: '/suggestions',
                    locale: res.locals.locale,
                    currentLang: res.locals.currentLang
                });
            } catch (error) {
                console.error('Error loading suggestions page:', error);
                res.status(500).send('Error loading page');
            }
        });

        this.app.post('/api/settings/suggestions', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.suggestions = {
                    ...currentSettings.suggestions,
                    ...settings
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;

                return res.json({ 
                    success: true,
                    settings: currentSettings.suggestions
                });
            } catch (error) {
                console.error('Error saving suggestions settings:', error);
                return res.status(500).json({ error: 'Failed to save settings' });
            }
        });

        this.app.get('/leveling', async (_req: Request, res: Response) => {
            try {
                const settings = JSON.parse(readFileSync(join(process.cwd(), 'settings.json'), 'utf8'));
                const guild = this.client.guilds.cache.get(config.mainGuildId);

                let leaderboard: any[] = [];
                if (guild) {
                    try {
                        const { getGuildLeaderboard } = await import('../src/leveling/levelingManager');
                        const top = await getGuildLeaderboard(guild.id, 10);
                        leaderboard = await Promise.all(top.map(async (entry: any) => {
                            const member = await guild.members.fetch(entry.userId).catch(() => null);
                            return {
                                userId: entry.userId,
                                username: member?.user.username || `Unknown (${entry.userId})`,
                                avatar: member?.user.displayAvatarURL() || null,
                                xp: entry.xp,
                                level: entry.level
                            };
                        }));
                    } catch (error) {
                        console.error('Error building leveling leaderboard:', error);
                    }
                }

                res.render('leveling', {
                    title: res.locals.locale?.dashboard?.leveling?.levelingSystem || 'Leveling System',
                    settings,
                    leaderboard,
                    path: '/leveling',
                    locale: res.locals.locale,
                    currentLang: res.locals.currentLang || 'en',
                    script: `<script>window.settings = ${JSON.stringify(settings)}; window.leaderboard = ${JSON.stringify(leaderboard)};</script>`
                });
            } catch (error) {
                console.error('Error loading leveling page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });

        this.app.post('/api/leveling/settings', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.leveling = {
                    ...currentSettings.leveling,
                    ...settings,
                    roleRewards: Array.isArray(settings.roleRewards)
                        ? settings.roleRewards.filter((reward: any) =>
                            Number.isInteger(Number(reward?.level)) && Number(reward.level) > 0 &&
                            typeof reward.roleId === 'string' && reward.roleId.trim()
                        ).map((reward: any) => ({ level: Number(reward.level), roleId: reward.roleId.trim() }))
                        : (Array.isArray(currentSettings.leveling?.roleRewards) ? currentSettings.leveling.roleRewards : []),
                    ignoredRoles: Array.isArray(settings.ignoredRoles)
                        ? [...new Set(settings.ignoredRoles.filter((roleId: any) => typeof roleId === 'string' && roleId.trim()).map((roleId: string) => roleId.trim()))]
                        : (Array.isArray(currentSettings.leveling?.ignoredRoles) ? currentSettings.leveling.ignoredRoles : [])
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;

                return res.json({ success: true, settings: currentSettings.leveling });
            } catch (error) {
                console.error('Error saving leveling settings:', error);
                return res.status(500).json({ error: 'Failed to save settings' });
            }
        });

        this.app.get('/selectroles', async (_req: Request, res: Response) => {
            try {
                const settings = JSON.parse(readFileSync(join(process.cwd(), 'settings.json'), 'utf8'));
                const guild = this.client.guilds.cache.get(config.mainGuildId);

                const channels = guild
                    ? guild.channels.cache
                        .filter((c: any) => c.isTextBased?.() && !c.isThread?.())
                        .map((c: any) => ({ id: c.id, name: c.name }))
                    : [];

                const roles = guild
                    ? guild.roles.cache
                        .filter((r: any) => r.id !== guild.id)
                        .sort((a: any, b: any) => b.position - a.position)
                        .map((r: any) => ({ id: r.id, name: r.name, color: r.color }))
                    : [];

                res.render('selectRoles', {
                    title: res.locals.locale?.dashboard?.selectRoles?.title || 'Select Roles Manager',
                    settings,
                    channels,
                    roles,
                    path: '/selectroles',
                    locale: res.locals.locale,
                    currentLang: res.locals.currentLang || 'en',
                    script: `<script>window.settings = ${JSON.stringify(settings)}; window.channels = ${JSON.stringify(channels)}; window.roles = ${JSON.stringify(roles)};</script>`
                });
            } catch (error) {
                console.error('Error loading select roles page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });

        this.app.post('/api/selectroles/menus', async (req: Request, res: Response) => {
            try {
                const menu = req.body;
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                if (!currentSettings.selectRoles) currentSettings.selectRoles = { menus: [] };
                if (!menu.id) menu.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

                const existingIndex = currentSettings.selectRoles.menus.findIndex((m: any) => m.id === menu.id);
                if (existingIndex >= 0) {
                    currentSettings.selectRoles.menus[existingIndex] = {
                        ...currentSettings.selectRoles.menus[existingIndex],
                        ...menu
                    };
                } else {
                    currentSettings.selectRoles.menus.push(menu);
                }

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;

                return res.json({ success: true, menu });
            } catch (error) {
                console.error('Error saving select-role menu:', error);
                return res.status(500).json({ error: 'Failed to save menu' });
            }
        });

        this.app.delete('/api/selectroles/menus/:id', async (req: Request, res: Response) => {
            try {
                const { id } = req.params;
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

                currentSettings.selectRoles.menus = (currentSettings.selectRoles?.menus || [])
                    .filter((m: any) => m.id !== id);

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;

                return res.json({ success: true });
            } catch (error) {
                console.error('Error deleting select-role menu:', error);
                return res.status(500).json({ error: 'Failed to delete menu' });
            }
        });

        this.app.post('/api/selectroles/menus/:id/post', async (req: Request, res: Response) => {
            try {
                const { id } = req.params;
                const { SelectRoleManager } = await import('../src/selectRoles/selectRoleManager');
                const manager = new SelectRoleManager(this.client);
                const messageId = await manager.postMenu(id);

                return res.json({ success: true, messageId });
            } catch (error: any) {
                console.error('Error posting select-role menu:', error);
                return res.status(500).json({ error: error?.message || 'Failed to post menu' });
            }
        });

        this.app.get('/api/dashboard/stats', async (_req: Request, res: Response) => {
            try {
                const stats = await this.generateDashboardStats();
                
                return res.json({ 
                    success: true, 
                    stats,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to fetch dashboard stats' 
                });
            }
        });

        this.app.post('/api/settings/language', async (req: Request, res: Response) => {
            try {
                const { defaultLanguage, supportedLanguages } = req.body;
                
                if (!defaultLanguage || !supportedLanguages || !Array.isArray(supportedLanguages)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Invalid input parameters' 
                    });
                }
                
                if (supportedLanguages.length === 0) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'At least one language must be supported' 
                    });
                }
                
                if (!supportedLanguages.includes(defaultLanguage)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Default language must be included in supported languages' 
                    });
                }
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                
                currentSettings.defaultLanguage = defaultLanguage;
                currentSettings.supportedLanguages = supportedLanguages;
                
                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;
                
                return res.json({ 
                    success: true,
                    settings: {
                        defaultLanguage,
                        supportedLanguages
                    }
                });
            } catch (error) {
                console.error('Error updating language settings:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to update language settings' 
                });
            }
        });

        this.app.post('/api/settings/autoRoles', async (req: Request, res: Response) => {
            try {
                const settings = req.body;
                
                if (!settings || typeof settings.enabled !== 'boolean' || 
                    !settings.members || !settings.bots || 
                    typeof settings.members.enabled !== 'boolean' || 
                    typeof settings.bots.enabled !== 'boolean' || 
                    !Array.isArray(settings.members.roleIds) || 
                    !Array.isArray(settings.bots.roleIds)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Invalid input parameters' 
                    });
                }
                
                const settingsPath = join(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                
                currentSettings.autoRoles = {
                    enabled: settings.enabled,
                    members: {
                        enabled: settings.members.enabled,
                        roleIds: settings.members.roleIds
                    },
                    bots: {
                        enabled: settings.bots.enabled,
                        roleIds: settings.bots.roleIds
                    }
                };
                
                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                
                this.client.settings = currentSettings;
                
                return res.json({ 
                    success: true,
                    settings: currentSettings.autoRoles
                });
            } catch (error) {
                console.error('Error updating auto roles settings:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to update auto roles settings' 
                });
            }
        });

        this.app.post('/api/settings/tagRole', async (req: Request, res: Response) => {
            try {
                const enabled = req.body?.enabled === true;
                const roleId = typeof req.body?.roleId === 'string' ? req.body.roleId.trim() : '';
                if (enabled && !/^\d{15,22}$/.test(roleId)) {
                    return res.status(400).json({ success: false, error: 'Select a valid role.' });
                }
                const guild = this.client.guilds.cache.get(config.mainGuildId);
                const role = roleId ? guild?.roles.cache.get(roleId) : null;
                if (enabled && (!role || role.managed || !role.editable)) {
                    return res.status(400).json({ success: false, error: 'That role cannot be managed by the bot.' });
                }
                const settingsPath = join(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                currentSettings.tagRoles = {
                    enabled,
                    mappings: enabled ? [{ roleId }] : []
                };
                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                if (guild) await syncTagRolesForGuild(guild, this.client);
                return res.json({ success: true, settings: currentSettings.tagRoles });
            } catch (error) {
                console.error('Error updating Server Tag Role settings:', error);
                return res.status(500).json({ success: false, error: 'Failed to save Server Tag Role settings.' });
            }
        });

        this.app.post('/api/economy/settings', async (req: Request, res: Response) => {
            try {
                const body = req.body || {};
                const integer = (value: unknown): number | null => {
                    const parsed = typeof value === 'number' ? value : Number(value);
                    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
                };
                const dailyMin = integer(body.dailyRewardMin);
                const dailyMax = integer(body.dailyRewardMax);
                const bumpMin = integer(body.bumpRewardMin);
                const bumpMax = integer(body.bumpRewardMax);
                const startingCash = integer(body.startingCash);
                const dailyCooldownHours = Number(body.dailyCooldownHours);
                const bumpCooldownMinutes = Number(body.bumpCooldownMinutes);
                const currencyName = typeof body.currencyName === 'string' ? body.currencyName.trim().slice(0, 24) : '';
                const currencyEmoji = typeof body.currencyEmoji === 'string' ? body.currencyEmoji.trim().slice(0, 8) : '';
                const disboardBotId = typeof body.disboardBotId === 'string' ? body.disboardBotId.trim() : '';
                const gameRewards = body.gameRewards && typeof body.gameRewards === 'object' && !Array.isArray(body.gameRewards) ? body.gameRewards : null;
                const settingsPath = join(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                const storedAccentColor = typeof currentSettings.economy?.accentColor === 'string' &&
                    /^#[0-9A-F]{6}$/i.test(currentSettings.economy.accentColor)
                    ? currentSettings.economy.accentColor.toUpperCase()
                    : '#8B5CF6';

                if (!currencyName || !currencyEmoji || startingCash === null ||
                    dailyMin === null || dailyMax === null || dailyMin > dailyMax ||
                    bumpMin === null || bumpMax === null || bumpMin > bumpMax ||
                    !Number.isInteger(dailyCooldownHours) || dailyCooldownHours < 1 ||
                    !Number.isInteger(bumpCooldownMinutes) || bumpCooldownMinutes < 1 ||
                    !/^\d{15,22}$/.test(disboardBotId) ||
                    typeof body.enabled !== 'boolean' ||
                    typeof body.dailyRewardEnabled !== 'boolean' ||
                    typeof body.transfersEnabled !== 'boolean' ||
                    typeof body.bumpRewardEnabled !== 'boolean') {
                    return res.status(400).json({ success: false, error: 'Please enter valid economy settings.' });
                }

                currentSettings.economy = {
                    enabled: body.enabled,
                    currencyName,
                    currencyEmoji,
                    accentColor: storedAccentColor,
                    startingCash,
                    dailyRewardEnabled: body.dailyRewardEnabled,
                    dailyRewardMin: dailyMin,
                    dailyRewardMax: dailyMax,
                    dailyCooldownHours,
                    transfersEnabled: body.transfersEnabled,
                    bumpRewardEnabled: body.bumpRewardEnabled,
                    bumpRewardMin: bumpMin,
                    bumpRewardMax: bumpMax,
                    bumpCooldownMinutes,
                    disboardBotId,
                    gameRewards: gameRewards || currentSettings.economy?.gameRewards || {}
                };

                writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;

                return res.json({ success: true, settings: currentSettings.economy });
            } catch (error) {
                console.error('Error saving economy settings:', error);
                return res.status(500).json({ success: false, error: 'Failed to save economy settings' });
            }
        });

        this.app.get('/api/dashboard/chart/:period', async (req: Request, res: Response) => {
            try {
                const period = req.params.period;
                let days = 30; // Default to month
                
                switch (period) {
                    case 'day':
                        days = 1;
                        break;
                    case 'week':
                        days = 7;
                        break;
                    case 'month':
                    default:
                        days = 30;
                        break;
                }
                
                const dates = Array.from({length: days}, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (days - 1) + i);
                    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                });
                
                const pingData = dates.map((_, i) => {
                    let baseValue = 80; 
                    const dayVariation = Math.sin(i / 3) * 10;
                    const randomVariation = Math.floor(Math.random() * 30);
                    return Math.floor(baseValue + dayVariation + randomVariation);
                });
                
                const commandsData = dates.map((_, i) => {
                    const baseValue = 50; 
                    const trendGrowth = i * 1.5;
                    const dayOfWeek = new Date(dates[i]).getDay();
                    const weekendBoost = (dayOfWeek === 0 || dayOfWeek === 6) ? 25 : 0;
                    const randomVariation = Math.floor(Math.random() * 15);
                    return Math.floor(baseValue + trendGrowth + weekendBoost + randomVariation);
                });
                
                const usersData = dates.map((_, i) => {
                    const baseValue = 300; 
                    const trendGrowth = i * 5;
                    const dayOfWeek = new Date(dates[i]).getDay();
                    const weekendBoost = (dayOfWeek === 0 || dayOfWeek === 6) ? 100 : 0;
                    const randomVariation = Math.floor(Math.random() * 40);
                    return Math.floor(baseValue + trendGrowth + weekendBoost + randomVariation);
                });
                
                const formattedDates = dates.map(date => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
                });
                
                return res.json({
                    success: true,
                    data: {
                        labels: formattedDates,
                        datasets: {
                            ping: pingData,
                            commands: commandsData,
                            users: usersData
                        }
                    },
                    period,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error generating chart data:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to generate chart data' 
                });
            }
        });

        this.app.get('/selectroles', (_req: Request, res: Response) => {
            try {
                const currentLang = res.locals.currentLang || 'en';
                const locale = this.getLocale(currentLang);
                const settings = JSON.parse(readFileSync(join(process.cwd(), 'settings.json'), 'utf8'));
                const guild = this.client.guilds.cache.get(config.mainGuildId) || this.client.guilds.cache.first();
                const channels = guild
                    ? guild.channels.cache
                        .filter((channel: any) => channel.isTextBased?.() && !channel.isThread?.() && typeof channel.name === 'string')
                        .map((channel: any) => ({ id: channel.id, name: channel.name, type: channel.type }))
                    : [];
                const roles = guild
                    ? guild.roles.cache
                        .filter((role: any) => role.id !== guild.id && !role.managed)
                        .sort((a: any, b: any) => b.position - a.position)
                        .map((role: any) => ({ id: role.id, name: role.name, color: role.color, position: role.position }))
                    : [];
                const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
                
                return res.render('selectRoles', {
                    title: locale.dashboard?.selectRoles?.title || 'Select Roles Manager',
                    settings,
                    channels,
                    roles,
                    path: '/selectroles',
                    currentLang,
                    locale,
                    script: `<script>window.settings = ${jsonForScript(settings)}; window.channels = ${jsonForScript(channels)}; window.roles = ${jsonForScript(roles)};</script>`,
                    breadcrumbs: this.getBreadcrumbs('/selectroles')
                });
            } catch (error) {
                console.error('Error rendering select roles page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });

        this.app.get('/games', (_req: Request, res: Response) => {
            try {
                const currentLang = res.locals.currentLang || 'en';
                const locale = this.getLocale(currentLang);
                
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.games.title,
                    feature: 'games',
                    featureIcon: 'fas fa-gamepad',
                    settings: this.client.settings,
                    client: this.client,
                    config,
                    path: '/games',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/games')
                });
            } catch (error) {
                console.error('Error rendering games page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });

        this.app.get('/automod', (_req: Request, res: Response) => {
            try {
                const currentLang = res.locals.currentLang || 'en';
                const locale = this.getLocale(currentLang);
                
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.autoMod.title,
                    feature: 'autoMod',
                    featureIcon: 'fas fa-robot',
                    settings: this.client.settings,
                    client: this.client,
                    config,
                    path: '/automod',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/automod')
                });
            } catch (error) {
                console.error('Error rendering automod page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });

        this.app.get('/autolines', (_req: Request, res: Response) => {
            try {
                const currentLang = res.locals.currentLang || 'en';
                const locale = this.getLocale(currentLang);
                
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.autoLines.title,
                    feature: 'autoLines',
                    featureIcon: 'fas fa-align-left',
                    settings: this.client.settings,
                    client: this.client,
                    config,
                    path: '/autolines',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/autolines')
                });
            } catch (error) {
                console.error('Error rendering auto lines page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });

        this.app.get('/leveling', (_req: Request, res: Response) => {
            try {
                const currentLang = res.locals.currentLang || 'en';
                const locale = this.getLocale(currentLang);
                
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.leveling.title,
                    feature: 'leveling',
                    featureIcon: 'fas fa-chart-line',
                    settings: this.client.settings,
                    client: this.client,
                    config,
                    path: '/leveling',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/leveling')
                });
            } catch (error) {
                console.error('Error rendering leveling system page:', error);
                return res.status(500).render('error', { 
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });

        this.app.get('/api/commands/list', async (_req: Request, res: Response) => {
            try {
                const settingsPath = join(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                
                const allCommands = Object.entries(currentSettings.commands).map(([name, data]) => {
                    const commandData = data as CommandSettings;
                    return {
                        name,
                        enabled: commandData.enabled || false,
                        aliases: commandData.aliases || [],
                        cooldown: commandData.cooldown || 5,
                        permissions: commandData.permissions || { enabledRoleIds: [], disabledRoleIds: [] }
                    };
                });
                
                const generalCommands = ['avatar', 'banner', 'ping', 'roles', 'server', 'user'];
                const moderationCommands = ['ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn', 'clear', 'lock', 'unlock', 'hide', 'unhide', 'move', 'timeout', 'rtimeout'];
                
                const categories = {
                    general: allCommands.filter(cmd => generalCommands.includes(cmd.name)),
                    moderation: allCommands.filter(cmd => moderationCommands.includes(cmd.name)),
                    utility: allCommands.filter(cmd => !generalCommands.includes(cmd.name) && !moderationCommands.includes(cmd.name))
                };
                
                return res.json({
                    success: true,
                    categories,
                    allCommands
                });
            } catch (error) {
                console.error('Error fetching commands list:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to fetch commands list' 
                });
            }
        });

        this.app.use((_req: Request, res: Response) => {
            res.status(404).render('error', {
                title: '404 - ' + res.locals.locale.dashboard.error['404'].title,
                error: {
                    code: 404,
                    message: res.locals.locale.dashboard.error['404'].message
                }
            });
        });
    }

    private async saveSettings(settings?: any): Promise<void> {
        try {
            const settingsPath = join(process.cwd(), 'settings.json');
            const settingsToSave = settings || this.client.settings;
            const settingsString = JSON.stringify(settingsToSave, null, 4);
            
            await writeFileSync(settingsPath, settingsString);
            console.log('Settings saved successfully');
            
            delete require.cache[require.resolve('../settings.json')];
            
            const savedSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
            console.log('Verified saved settings:', savedSettings.commands[Object.keys(savedSettings.commands)[0]]);

            if (settings) {
                this.client.settings = settings;
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    public start(): void {
        try {
            this.app.listen(config.dashboard.port, () => {
                console.log(`Dashboard running at http://localhost:${config.dashboard.port}`);
            });
        } catch (error) {
            console.error('Failed to start dashboard:', error);
        }
    }

    private async generateDashboardStats() {
        const serverCount = this.client.guilds.cache.size;
        const memberCount = this.client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
        const commandCount = this.client.commands.size;
        
        const totalChannels = this.client.guilds.cache.reduce(
            (acc, guild) => acc + guild.channels.cache.size, 0
        );
        
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
        
        let commandsUsed = 0;
        const commandStats = (this.client as any).commandStats;
        if (commandStats && typeof commandStats === 'object') {
            commandsUsed = Object.values(commandStats as Record<string, number>).reduce(
                (sum: number, count: number) => sum + count, 
                0
            );
        }

        const protection = this.client.settings.protection || {};
        const activeProtections = Object.keys(protection)
            .filter(k => k !== 'enabled' && protection[k]?.enabled)
            .length;
            
        const protectedRoles = protection.protectedRoles?.roles?.length || 0;
        const whitelistedBots = protection.antibot?.whitelistedBots?.length || 0;
        
        const logs = this.client.settings.logs || {};
        const logsArray = Object.values(logs) as Array<{enabled: boolean}>;
        const activeLogs = logsArray.filter(log => log.enabled).length;
        
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptime = days > 0 
            ? `${days}d ${hours}h ${minutes}m` 
            : hours > 0 
                ? `${hours}h ${minutes}m` 
                : `${minutes}m`;
        
        return {
            servers: serverCount,
            users: memberCount,
            commands: commandCount,
            commandsUsed,
            channels: totalChannels,
            ping: this.getPing(),
            uptime,
            memoryUsage: memoryUsageMB,
            protection: {
                activeProtections,
                protectedRoles,
                whitelistedBots,
                activeLogs
            },
            serverActivity: await getServerActivity(this.client.guilds.cache.first()?.id)
        };
    }

    private getModuleStatus() {
        const settings = this.client.settings;
        
        return {
            protection: {
                enabled: settings.protection?.enabled || false,
                activeRules: Object.keys(settings.protection || {})
                    .filter(k => k !== 'enabled' && settings.protection[k]?.enabled)
                    .length
            },
            tickets: {
                enabled: settings.ticket?.enabled || false,
                sections: (settings.ticket?.sections || []).length
            },
            apply: {
                enabled: settings.apply?.enabled || false,
                positions: (settings.apply?.positions || [])
                    .filter((p: any) => p.enabled)
                    .length
            },
            rules: {
                enabled: settings.rules?.enabled || false,
                sections: (settings.rules?.sections || []).length
            },
            giveaway: {
                enabled: settings.giveaway?.enabled || false
            },
            logs: {
                enabled: Object.values(settings.logs || {}).some((log: any) => log.enabled),
                activeTypes: Object.values(settings.logs || {}).filter((log: any) => log.enabled).length
            },
            autoReply: {
                enabled: settings.autoReply?.enabled || false,
                triggers: (settings.autoReply?.triggers || []).length
            },
            tempChannels: {
                enabled: settings.tempChannels?.enabled || false
            },
            suggestions: {
                enabled: settings.suggestions?.enabled || false
            },
            leveling: {
                enabled: settings.leveling?.enabled || false
            },
            selectRoles: {
                enabled: (settings.selectRoles?.menus || []).length > 0,
                menus: (settings.selectRoles?.menus || []).length
            }
        };
    }

    private async getRecentActivity() {
        const now = new Date();
        
        return [
            {
                id: 'system-init',
                type: 'system',
                title: 'System Initialized',
                description: 'All systems are up and running',
                icon: 'check-circle',
                color: 'blue',
                timestamp: this.startTime,
                timeAgo: this.getRelativeTime(this.startTime)
            },
            {
                id: 'api-connected',
                type: 'connection',
                title: 'API Connected',
                description: 'Gateway connection established',
                icon: 'server',
                color: 'green',
                timestamp: new Date(now.getTime() - 10 * 60000), // 10 minutes ago
                timeAgo: '10 minutes ago'
            },
            {
                id: 'protection-active',
                type: 'protection',
                title: 'Protection Active',
                description: 'Server security systems enabled',
                icon: 'shield-alt',
                color: 'purple',
                timestamp: new Date(now.getTime() - 30 * 60000), // 30 minutes ago
                timeAgo: '30 minutes ago'
            },
            {
                id: 'settings-updated',
                type: 'settings',
                title: 'Settings Updated',
                description: 'Configuration changes applied',
                icon: 'sync',
                color: 'amber',
                timestamp: new Date(now.getTime() - 60 * 60000), // 1 hour ago
                timeAgo: '1 hour ago'
            }
        ];
    }

    private getRelativeTime(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffSec / 60);
        const diffHour = Math.round(diffMin / 60);
        const diffDay = Math.round(diffHour / 24);

        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    }
} 
