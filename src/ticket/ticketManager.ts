import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GuildMember,
  Message,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
  TextChannel,
} from 'discord.js';
import { ModBot } from '../types/ModBot';
import { Ticket } from '../models/Ticket';
import { createTranscript } from './transcriptGenerator';

export interface TicketButtonConfig {
  label?: string;
  ticketName?: string;
  style?: 'Primary' | 'Secondary' | 'Success' | 'Danger';
  categoryId?: string;
  emoji?: string;
  mentionRoleIds?: string[];
}

export interface TicketSelectOptionConfig { label: string; value: string; description?: string; emoji?: string; ticketName?: string; categoryId?: string; mentionRoleIds?: string[]; }
export interface TicketSelectMenuConfig { placeholder?: string; options: TicketSelectOptionConfig[]; }

export interface TicketPanelConfig {
  id: string;
  name: string;
  embedTitle?: string;
  embedDescription?: string;
  embedColor?: string;
  embedImage?: string;
  panelChannelId?: string;
  defaultCategoryId?: string;
  staffRoleId?: string;
  welcomeMessage?: string;
  buttons: TicketButtonConfig[];
  selectMenus?: TicketSelectMenuConfig[];
  logChannelId?: string;
}

const DEFAULT_BUTTON: TicketButtonConfig = {
  label: '🎫 فتح تكت',
  ticketName: 'support',
  style: 'Primary',
  categoryId: '',
  emoji: '',
};

function color(value?: string): number {
  const hex = String(value || '#5865F2').replace('#', '');
  return /^[0-9a-f]{6}$/i.test(hex) ? parseInt(hex, 16) : 0x5865f2;
}

function slug(value: string, fallback: string): string {
  const result = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 38);
  return result || fallback;
}

function panelSettings(client: ModBot): TicketPanelConfig[] {
  const settings: any = client.settings as any;
  if (Array.isArray(settings.ticketPanels)) return settings.ticketPanels;
  const oldSections = Array.isArray(settings.ticket?.sections) ? settings.ticket.sections : [];
  return oldSections.map((section: any, index: number) => ({
    id: `section-${index}`,
    name: section.name || `Panel ${index + 1}`,
    embedTitle: settings.ticket?.embed?.footer || '🎫 فتح تكت',
    embedDescription: section.description || 'اضغط على الزر أدناه لفتح تذكرة.',
    embedColor: settings.ticket?.embed?.color || '#5865F2',
    embedImage: section.imageUrl || '',
    panelChannelId: '',
    staffRoleId: section.adminRoles?.[0] || '',
    welcomeMessage: '',
    buttons: [{ ...DEFAULT_BUTTON, label: `${section.emoji || '🎫'} ${section.name || 'فتح تكت'}`, categoryId: section.categoryId || '' }],
    selectMenus: [],
  }));
}

export class TicketManager {
  constructor(private client: ModBot) {}

  public async setupSystem(channel: TextChannel): Promise<void> {
    const panels = panelSettings(this.client);
    const panel = panels[0] || {
      id: 'default', name: 'Support', embedTitle: '🎫 فتح تكت',
      embedDescription: 'اضغط على الزر أدناه لفتح تذكرة.', embedColor: '#5865F2',
      panelChannelId: channel.id, staffRoleId: '', welcomeMessage: '', buttons: [{ ...DEFAULT_BUTTON }],
    };
    if (!panel.panelChannelId) panel.panelChannelId = channel.id;
    await this.sendPanel(channel, panel);
  }

