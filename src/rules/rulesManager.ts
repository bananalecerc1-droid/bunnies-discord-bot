import { 
    TextChannel, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    StringSelectMenuBuilder,
    ButtonStyle,
    ButtonInteraction,
    StringSelectMenuInteraction
} from 'discord.js';
import { ModBot } from '../types/ModBot';
import { RuleSection } from '../types/RuleSection';

const BUTTON_ROW_LIMIT = 5;
const SELECT_MENU_LIMIT = 25;

export class RulesManager {
    constructor(private client: ModBot) {}

    public async setupSystem(channel: TextChannel): Promise<void> {
        try {
            const settings = this.client.settings.rules;
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.rules;

            if (!settings.enabled) {
                throw new Error(locale?.messages?.disabled || 'Rules system is disabled');
            }

            const mainEmbed = this.createMainEmbed();
            const components = this.createRuleComponents();

            await channel.send({
                embeds: [mainEmbed],
                components
            });

        } catch (error) {
            console.error('Error setting up rules system:', error);
            throw error;
        }
    }

    private createMainEmbed(): EmbedBuilder {
        const settings = this.client.settings.rules;
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.rules;

        const embed = new EmbedBuilder()
            .setTitle(settings.mainEmbed.title || locale?.embeds?.main?.title || 'Server Rules')
            .setDescription(settings.mainEmbed.description || locale?.embeds?.main?.description || 'Please read our server rules')
            .setColor(settings.mainEmbed.color as `#${string}`)
            .setTimestamp(settings.mainEmbed.timestamp ? new Date() : null);

        if (settings.mainEmbed.thumbnail?.enabled) {
            embed.setThumbnail(settings.mainEmbed.thumbnail.url);
        }

        if (settings.mainEmbed.image?.enabled) {
            embed.setImage(settings.mainEmbed.image.url);
        }

        if (settings.mainEmbed.footer) {
            embed.setFooter({
                text: settings.mainEmbed.footer.text,
                iconURL: settings.mainEmbed.footer.iconUrl
            });
        }

        return embed;
    }

    private createRuleComponents(): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
        const settings = this.client.settings.rules;
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.rules;

        if (settings.interface.type === 'select') {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('rules_select')
                .setPlaceholder(locale?.select?.placeholder || 'Select a rule section')
                .setMaxValues(1);

            settings.sections
                .filter((section: RuleSection) => section.enabled)
                .slice(0, SELECT_MENU_LIMIT)
                .forEach((section: RuleSection) => {
                    selectMenu.addOptions({
                        label: section.name,
                        value: `rules_view_${section.name.toLowerCase().replace(/\s+/g, '_')}`,
                        description: section.description,
                        emoji: section.emoji
                    });
                });

            return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)];
        }

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();
        let buttonCount = 0;

        settings.sections
            .filter((section: RuleSection) => section.enabled)
            .forEach((section: RuleSection) => {
                if (buttonCount >= BUTTON_ROW_LIMIT) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder<ButtonBuilder>();
                    buttonCount = 0;
                }

                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rules_view_${section.name.toLowerCase().replace(/\s+/g, '_')}`)
                        .setLabel(section.name)
                        .setEmoji(section.emoji)
                        .setStyle(ButtonStyle.Primary)
                );

                buttonCount++;
            });

        if (buttonCount > 0) {
            rows.push(currentRow);
        }

        return rows;
    }

    public async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.rules;
        
        try {
            const settings = this.client.settings.rules;
            let sectionName: string;

            if (interaction.isButton()) {
                sectionName = interaction.customId.replace('rules_view_', '');
            } else {
                sectionName = interaction.values[0].replace('rules_view_', '');
            }

            const section = settings.sections.find((s: RuleSection) => 
                s.name.toLowerCase().replace(/\s+/g, '_') === sectionName
            );

            if (!section || !section.enabled) {
                await interaction.reply({
                    content: locale?.messages?.invalidSection || '❌ Invalid rules section',
                    ephemeral: true
                });
                return;
            }

            const embed = this.createSectionEmbed(section);

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error handling rules interaction:', error);
            await interaction.reply({
                content: locale?.messages?.error?.view || '❌ An error occurred while viewing the rules.',
                ephemeral: true
            });
        }
    }

    private createSectionEmbed(section: RuleSection): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setTitle(`${section.emoji} ${section.name}`)
            .setDescription(Array.isArray(section.rules) ? section.rules.join('\n\n') : section.rules)
            .setColor(section.embed.color as `#${string}`)
            .setTimestamp();

        if (section.embed.thumbnail?.enabled) {
            embed.setThumbnail(section.embed.thumbnail.url);
        }

        if (section.embed.image?.enabled) {
            embed.setImage(section.embed.image.url);
        }

        if (section.embed.footer) {
            embed.setFooter({
                text: section.embed.footer.text,
                iconURL: section.embed.footer.iconUrl
            });
        }

        return embed;
    }
} 
