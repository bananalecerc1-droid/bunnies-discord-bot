import { 
    TextChannel, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ModalSubmitInteraction,
    time,
    TimestampStyles,
    GuildMember
} from 'discord.js';
import { ModBot } from '../types/ModBot';
import { Application, IApplication } from '../models/Application';
import { createHash } from 'crypto';
import { Position } from '../types/Position';

export class ApplicationManager {
    constructor(private client: ModBot) {}

    private generatePositionId(name: string): string {
        return createHash('md5').update(name.trim().toLowerCase()).digest('hex').substring(0, 8);
    }

    public async setupSystem(channel: TextChannel): Promise<void> {
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            
            const applicationLogs = messages.filter(msg => {
                return msg.components.some(component => {
                    if (!('components' in component)) return false;

                    return component.components.some(child => {
                        if (!('customId' in child) || typeof child.customId !== 'string') {
                            return false;
                        }

                        return child.customId.startsWith('apply_accept_') ||
                               child.customId.startsWith('apply_reject_');
                    });
                });
            });

            const settings = this.client.settings.apply;
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.apply;
            
            const embedColor = settings.embed?.color || '#2f3136';
            const formattedColor = embedColor.toString().startsWith('#') ? embedColor : `#${embedColor}`;

            const embed = new EmbedBuilder()
                .setTitle(locale?.embeds?.main?.title || 'Staff Applications')
                .setDescription(locale?.embeds?.main?.description || 'Click the buttons below to apply for staff positions')
                .setColor(formattedColor as `#${string}`);

            const enabledPositions = settings.positions.filter((p: Position) => p.enabled);
            
            if (enabledPositions.length > 0) {
                const availablePositionsText = enabledPositions
                    .map((p: Position) => `${p.emoji} **${p.name}**\n${p.description || ''}`)
                    .join('\n\n');
                
                embed.addFields({
                    name: locale?.embeds?.main?.positions || 'Available Positions',
                    value: availablePositionsText
                });
            }

            if (settings.globalRequirements) {
                const requirements = [
                    settings.globalRequirements.minimumAge ? `• Account Age: ${settings.globalRequirements.minimumAge} days` : null,
                    settings.globalRequirements.minimumGuildAge ? `• Server Age: ${Math.floor(settings.globalRequirements.minimumGuildAge / 86400000)} days` : null,
                ].filter(Boolean).join('\n');

                if (requirements) {
                    embed.addFields({
                        name: locale?.embeds?.main?.requirements || 'General Requirements',
                        value: requirements
                    });
                }
            }

            if (settings.cooldown) {
                const cooldownDays = Math.floor(settings.cooldown / 86400000);
                embed.addFields({
                    name: locale?.embeds?.main?.cooldown || 'Application Cooldown',
                    value: locale?.embeds?.main?.cooldownValue?.replace('{days}', cooldownDays.toString()) || 
                           `You must wait ${cooldownDays} days between applications`
                });
            }

            if (settings.embed?.thumbnail) {
                embed.setThumbnail(settings.embed.thumbnail);
            }

            if (settings.embed?.footer) {
                embed.setFooter({ 
                    text: settings.embed.footer,
                    iconURL: settings.embed?.footerIcon
                });
            }

            if (settings.embed?.timestamp) {
                embed.setTimestamp();
            }

            await channel.send({
                embeds: [embed],
                components: this.createApplicationButtons()
            });

            for (const [_, message] of applicationLogs) {
                if (message.embeds[0]) {
                    const footerText = message.embeds[0].footer?.text || '';
                    const applicationId = footerText.split(':')[1]?.trim();

                    if (applicationId) {
                        const application = await Application.findById(applicationId);
                        if (application && application.status === 'pending') {
                            await message.edit({
                                components: [this.createReviewButtons(applicationId)]
                            });
                        } else if (application) {
                            await message.edit({ components: [] });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error setting up application system:', error);
            throw error;
        }
    }

    public createApplicationButtons(): ActionRowBuilder<ButtonBuilder>[] {
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.apply?.buttons;
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const buttons: ButtonBuilder[] = [];

        const enabledPositions = this.client.settings.apply.positions.filter((p: Position) => p.enabled);
        
        enabledPositions.forEach((position: Position, index: number) => {
            const positionId = this.generatePositionId(position.name);
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`apply_${positionId}`)
                    .setLabel(locale?.apply?.replace('{position}', position.name) || `Apply for ${position.name}`)
                    .setEmoji(position.emoji || '📝')
                    .setStyle(ButtonStyle.Primary)
            );

            if (buttons.length === 5 || index === enabledPositions.length - 1) {
                rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.splice(0, 5)));
            }
        });

