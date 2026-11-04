import { 
    TextChannel, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ButtonInteraction,
    time,
    TimestampStyles,
    PermissionFlagsBits
} from 'discord.js';
import { ModBot } from '../types/ModBot';
import { Giveaway, IGiveaway } from '../models/Giveaway';

interface GiveawayOptions {
    prize: string;
    duration: number;
    winners: number;
    channel: TextChannel;
    hostId: string;
    requirement?: string;  // Optional requirement text
    color?: string;       // Custom color per giveaway
    thumbnail?: string;   // Custom thumbnail per giveaway
}

const createGiveawayEmbed = (
    client: ModBot,
    options: GiveawayOptions,
    participants: string[] = []
): EmbedBuilder => {
    const settings = client.settings.giveaway;
    const endsAt = Date.now() + options.duration;
    const locale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.embeds;

    if (!locale) {
        console.error(`Failed to find giveaway locale data for ${client.settings.defaultLanguage}`);
        return new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription('Giveaway information unavailable')
            .setColor('#FF0000');
    }

    const description = [
        `> 🎁 **${locale.prize}:** ${options.prize}`,
        `> 👑 **${locale.host}:** <@${options.hostId}>`,
        `> 👥 **${locale.winners}:** ${options.winners}`,
        `> ⏰ **${locale.ends}:** ${time(new Date(endsAt), TimestampStyles.RelativeTime)}`,
        `> 📊 **${locale.entries}:** ${participants.length}`,
        options.requirement ? `\n📝 **${locale.requirement}:**\n${options.requirement}` : '',
        '',
        locale.enterPrompt
    ].filter(Boolean).join('\n');

    const embed = new EmbedBuilder()
        .setTitle(locale.title.replace('{prize}', options.prize.toUpperCase()))
        .setDescription(description)
        .setColor(options.color as `#${string}` || settings.embed.color as `#${string}`)
        .setFooter({ 
            text: `${settings.embed.footer} • ${locale.endsAt}`,
            iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp(endsAt);
    const thumbnail = options.thumbnail || settings.embed.thumbnail;
    if (thumbnail && /^https?:\/\//i.test(thumbnail)) embed.setThumbnail(thumbnail);
    return embed;
};

const createGiveawayButtons = (client: ModBot, isHost: boolean = false): ActionRowBuilder<ButtonBuilder>[] => {
    const settings = client.settings.giveaway;
    const locale = client.locales.get(client.settings.defaultLanguage || 'en')?.giveaway?.buttons;
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    
    const mainRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_enter')
                .setLabel(locale?.enter || settings.buttons.enter)
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('giveaway_leave')
                .setLabel(locale?.leave || settings.buttons.leave)
                .setEmoji('🚪')
                .setStyle(ButtonStyle.Secondary)
        );
    rows.push(mainRow);

    if (isHost) {
        const hostRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_end')
                    .setLabel(locale?.end || settings.buttons.end)
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('giveaway_reroll')
                    .setLabel(locale?.reroll || settings.buttons.reroll)
                    .setEmoji('🎲')
                    .setStyle(ButtonStyle.Secondary)
            );
        rows.push(hostRow);
    }

    return rows;
};

const createEndedGiveawayEmbed = (
    client: ModBot,
    giveaway: IGiveaway,
    winners: string[]
): EmbedBuilder => {
    const settings = client.settings.giveaway;
    const locale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.embeds;

    if (!locale) return new EmbedBuilder(); // Should never happen as we check earlier

    const winnerText = winners.length > 0 
        ? winners.map(id => `> 👑 <@${id}>`).join('\n')
        : `> ❌ ${locale.noWinners}`;

    const embed = new EmbedBuilder()
        .setTitle(locale.endedTitle)
        .setDescription(`
        > 🎁 **${locale.prize}:** ${giveaway.prize}
        > 👤 **${locale.host}:** <@${giveaway.hostId}>
        > 📊 **${locale.totalEntries}:** ${giveaway.participants.length}
        
        **🏆 ${locale.winners}:**
        ${winnerText}
        
        ${winners.length > 0 ? locale.congratulations : locale.betterLuck}`)
        .setColor(settings.embed.color as `#${string}`)
        .setFooter({ 
            text: `${settings.embed.footer} • ${locale.endsAt}`,
            iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();
    const endedThumbnail = settings.embed.thumbnail;
    if (endedThumbnail && /^https?:\/\//i.test(endedThumbnail)) embed.setThumbnail(endedThumbnail);
    return embed;
};

export const createGiveaway = async (
    client: ModBot,
    options: GiveawayOptions
): Promise<IGiveaway> => {
    const embed = createGiveawayEmbed(client, options);
    const buttons = createGiveawayButtons(client, true);

    const message = await options.channel.send({
        embeds: [embed],
        components: buttons
    });

    const giveaway = await Giveaway.create({
        messageId: message.id,
        channelId: options.channel.id,
        guildId: options.channel.guildId,
        hostId: options.hostId,
        prize: options.prize,
        winners: options.winners,
        endsAt: new Date(Date.now() + options.duration),
        participants: []
    });

    setTimeout(() => endGiveaway(client, giveaway), options.duration);

    return giveaway;
};

export const endGiveaway = async (
    client: ModBot,
    giveaway: IGiveaway
): Promise<void> => {
    try {
        if (giveaway.ended) return;

        const channel = await client.channels.fetch(giveaway.channelId) as TextChannel;
        if (!channel) return;

        const message = await channel.messages.fetch(giveaway.messageId);
        if (!message) return;

        const freshGiveaway = await Giveaway.findById(giveaway._id);
        if (!freshGiveaway) return;

        const winners = freshGiveaway.participants.length > 0 
            ? selectWinners(freshGiveaway.participants, freshGiveaway.winners)
            : [];
        
        freshGiveaway.ended = true;
        freshGiveaway.winnerIds = winners;
        await freshGiveaway.save();

        const locale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.embeds;
        if (!locale) return;

        await message.edit({
            embeds: [createEndedGiveawayEmbed(client, freshGiveaway, winners)],
            components: []
        });

        if (winners.length > 0) {
            const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
            await channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(locale.winnerAnnouncement.title)
                        .setDescription(
                            locale.winnerAnnouncement.description
                                .replace('{winners}', winnerMentions)
                                .replace('{prize}', freshGiveaway.prize)
                                .replace('{host}', `<@${freshGiveaway.hostId}>`)
                        )
                        .setColor('#FFD700')
                        .setTimestamp()
                ],
                content: `${winnerMentions}`,
                allowedMentions: { users: winners }
            });
        }

    } catch (error) {
        console.error('Error ending giveaway:', error);
    }
};

const selectWinners = (participants: string[], count: number): string[] => {
    if (participants.length === 0) return [];
    
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, Math.min(count, participants.length));
};

