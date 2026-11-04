import { Interaction } from 'discord.js';
import { ModBot } from '../types/ModBot';
import { TicketManager } from '../ticket/ticketManager';
import { SelectRoleManager } from '../selectRoles/selectRoleManager';

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction: Interaction, client: ModBot): Promise<void> {
    try {
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            const ticketManager = new TicketManager(client);
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select_')) { await ticketManager.handleSelect(interaction); return; }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_open_')) { await ticketManager.handleOpen(interaction); return; }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_claim_')) { await ticketManager.handleClaim(interaction); return; }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_close_')) { await ticketManager.handleClose(interaction); return; }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_manage_')) { await ticketManager.handleManage(interaction); return; }
            if (interaction.isButton() && (interaction.customId === 'ticket_create' || interaction.customId.startsWith('ticket_create_'))) { await ticketManager.handleOpen(interaction); return; }
            if (interaction.customId.startsWith('selectrole_')) { await new SelectRoleManager(client).handleInteraction(interaction); return; }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (interaction.isRepliable() && !interaction.replied) await interaction.reply({ content: '❌ An error occurred while processing your request.', ephemeral: true }).catch(() => null);
    }
}