  public async sendPanel(channel: TextChannel, panel: TicketPanelConfig): Promise<Message> {
    const buttons = panel.buttons?.length ? panel.buttons : [];
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      buttons.slice(i, i + 5).forEach((button, offset) => {
        const index = i + offset;
        const builder = new ButtonBuilder()
          .setCustomId(`ticket_open_${panel.id}:${index}`)
          .setLabel(String(button.label || DEFAULT_BUTTON.label).slice(0, 80))
          .setStyle(ButtonStyle[button.style || 'Primary'] || ButtonStyle.Primary);
        if (button.emoji) builder.setEmoji(button.emoji);
        row.addComponents(builder);
      });
      rows.push(row);
    }
    const menuRows = (panel.selectMenus || []).slice(0, 5).map((menu, menuIndex) => new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(`ticket_select_${panel.id}:${menuIndex}`).setPlaceholder(String(menu.placeholder || 'اختر نوع التذكرة').slice(0, 150)).addOptions(menu.options.slice(0, 25).map((option) => ({ label: String(option.label || option.value).slice(0, 100), value: String(option.value || option.label).slice(0, 100), description: option.description ? String(option.description).slice(0, 100) : undefined, emoji: option.emoji || undefined })))));
    const embed = new EmbedBuilder().setColor(color(panel.embedColor));
    if (panel.embedTitle) embed.setTitle(panel.embedTitle.slice(0, 256));
    if (panel.embedDescription) embed.setDescription(panel.embedDescription.slice(0, 4096));
    if (panel.embedImage) embed.setImage(panel.embedImage);
    return channel.send({ embeds: [embed], components: [...rows, ...menuRows] as any });
  }

  public async handleInteraction(interaction: ButtonInteraction): Promise<any> { return this.handleOpen(interaction); }
  public async handleSelect(interaction: StringSelectMenuInteraction): Promise<any> {
    const raw = interaction.customId.slice('ticket_select_'.length);
    const sep = raw.lastIndexOf(':');
    const panels = panelSettings(this.client);
    const panel = panels.find((item) => item.id === raw.slice(0, sep));
    const option = panel?.selectMenus?.[Number(raw.slice(sep + 1)) || 0]?.options.find((item) => item.value === interaction.values[0]);
    if (!panel || !option) return interaction.reply({ content: '❌ هذا الخيار غير موجود.', ephemeral: true });
    if (!option.categoryId) {
      const legacySection = ((this.client.settings as any).ticket?.sections || []).find((section: any) => String(section.name || '').toLowerCase() === String(option.ticketName || option.label || option.value).toLowerCase());
      if (legacySection?.categoryId) option.categoryId = legacySection.categoryId;
    }
    return this.handleOpen(interaction as any, option, panel);
  }
  public async handleOpen(interaction: ButtonInteraction | StringSelectMenuInteraction, selectedConfig?: TicketButtonConfig | TicketSelectOptionConfig, selectedPanel?: TicketPanelConfig): Promise<any> {
    const panels = panelSettings(this.client);
    const isSelect = interaction.customId.startsWith('ticket_select_');
    const prefix = isSelect ? 'ticket_select_' : 'ticket_open_';
    const raw = interaction.customId.slice(prefix.length);
    const separator = raw.lastIndexOf(':');
    const panelId = separator === -1 ? panels[0]?.id : raw.slice(0, separator);
    const buttonIndex = separator === -1 ? Number(raw) || 0 : Number(raw.slice(separator + 1)) || 0;
    let panel = selectedPanel || panels.find((item) => item.id === panelId);
    // Messages sent before a panel was migrated may contain an old/stale ID.
    // Recover by matching the visible embed, then fall back only when unambiguous.
    if (!panel) {
      const title = interaction.message?.embeds?.[0]?.title;
      const description = interaction.message?.embeds?.[0]?.description;
      const componentLabel = (interaction as any).component?.label || '';
      panel = panels.find((item) => (title && item.embedTitle === title) || (description && item.embedDescription === description));
      if (!panel && componentLabel) {
        panel = panels.find((item) => (item.buttons || []).some((button: any) => String(button.label || '') === String(componentLabel)));
      }
    }
    // A panel can be renamed or recreated after its Discord message was sent.
    // Never strand that message: use the first active panel as the migration fallback.
    if (!panel && panels.length > 0) panel = panels[0];
    if (!panel) return interaction.reply({ content: '❌ هذا البانيل غير موجود.', ephemeral: true });
    const button = { ...(selectedConfig || panel.buttons?.[buttonIndex] || panel.buttons?.[0] || DEFAULT_BUTTON) };
    if (!button.categoryId && panel.defaultCategoryId) button.categoryId = panel.defaultCategoryId;
    const existing = interaction.guild?.channels.cache.find((ch: any) => ch.topic === `ticket-${interaction.user.id}`);
    if (existing) return interaction.reply({ content: `❌ لديك تذكرة مفتوحة بالفعل: ${existing}`, ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    try {
      const guild = interaction.guild!;
      const overwrites: any[] = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
        { id: this.client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ];
      const mentionRoleIds = Array.isArray((button as any).mentionRoleIds) && (button as any).mentionRoleIds.length ? (button as any).mentionRoleIds.filter((id: any) => typeof id === 'string' && /^\d{17,20}$/.test(id)) : (panel.staffRoleId ? [panel.staffRoleId] : []);
      const uniqueMentionRoleIds: string[] = [...new Set<string>(mentionRoleIds)];
      for (const roleId of uniqueMentionRoleIds) overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] });
      const category = button.categoryId ? await guild.channels.fetch(button.categoryId).catch(() => null) : null;
      const name = `${slug(button.ticketName || 'support', 'support')}-${slug(interaction.user.username, interaction.user.id)}`.slice(0, 100);
      const channel = await guild.channels.create({ name, type: ChannelType.GuildText, parent: category?.type === ChannelType.GuildCategory ? category.id : undefined, topic: `ticket-${interaction.user.id}`, permissionOverwrites: overwrites });
      const ticket: any = await Ticket.create({ guildId: guild.id, channelId: channel.id, userId: interaction.user.id, section: panel.name, panelId: panel.id, ticketName: button.ticketName || 'support', status: 'open', createdAt: new Date() });
      const embed = new EmbedBuilder().setColor(color(panel.embedColor)).setTitle(panel.embedTitle || '🎫 تذكرة جديدة').setDescription(panel.welcomeMessage || 'مرحباً! شكراً لتواصلك معنا، سيقوم أحد أعضاء الفريق بالرد عليك قريباً.').setFooter({ text: `تم الفتح بواسطة ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
      if (panel.embedImage) embed.setImage(panel.embedImage);
      const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ticket_claim_${ticket.id}`).setLabel('✋ Claim').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ticket_close_${ticket.id}`).setLabel('🔒 إغلاق التذكرة').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_manage_${ticket.id}`).setLabel('⚙️ Manage').setStyle(ButtonStyle.Secondary),
      );
      const roleMentions = uniqueMentionRoleIds.map((id) => `<@&${id}>`).join(' ');
      await channel.send({ content: `<@${interaction.user.id}> ${roleMentions}`.trim(), embeds: [embed], components: [controls], allowedMentions: { users: [interaction.user.id], roles: uniqueMentionRoleIds } });
      await interaction.editReply({ content: `✅ تم فتح تذكرتك: ${channel}` });
    } catch (error: any) {
      console.error('[Ticket open]', error);
      await interaction.editReply({ content: `❌ فشل فتح التذكرة: ${error.message || 'خطأ غير معروف'}` });
    }
  }

  public async handleClaim(interaction: ButtonInteraction): Promise<any> {
    const ticket: any = await Ticket.findById(interaction.customId.replace('ticket_claim_', ''));
    if (!ticket || ticket.status !== 'open') return interaction.reply({ content: '❌ هذه التذكرة غير متاحة.', ephemeral: true });
    const panel = panelSettings(this.client).find((item) => item.id === ticket.panelId) || panelSettings(this.client).find((item) => item.name === ticket.section);
    const member = interaction.member as GuildMember;
    const isStaff = panel?.staffRoleId ? member.roles.cache.has(panel.staffRoleId) : member.permissions.has(PermissionFlagsBits.ManageChannels);
    if (!isStaff) return interaction.reply({ content: '❌ فقط أعضاء الفريق يمكنهم المطالبة بالتذكرة.', ephemeral: true });
    if (ticket.claimedBy) return interaction.reply({ content: `❌ هذه التذكرة مطالب بها بالفعل من قبل <@${ticket.claimedBy}>.`, ephemeral: true });
    ticket.status = 'claimed'; ticket.claimedBy = interaction.user.id; ticket.claimedAt = new Date(); await ticket.save();
    const original = await interaction.channel?.messages.fetch(interaction.message.id).catch(() => null);
    if (original) {
      const rows = original.components.map((row: any) => {
        const data = row.toJSON ? row.toJSON() : row;
        return new ActionRowBuilder<ButtonBuilder>().addComponents(...data.components.map((component: any) => component.type === 2 && component.custom_id?.startsWith('ticket_claim_') ? ButtonBuilder.from(component).setLabel(`✅ Claimed by ${interaction.user.username}`).setDisabled(true) : component));
      });
      await original.edit({ content: original.content || undefined, embeds: original.embeds.map((embed) => embed.toJSON()), components: rows as any, allowedMentions: { parse: [] } }).catch((error) => console.error('[Ticket claim update]', error.message));
    }
    return interaction.reply({ content: `✅ تم المطالبة بالتذكرة بواسطة ${interaction.user}` });
  }

  public async handleClose(interaction: ButtonInteraction): Promise<any> {
    const ticket: any = await Ticket.findById(interaction.customId.replace('ticket_close_', ''));
    if (!ticket || ticket.status === 'closed') return interaction.reply({ content: '❌ هذه التذكرة غير متاحة.', ephemeral: true });
    const panel = panelSettings(this.client).find((item) => item.id === ticket.panelId) || panelSettings(this.client).find((item) => item.name === ticket.section);
    const member = interaction.member as GuildMember;
    const isStaff = panel?.staffRoleId ? member.roles.cache.has(panel.staffRoleId) : member.permissions.has(PermissionFlagsBits.ManageChannels);
    if (!isStaff && ticket.userId !== interaction.user.id) return interaction.reply({ content: '❌ ليس لديك صلاحية إغلاق هذه التذكرة.', ephemeral: true });
    const channel = interaction.channel as TextChannel;
    await interaction.reply({ content: '🔒 سيتم إغلاق التذكرة خلال 5 ثواني...' });
    setTimeout(async () => {
      // Transcript generation is best-effort. A malformed message/embed must
      // never prevent the actual close operation from completing.
      try {
        try {
          const transcript = await createTranscript(channel);
          if (panel?.logChannelId) {
            const log = await interaction.guild?.channels.fetch(panel.logChannelId).catch(() => null) as TextChannel | null;
            if (log) await log.send({ content: `🎫 Ticket closed: #${channel.name} by <@${interaction.user.id}>`, files: [transcript] });
          }
        } catch (transcriptError) {
          console.error('[Ticket close transcript skipped]', transcriptError);
        }
        ticket.status = 'closed'; ticket.closedBy = interaction.user.id; ticket.closedAt = new Date(); await ticket.save();
      } catch (stateError) {
        console.error('[Ticket close state]', stateError);
      } finally {
        try { await channel.delete('Ticket closed'); }
        catch (deleteError) { console.error('[Ticket close delete]', deleteError); }
      }
    }, 5000);
  }

  public async handleManage(interaction: ButtonInteraction): Promise<any> {
    const ticketId = interaction.customId.replace('ticket_manage_', '');
    const ticket: any = await Ticket.findById(ticketId);
    if (!ticket || ticket.status === 'closed') return interaction.reply({ content: '❌ هذه التذكرة غير متاحة.', ephemeral: true });
    const panel = panelSettings(this.client).find((item) => item.id === ticket.panelId) || panelSettings(this.client).find((item) => item.name === ticket.section);
    const member = interaction.member as GuildMember;
    const isStaff = panel?.staffRoleId ? member.roles.cache.has(panel.staffRoleId) : member.permissions.has(PermissionFlagsBits.ManageChannels);
    if (!isStaff && ticket.userId !== interaction.user.id) return interaction.reply({ content: '❌ ليس لديك صلاحية إدارة هذه التذكرة.', ephemeral: true });
    const menu = new StringSelectMenuBuilder().setCustomId(`ticket_manage_select_${ticketId}`).setPlaceholder('اختر إجراءً...').addOptions(
      { label: '✏️ Rename Ticket', value: 'rename', description: 'Change the ticket channel name' },
      { label: '➕ Add Member', value: 'addmember', description: 'Add a member to this ticket' },
    );
    return interaction.reply({ content: '⚙️ Manage Ticket', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ephemeral: true });
  }
  public async handleManageSelect(interaction: StringSelectMenuInteraction): Promise<any> {
    const ticketId = interaction.customId.replace('ticket_manage_select_', '');
    const ticket: any = await Ticket.findById(ticketId);
    if (!ticket || ticket.status === 'closed') return interaction.reply({ content: '❌ هذه التذكرة غير متاحة.', ephemeral: true });
    const channel = interaction.channel as TextChannel;
    if (interaction.values[0] === 'rename') {
      const modal = new ModalBuilder().setCustomId(`ticket_rename_modal_${ticketId}`).setTitle('Rename Ticket').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('ticket_new_name').setLabel('New ticket name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90).setValue(channel.name)));
      return interaction.showModal(modal);
    }
    const userMenu = new UserSelectMenuBuilder().setCustomId(`ticket_addmember_select_${ticketId}`).setPlaceholder('Select a member').setMinValues(1).setMaxValues(1);
    return interaction.reply({ content: 'Select the member to add:', components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userMenu)], ephemeral: true });
  }
  public async handleRename(interaction: ModalSubmitInteraction): Promise<any> {
    const ticketId = interaction.customId.replace('ticket_rename_modal_', '');
    const ticket: any = await Ticket.findById(ticketId);
    const channel = interaction.channel as TextChannel;
    if (!ticket || !channel) return interaction.reply({ content: '❌ هذه التذكرة غير متاحة.', ephemeral: true });
    const nextName = interaction.fields.getTextInputValue('ticket_new_name').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
    if (!nextName) return interaction.reply({ content: '❌ اسم غير صالح.', ephemeral: true });
    await channel.setName(nextName);
    return interaction.reply({ content: `✅ تم تغيير اسم التذكرة إلى **${nextName}**.` });
  }
  public async handleAddMember(interaction: UserSelectMenuInteraction): Promise<any> {
    const ticketId = interaction.customId.replace('ticket_addmember_select_', '');
    const ticket: any = await Ticket.findById(ticketId);
    const channel = interaction.channel as TextChannel;
    const userId = interaction.values[0];
    if (!ticket || !channel || !userId) return interaction.reply({ content: '❌ هذه التذكرة غير متاحة.', ephemeral: true });
    await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
    return interaction.reply({ content: `✅ تمت إضافة <@${userId}> إلى التذكرة.` });
  }
}
