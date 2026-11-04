import {
    TextChannel,
    NewsChannel,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ButtonInteraction,
    StringSelectMenuInteraction,
    GuildMember
} from 'discord.js';
import { ModBot } from '../types/ModBot';

export interface SelectRoleOption {
    label: string;
    roleId: string;
    emoji?: string;
    description?: string;
}

export interface SelectRoleMenu {
    id: string;
    title: string;
    description: string;
    color: string;
    channelId: string;
    messageId?: string;
    type: 'select' | 'buttons';
    multiple: boolean; // allow selecting more than one option at once (select menu only)
    options: SelectRoleOption[];
}

const SELECT_LIMIT = 25;
const BUTTON_ROW_LIMIT = 5;
const BUTTONS_PER_ROW = 5;

export class SelectRoleManager {
    constructor(private client: ModBot) {}

    private get menus(): SelectRoleMenu[] {
        return this.client.settings.selectRoles?.menus || [];
    }

    public getMenu(menuId: string): SelectRoleMenu | undefined {
        return this.menus.find(m => m.id === menuId);
    }

    private buildEmbed(menu: SelectRoleMenu): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(menu.title || 'Select Your Roles')
            .setDescription(menu.description || 'Choose a role below.')
            .setColor((menu.color || '#777bc9') as `#${string}`);
    }

    private buildComponents(menu: SelectRoleMenu): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
        if (menu.type === 'select') {
            const select = new StringSelectMenuBuilder()
                .setCustomId(`selectrole_menu_${menu.id}`)
                .setPlaceholder('Choose a role...')
                .setMinValues(0)
                .setMaxValues(menu.multiple ? Math.min(menu.options.length, SELECT_LIMIT) : 1);

            for (const option of menu.options.slice(0, SELECT_LIMIT)) {
                select.addOptions({
                    label: option.label,
                    value: option.roleId,
                    description: option.description,
                    emoji: option.emoji || undefined
                });
            }

            return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)];
        }

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const options = menu.options.slice(0, BUTTON_ROW_LIMIT * BUTTONS_PER_ROW);
        for (let i = 0; i < options.length; i += BUTTONS_PER_ROW) {
            const row = new ActionRowBuilder<ButtonBuilder>();
            for (const option of options.slice(i, i + BUTTONS_PER_ROW)) {
                const button = new ButtonBuilder()
                    .setCustomId(`selectrole_btn_${menu.id}_${option.roleId}`)
                    .setLabel(option.label)
                    .setStyle(ButtonStyle.Secondary);
                if (option.emoji) button.setEmoji(option.emoji);
                row.addComponents(button);
            }
            rows.push(row);
        }
        return rows;
    }

    /** Posts (or re-posts) a menu message to its configured channel. Returns the new message id. */
    public async postMenu(menuId: string): Promise<string> {
        const menu = this.getMenu(menuId);
        if (!menu) throw new Error('Menu not found');

        const channel = await this.client.channels.fetch(menu.channelId).catch(() => null) as TextChannel | NewsChannel | null;
        if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text-based');

        const message = await channel.send({
            embeds: [this.buildEmbed(menu)],
            components: this.buildComponents(menu)
        });

        menu.messageId = message.id;
        await this.saveMenus();

        return message.id;
    }

    private async saveMenus(): Promise<void> {
        const { writeFileSync } = await import('fs');
        const { join } = await import('path');
        // Use the project working directory so this also works from dist/ after build.
        const settingsPath = join(process.cwd(), 'settings.json');
        writeFileSync(settingsPath, JSON.stringify(this.client.settings, null, 4));
    }

    public async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
        const member = interaction.member as GuildMember;
        if (!member) return;

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('selectrole_menu_')) {
            const menuId = interaction.customId.replace('selectrole_menu_', '');
            const menu = this.getMenu(menuId);
            if (!menu) {
                await interaction.reply({ content: '❌ This role menu no longer exists.', ephemeral: true });
                return;
            }

            const allRoleIds = menu.options.map(o => o.roleId);
            const selected = interaction.values;

            const toAdd = selected.filter(id => !member.roles.cache.has(id));
            const toRemove = allRoleIds.filter(id => !selected.includes(id) && member.roles.cache.has(id));

            try {
                if (toAdd.length) await member.roles.add(toAdd);
                if (toRemove.length) await member.roles.remove(toRemove);

                const addedNames = menu.options.filter(o => toAdd.includes(o.roleId)).map(o => o.label);
                const removedNames = menu.options.filter(o => toRemove.includes(o.roleId)).map(o => o.label);

                const parts: string[] = [];
                if (addedNames.length) parts.push(`✅ Added: ${addedNames.join(', ')}`);
                if (removedNames.length) parts.push(`➖ Removed: ${removedNames.join(', ')}`);

                await interaction.reply({
                    content: parts.length ? parts.join('\n') : 'No changes made.',
                    ephemeral: true
                });
            } catch (error) {
                console.error('[selectRoles] Error updating roles:', error);
                await interaction.reply({ content: '❌ I could not update your roles. Check my role position and permissions.', ephemeral: true });
            }
            return;
        }

        if (interaction.isButton() && interaction.customId.startsWith('selectrole_btn_')) {
            const rest = interaction.customId.replace('selectrole_btn_', '');
            const separatorIndex = rest.indexOf('_');
            const menuId = rest.slice(0, separatorIndex);
            const roleId = rest.slice(separatorIndex + 1);

            const menu = this.getMenu(menuId);
            if (!menu) {
                await interaction.reply({ content: '❌ This role menu no longer exists.', ephemeral: true });
                return;
            }

            try {
                const has = member.roles.cache.has(roleId);
                if (has) {
                    await member.roles.remove(roleId);
                } else {
                    await member.roles.add(roleId);
                }
                const option = menu.options.find(o => o.roleId === roleId);
                await interaction.reply({
                    content: has
                        ? `➖ Removed the **${option?.label || 'role'}** role.`
                        : `✅ Added the **${option?.label || 'role'}** role.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('[selectRoles] Error toggling role:', error);
                await interaction.reply({ content: '❌ I could not update your roles. Check my role position and permissions.', ephemeral: true });
            }
        }
    }
}