export const handleGiveawayButton = async (
    interaction: ButtonInteraction,
    client: ModBot
): Promise<void> => {
    try {
        const locale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.messages;
        if (!locale) {
            console.error(`Failed to find giveaway locale data for ${client.settings.defaultLanguage}`);
            await interaction.reply({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
            });
            return;
        }

        const giveaway = await Giveaway.findOne({ 
            messageId: interaction.message.id,
            ended: false
        });

        if (!giveaway) {
            await interaction.reply({
                content: locale.endedOrDoesNotExist,
                ephemeral: true
            });
            return;
        }

        const userId = interaction.user.id;

        if (interaction.customId === 'giveaway_end' || interaction.customId === 'giveaway_reroll') {
            if (userId !== giveaway.hostId && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({
                    content: locale.onlyHostOrModerators,
                    ephemeral: true
                });
                return;
            }

            if (interaction.customId === 'giveaway_end') {
                await endGiveaway(client, giveaway);
                await interaction.reply({
                    content: locale.endedSuccessfully,
                    ephemeral: true
                });
                return;
            } else {
                const newWinners = selectWinners(giveaway.participants, giveaway.winners);
                if (interaction.channel && 'send' in interaction.channel) {
                    await interaction.channel.send({
                        embeds: [createEndedGiveawayEmbed(client, giveaway, newWinners)],
                        content: `🎲 **${locale?.rerolledWinners || 'Rerolled Winners'}:** ${newWinners.map(id => `<@${id}>`).join(', ')}`
                    });
                }
                await interaction.reply({
                    content: locale.rerolledSuccessfully,
                    ephemeral: true
                });
                return;
            }
        }

        if (client.settings.giveaway.minimumAccountAge && 
            Date.now() - interaction.user.createdTimestamp < client.settings.giveaway.minimumAccountAge) {
            await interaction.reply({
                content: locale.accountAge,
                ephemeral: true
            });
            return;
        }

        if (client.settings.giveaway.minimumGuildAge && interaction.member) {
            const member = await interaction.guild?.members.fetch(userId);
            if (member && Date.now() - member.joinedTimestamp! < client.settings.giveaway.minimumGuildAge) {
                await interaction.reply({
                    content: locale.guildAge,
                    ephemeral: true
                });
                return;
            }
        }

        if (interaction.customId === 'giveaway_enter') {
            if (!giveaway.participants.includes(userId)) {
                giveaway.participants.push(userId);
                await giveaway.save();
                await interaction.reply({
                    content: locale.entered,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: locale.alreadyEntered,
                    ephemeral: true
                });
            }
        } else if (interaction.customId === 'giveaway_leave') {
            if (giveaway.participants.includes(userId)) {
                giveaway.participants = giveaway.participants.filter((id: string) => id !== userId);
                await giveaway.save();
                await interaction.reply({
                    content: locale.left,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: locale.notEntered,
                    ephemeral: true
                });
            }
        }

        const message = interaction.message;
        const embed = EmbedBuilder.from(message.embeds[0].toJSON());
        const embedLocale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.embeds;
        const description = embed.data.description?.replace(
            new RegExp(`📊 \\*\\*${embedLocale?.entries || 'Entries'}:\\*\\* \\d+`),
            `📊 **${embedLocale?.entries || 'Entries'}:** ${giveaway.participants.length}`
        ) || '';
        embed.setDescription(description);

        await message.edit({ embeds: [embed] });

    } catch (error) {
        console.error('Error handling giveaway button:', error);
        const errorMessage = client.locales.get(client.settings.defaultLanguage)?.giveaway?.messages?.error 
            || '❌ An error occurred while processing your request.';
        await interaction.reply({
            content: errorMessage,
            ephemeral: true
        });
    }
};

export { createGiveawayButtons }; 