        return rows;
    }

    public createReviewButtons(applicationId: string): ActionRowBuilder<ButtonBuilder> {
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.apply;
        
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`apply_accept_${applicationId}`)
                    .setLabel(locale?.buttons?.accept || 'Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`apply_reject_${applicationId}`)
                    .setLabel(locale?.buttons?.reject || 'Reject')
                    .setStyle(ButtonStyle.Danger)
            );
    }

    private createApplicationEmbed(application: IApplication, position: Position, showReviewer: boolean = false): EmbedBuilder {
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.apply;
        const settings = this.client.settings.apply;

        const embed = new EmbedBuilder()
            .setColor(position.color as `#${string}`)
            .setTitle(locale?.embeds?.application?.title?.replace('{position}', position.name) || `Application for ${position.name}`)
            .setThumbnail(settings.embed?.thumbnail || null);

        const statusEmoji = application.status === 'accepted' ? '✅' : 
                           application.status === 'rejected' ? '❌' : '⏳';
        
        embed.addFields([
            { 
                name: '👤 ' + (locale?.embeds?.log?.applicant || 'Applicant'), 
                value: `<@${application.userId}>`, 
                inline: true 
            },
            { 
                name: '⏰ ' + (locale?.embeds?.log?.appliedAt || 'Applied At'), 
                value: time(application.appliedAt, TimestampStyles.RelativeTime), 
                inline: true 
            },
            { 
                name: statusEmoji + ' ' + (locale?.embeds?.log?.status || 'Status'), 
                value: application.status === 'accepted' 
                    ? (locale?.embeds?.log?.accepted || '✅ Accepted')
                    : application.status === 'rejected'
                    ? (locale?.embeds?.log?.rejected || '❌ Rejected')
                    : (locale?.embeds?.log?.pending || '⏳ Pending Review'), 
                inline: true 
            }
        ]);

        if (showReviewer && application.reviewedBy) {
            embed.addFields({
                name: '👨‍💼 ' + (application.status === 'accepted' 
                    ? (locale?.embeds?.log?.acceptedBy || 'Accepted By')
                    : (locale?.embeds?.log?.rejectedBy || 'Rejected By')),
                value: `<@${application.reviewedBy}>`
            });

            if (application.status === 'rejected' && application.reviewNote) {
                embed.addFields({
                    name: '📝 ' + (locale?.embeds?.log?.reason || 'Reason'),
                    value: application.reviewNote
                });
            }
        }

        embed.addFields({ name: '\u200b', value: '📋 **Application Responses**' });

        position.questions.forEach((_: string, index: number) => {
            embed.addFields({
                name: `${index + 1}. ${position.questions[index]}`,
                value: application.answers[index] || 'No answer provided'
            });
        });

        if (settings.embed?.footer) {
            embed.setFooter({ 
                text: (locale?.embeds?.application?.footer || 'Application ID: {id}')
                    .replace('{id}', application._id.toString()),
                iconURL: settings.embed?.footerIcon
            });
        }

        if (settings.embed?.timestamp) {
            embed.setTimestamp();
        }

        return embed;
    }

    public async handleButton(interaction: ButtonInteraction): Promise<void> {
        try {
            const settings = this.client.settings.apply;
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.apply;

            const positionId = interaction.customId.replace('apply_', '');
            const position = settings.positions.find(
                (p: Position) => this.generatePositionId(p.name) === positionId
            );

            if (!position || !position.enabled) {
                await interaction.reply({
                    content: locale?.messages?.invalidPosition || '❌ Invalid position selected',
                    ephemeral: true
                });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId(`apply_modal_${positionId}`)
                .setTitle(`Apply for ${position.name}`);

            const components = position.questions.map((question: string, index: number) => 
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`question_${index}`)
                        .setLabel(question)
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1024)
                )
            );

            modal.addComponents(components);
            await interaction.showModal(modal);

        } catch (error) {
            console.error('Error handling apply button:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing your application.',
                ephemeral: true
            });
        }
    }

    public async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
        try {
            const settings = this.client.settings.apply;
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.apply;

            const modalPositionId = interaction.customId.replace('apply_modal_', '');
            const position = settings.positions.find((p: Position) => 
                this.generatePositionId(p.name) === modalPositionId
            );

            if (!position) {
                await interaction.reply({
                    content: locale?.messages?.invalidPosition || '❌ Invalid position selected',
                    ephemeral: true
                });
                return;
            }

            const answers = position.questions.map((_: string, index: number) => 
                interaction.fields.getTextInputValue(`question_${index}`)
            );

            const applicationPositionId = this.generatePositionId(position.name);
            const application = await Application.create({
                userId: interaction.user.id,
                guildId: interaction.guildId,
                channelId: position.logChannel,
                position: applicationPositionId,
                status: 'pending',
                answers,
                appliedAt: new Date()
            });

            const logChannel = await this.client.channels.fetch(position.logChannel) as TextChannel;
            const message = await logChannel.send({
                embeds: [this.createApplicationEmbed(application, position)],
                components: [this.createReviewButtons(application._id.toString())]
            });

            application.messageId = message.id;
            await application.save();

            await interaction.reply({
                content: locale?.messages?.success || '✅ Application submitted successfully!',
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in handleModal:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing your application.',
                ephemeral: true
            });
        }
    }

    public async handleReview(interaction: ButtonInteraction): Promise<void> {
        try {
            if (!interaction.isRepliable()) {
                return;
            }

            const settings = this.client.settings.apply;
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.apply;

            const applicationId = interaction.customId.split('_')[2];
            const application = await Application.findOne({ 
                _id: applicationId,
                status: 'pending'
            });

            if (!application) {
                await interaction.reply({
                    content: locale?.messages?.applicationNotFound || '❌ Application not found',
                    ephemeral: true
                });
                return;
            }

            const position = settings.positions.find((p: Position) => 
                this.generatePositionId(p.name) === application.position
            );

            if (!position) {
                await interaction.reply({
                    content: locale?.messages?.invalidPosition || '❌ Invalid position selected',
                    ephemeral: true
                });
                return;
            }

            const member = interaction.member as GuildMember;
            const hasPermission = position.reviewers.roles.some((roleId: string) => 
                member.roles.cache.has(roleId)
            );

            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.noPermission || '❌ You do not have permission to review applications for this position',
                    ephemeral: true
                });
                return;
            }

            if (interaction.customId === `apply_accept_${applicationId}`) {
                application.status = 'accepted';
                application.reviewedBy = interaction.user.id;
                application.reviewedAt = new Date();
                await application.save();

                const updatedEmbed = this.createApplicationEmbed(application, position, true);
                await interaction.message.edit({
                    embeds: [updatedEmbed],
                    components: []
                });

                try {
                    const applicant = await interaction.guild?.members.fetch(application.userId);
                    if (applicant) {
                        if (position.acceptRoles?.length > 0) {
                            for (const roleId of position.acceptRoles) {
                                await applicant.roles.add(roleId).catch(error => {
                                    console.error(`Failed to add role ${roleId}:`, error);
                                });
                            }
                        }

                        const acceptMessage = position.acceptMessage || 
                            locale?.messages?.accepted?.replace('{position}', position.name) || 
                            `🎉 Congratulations! Your ${position.name} application has been accepted!`;
                        
                        await applicant.send({ content: acceptMessage }).catch(() => {
                            console.log('Could not DM user about acceptance');
                        });
                    }
                } catch (error) {
                    console.error('Error handling acceptance:', error);
                }

                await interaction.reply({
                    content: `✅ Application for ${position.name} accepted and roles assigned`,
                    ephemeral: true
                });
            } else if (interaction.customId === `apply_reject_${applicationId}`) {
                const modal = new ModalBuilder()
                    .setCustomId(`apply_reject_${applicationId}`)
                    .setTitle(locale?.modals?.reject?.title || 'Reject Application');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reject_reason')
                    .setLabel(locale?.modals?.reject?.label || 'Reason for rejection')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(locale?.modals?.reject?.placeholder || 'Enter the reason for rejecting this application...')
                    .setRequired(true)
                    .setMaxLength(1000);

                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
                await interaction.showModal(modal);
            }
        } catch (error) {
            console.error('Error handling review:', error);
            if (interaction.isRepliable()) {
                await interaction.reply({
                    content: '❌ An error occurred while processing the review.',
                    ephemeral: true
                }).catch(() => {
                    console.log('Could not send error message - interaction may have expired');
                });
            }
        }
    }

    public async handleReject(interaction: ModalSubmitInteraction): Promise<void> {
        try {
            const settings = this.client.settings.apply;
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.apply;

            const applicationId = interaction.customId.replace('apply_reject_', '');
            const application = await Application.findOne({ 
                _id: applicationId,
                status: 'pending'
            });

            if (!application) {
                await interaction.reply({
                    content: locale?.messages?.applicationNotFound || '❌ Application not found',
                    ephemeral: true
                });
                return;
            }

            const position = settings.positions.find((p: Position) => 
                this.generatePositionId(p.name) === application.position
            );

            if (!position) {
                await interaction.reply({
                    content: locale?.messages?.invalidPosition || '❌ Invalid position selected',
                    ephemeral: true
                });
                return;
            }

            const reason = interaction.fields.getTextInputValue('reject_reason');

            application.status = 'rejected';
            application.reviewedBy = interaction.user.id;
            application.reviewedAt = new Date();
            application.reviewNote = reason;
            await application.save();

            const updatedEmbed = this.createApplicationEmbed(application, position, true);
            if (application.messageId && interaction.channel) {
                try {
                    const message = await interaction.channel.messages.fetch(application.messageId);
                    if (message) {
                        await message.edit({ 
                            embeds: [updatedEmbed],
                            components: [] 
                        });
                    }
                } catch (error) {
                    console.error('Error updating application message:', error);
                }
            }

            try {
                const applicant = await interaction.guild?.members.fetch(application.userId);
                if (applicant) {
                    const dmContent = locale?.messages?.rejected
                        ?.replace('{position}', position.name)
                        ?.replace('{reason}', reason) || 
                        `Your application for ${position.name} has been rejected.\nReason: ${reason}`;
                    
                    await applicant.send({ content: dmContent }).catch(() => {
                        console.log('Could not DM user about rejection');
                    });
                }
            } catch (error) {
                console.error('Error notifying applicant:', error);
            }

            await interaction.reply({
                content: locale?.messages?.rejectionSent?.replace('{position}', position.name) || 
                        `✅ Application for ${position.name} rejected`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error handling rejection:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the rejection.',
                ephemeral: true
            });
        }
    }

    public async getSystemStatus() {
        const total = await Application.countDocuments();
        const pending = await Application.countDocuments({ status: 'pending' });
        const accepted = await Application.countDocuments({ status: 'accepted' });
        const rejected = await Application.countDocuments({ status: 'rejected' });

        return {
            total,
            pending,
            accepted,
            rejected
        };
    }

    public async clearApplications() {
        await Application.deleteMany({});
    }
} 
