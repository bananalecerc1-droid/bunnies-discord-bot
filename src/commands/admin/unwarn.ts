import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
    PermissionFlagsBits
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';
import { Warning } from '../../models/Warning';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface UnwarnCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

interface LocaleData {
    commands: {
        unwarn: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            commandError: string;
            userNotFound: string;
            noWarnings: string;
            invalidWarningId: string;
            cantUnwarnSelf: string;
            cantUnwarnOwner: string;
            cantUnwarnHigher: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            unwarnedBy: string;
            target: string;
            warningRemoved: string;
            invalidFormat: string;
        }
    }
}

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.unwarn) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.unwarn) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.unwarn) {
        locale = {
            commands: {
                unwarn: {
                    title: "Warning Removed",
                    description: "A warning has been removed from a member",
                    success: "Successfully removed warning",
                    error: "Failed to remove warning",
                    noPermission: "You do not have permission to use this command.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    noWarnings: "This user has no warnings",
                    invalidWarningId: "Invalid warning number. Use !warns to see warning numbers.",
                    cantUnwarnSelf: "You cannot remove your own warnings.",
                    cantUnwarnOwner: "You cannot remove the server owner's warnings.",
                    cantUnwarnHigher: "You cannot remove warnings from a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    unwarnedBy: "Warning removed by {user}",
                    target: "User",
                    warningRemoved: "Warning #{number}",
                    invalidFormat: "Invalid format. Use: !unwarn @user [warning number] [reason]"
                }
            }
        };
    }
    
    return locale;
};

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.unwarn as UnwarnCommandSettings,
        PermissionFlagsBits.ModerateMembers
    );
};

export const data = new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Removes a warning from a member')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The member to remove warning from')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option
            .setName('warning')
            .setDescription('The warning number to remove (see !warns)')
            .setRequired(true)
            .setMinValue(1)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for removing the warning')
            .setRequired(false)
    );

export const command: Command = {
    name: 'unwarn',
    enabled: true,
    aliases: ['unwarn', 'removewarn', 'delwarn'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.unwarn.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            let targetMember: GuildMember | null | undefined;
            let warningNumber: number;
            let reason: string | null = null;

            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                warningNumber = interaction.options.getInteger('warning', true);
                reason = interaction.options.getString('reason');
                targetMember = targetUser 
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            } else {
                if (args.length < 2) {
                    await (interaction as Message).reply(locale.commands.unwarn.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                warningNumber = parseInt(args[1]);
                if (isNaN(warningNumber)) {
                    await (interaction as Message).reply(locale.commands.unwarn.invalidWarningId);
                    return;
                }
                reason = args.slice(2).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }

            if (!targetMember) {
                const reply = { content: locale.commands.unwarn.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const warnings = await Warning.find({
                guildId: guild?.id,
                userId: targetMember.id
            }).sort({ timestamp: -1 });

            if (warnings.length === 0) {
                const reply = { content: locale.commands.unwarn.noWarnings, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (warningNumber < 1 || warningNumber > warnings.length) {
                const reply = { content: locale.commands.unwarn.invalidWarningId, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const warningToRemove = warnings[warningNumber - 1];

            await Warning.findByIdAndDelete(warningToRemove._id);

            const embed = new EmbedBuilder()
                .setTitle(locale.commands.unwarn.title)
                .setDescription(locale.commands.unwarn.description)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: `👤 ${locale.commands.unwarn.target}`,
                        value: targetMember.toString(),
                        inline: true
                    },
                    {
                        name: `⚠️ ${locale.commands.unwarn.warningRemoved.replace('{number}', warningNumber.toString())}`,
                        value: warningToRemove.reason,
                        inline: true
                    },
                    {
                        name: `📝 ${locale.commands.unwarn.reason}`,
                        value: reason || locale.commands.unwarn.noReason,
                        inline: false
                    }
                )
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setFooter({ 
                    text: locale.commands.unwarn.unwarnedBy.replace(
                        '{user}', 
                        isSlash ? interaction.user.tag : (interaction as Message).author.tag
                    )
                })
                .setTimestamp();

            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            } else {
                await (interaction as Message).reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error executing unwarn command:', error);
            const errorMessage = { 
                content: locale.commands.unwarn.commandError,
                flags: 1 << 6
            };
            
            if (interaction instanceof ChatInputCommandInteraction) {
                if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                } else {
                    await interaction.followUp(errorMessage);
                }
            } else {
                await (interaction as Message).reply(errorMessage.content);
            }
        }
    }
}; 
