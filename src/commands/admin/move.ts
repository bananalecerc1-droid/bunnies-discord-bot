import { Command } from '../../interfaces/Command';
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    GuildMember,
    Message,
    PermissionFlagsBits,
} from 'discord.js';
import settings from '../../../settings.json';
import { checkCommandPermissions } from '../../utils/permissionChecker';

interface CommandPermissions {
    enabledRoleIds: string[];
    disabledRoleIds: string[];
}

interface MoveCommandSettings {
    permissions: CommandPermissions;
    enabled: boolean;
    aliases: string[];
    cooldown: number;
}

const checkPermissions = (member: GuildMember): boolean => {
    return checkCommandPermissions(
        member,
        settings.commands?.move as MoveCommandSettings,
        PermissionFlagsBits.MoveMembers
    );
};

export const data = new SlashCommandBuilder()
    .setName('move')
    .setDescription('Moves a member to your voice channel')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The member to move')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('The reason for moving')
            .setRequired(false)
    );

export const command: Command = {
    name: 'move',
    enabled: true,
    aliases: ['move', 'moveto', 'vcmove'],
    async execute(interaction: ChatInputCommandInteraction | Message, args: string[], client: any) {
        const isSlash = interaction instanceof ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : (interaction as Message).guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);

        try {
            const executingMember = isSlash ? interaction.member as GuildMember : (interaction as Message).member as GuildMember;
            
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = { 
                    content: locale.commands.move.noPermission, 
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                } else {
                    await (interaction as Message).reply(noPermissionMessage.content);
                }
                return;
            }

            if (!executingMember.voice?.channelId) {
                const reply = { content: locale.commands.move.notInVoice, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (!guild?.members.me?.permissions.has(PermissionFlagsBits.MoveMembers)) {
                const reply = { content: locale.commands.move.botNoPermission, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            let targetMember: GuildMember | null | undefined;
            let reason: string | null = null;

            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                reason = interaction.options.getString('reason');
                targetMember = targetUser 
                    ? await guild?.members.fetch(targetUser.id).catch(() => null)
                    : null;
            } else {
                if (args.length < 1) {
                    await (interaction as Message).reply(locale.commands.move.invalidFormat);
                    return;
                }
                const targetId = args[0].replace(/[<@!>]/g, '');
                reason = args.slice(1).join(' ') || null;
                targetMember = await guild?.members.fetch(targetId).catch(() => null);
            }

            if (!targetMember) {
                const reply = { content: locale.commands.move.userNotFound, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const targetVoiceState = targetMember.voice;
            
            if (!targetVoiceState.channelId) {
                const reply = { content: locale.commands.move.targetNotInVoice, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetVoiceState.channelId === executingMember.voice.channelId) {
                const reply = { content: locale.commands.move.alreadyInChannel, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            if (targetMember.roles.highest.position >= executingMember.roles.highest.position && 
                !executingMember.permissions.has(PermissionFlagsBits.Administrator)) {
                const reply = { content: locale.commands.move.cantMoveHigher, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : (interaction as Message).reply(reply.content));
                return;
            }

            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.move.noReason}`;
            const oldChannel = targetVoiceState.channel;
            
            try {
                await targetMember.voice.setChannel(executingMember.voice.channel!, formattedReason);
                
                const embed = new EmbedBuilder()
                    .setTitle(locale.commands.move.title)
                    .setDescription(locale.commands.move.description)
                    .setColor(0x00ff00)
                    .addFields(
                        {
                            name: `👤 ${locale.commands.move.target}`,
                            value: targetMember.toString(),
                            inline: true
                        },
                        {
                            name: `🔊 ${locale.commands.move.from}`,
                            value: oldChannel?.name || 'Unknown',
                            inline: true
                        },
                        {
                            name: `📍 ${locale.commands.move.to}`,
                            value: executingMember.voice.channel!.name,
                            inline: true
                        },
                        {
                            name: `📝 ${locale.commands.move.reason}`,
                            value: reason || locale.commands.move.noReason,
                            inline: false
                        }
                    )
                    .setThumbnail(targetMember.user.displayAvatarURL())
                    .setFooter({ 
                        text: locale.commands.move.requestedBy.replace(
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
            } catch (moveError) {
                console.error('Error moving member:', moveError);
                const reply = { content: locale.commands.move.error, flags: 1 << 6 };
                
                if (isSlash) {
                    const slashInteraction = interaction as ChatInputCommandInteraction;
                    if (!slashInteraction.replied) {
                        await slashInteraction.reply(reply);
                    } else {
                        await slashInteraction.followUp(reply);
                    }
                } else {
                    await (interaction as Message).reply(reply.content);
                }
            }

        } catch (error) {
            console.error('Error executing move command:', error);
            const errorMessage = { 
                content: locale.commands.move.commandError,
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

interface LocaleData {
    commands: {
        move: {
            title: string;
            description: string;
            success: string;
            error: string;
            noPermission: string;
            userNoPermission: string;
            botNoPermission: string;
            commandError: string;
            userNotFound: string;
            notInVoice: string;
            targetNotInVoice: string;
            alreadyInChannel: string;
            cantMoveHigher: string;
            requestedBy: string;
            reason: string;
            noReason: string;
            movedBy: string;
            target: string;
            from: string;
            to: string;
            invalidFormat: string;
        }
    }
}

const getLocale = (client: any, preferredLocale?: string | null): LocaleData => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    
    if (!locale?.commands?.move) {
        locale = client.locales.get(client.defaultLanguage);
    }
    
    if (!locale?.commands?.move) {
        locale = client.locales.get('en');
    }
    
    if (!locale?.commands?.move) {
        locale = {
            commands: {
                move: {
                    title: "Member Moved",
                    description: "A member has been moved to a different voice channel",
                    success: "Successfully moved member",
                    error: "Failed to move member",
                    noPermission: "You do not have permission to use this command.",
                    userNoPermission: "You do not have permission to move this user.",
                    botNoPermission: "I do not have permission to move users.",
                    commandError: "An error occurred while executing the command.",
                    userNotFound: "User not found",
                    notInVoice: "You must be in a voice channel to use this command.",
                    targetNotInVoice: "This user is not in a voice channel.",
                    alreadyInChannel: "This user is already in your voice channel.",
                    cantMoveHigher: "You cannot move a member with a higher role.",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    movedBy: "Moved by {user}",
                    target: "User",
                    from: "From Channel",
                    to: "To Channel",
                    invalidFormat: "Invalid format. Use: !move @user [reason]"
                }
            }
        };
    }
    
    return locale;
}; 
