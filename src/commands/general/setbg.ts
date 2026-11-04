import { ChatInputCommandInteraction, Message, MessageFlags, SlashCommandBuilder } from 'discord.js';
import sharp from 'sharp';
import { Command } from '../../interfaces/Command';
import { UserRankBackground } from '../../models/UserRankBackground';

export const data = new SlashCommandBuilder()
    .setName('setbg')
    .setDescription('Upload a custom background image for your rank card')
    .addAttachmentOption(option => option.setName('image').setDescription('PNG, JPG, GIF, or WEBP under 8MB').setRequired(true));

export const command: Command = {
    name: 'setbg',
    enabled: true,
    aliases: ['setbg'],
    async execute(interaction: ChatInputCommandInteraction | Message, _args: string[], _client: any) {
        if (!(interaction instanceof ChatInputCommandInteraction)) {
            await (interaction as Message).reply('Use `/setbg` with an image attachment.');
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const attachment = interaction.options.getAttachment('image', true);
        const isImage = Boolean(attachment.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)(?:\?|$)/i.test(attachment.name));
        if (!isImage) { await interaction.editReply('Please upload a valid PNG, JPG, GIF, or WEBP image.'); return; }
        if (attachment.size > 8 * 1024 * 1024) { await interaction.editReply('Image is too large. Please use an image under 8MB.'); return; }
        try {
            const response = await fetch(attachment.url);
            if (!response.ok) throw new Error(`Download failed (${response.status})`);
            const source = Buffer.from(await response.arrayBuffer());
            const resized = await sharp(source).resize(800, 260, { fit: 'cover' }).png().toBuffer();
            await UserRankBackground.findOneAndUpdate(
                { userId: interaction.user.id },
                { data: { base64: resized.toString('base64') }, updatedAt: new Date() },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            await interaction.editReply('Your rank card background has been updated. Use `/rank` to see it.');
        } catch (error) {
            console.error('[setbg] Failed to save background:', error);
            await interaction.editReply('Failed to save the background. Please try another image.');
        }
    }
};
