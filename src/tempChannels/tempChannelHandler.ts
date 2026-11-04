import { 
    VoiceState, 
    ChannelType, 
    GuildMember, 
    VoiceChannel,
    PermissionsBitField,
    CategoryChannel
} from 'discord.js';
import { ModBot } from '../types/ModBot';

const userChannels = new Map<string, string>();

export const handleVoiceStateUpdate = async (oldState: VoiceState, newState: VoiceState): Promise<void> => {
    const client = newState.client as ModBot;
    const settings = client.settings;
    
    try {
        if (!settings.tempChannels?.enabled) return;
        if (!newState.guild) return;

        const guildLocale = settings.defaultLanguage || 'en';
        const locale = client.locales.get(guildLocale)?.tempChannels;
        if (!locale) return;

        if (newState.channelId === settings.tempChannels.parentChannelId) {
            await handleChannelCreation(newState, settings, locale);
        }

        if (oldState.channel && userChannels.has(oldState.channel.id)) {
            await handleChannelDeletion(oldState, settings, locale);
        }

    } catch (error) {
        console.error('Error handling temp channel:', error);
    }
};

const handleChannelCreation = async (state: VoiceState, settings: any, locale: any): Promise<void> => {
    try {
        if (!hasPermission(state.member!, settings)) {
            await state.member?.send(locale.error.noPermission);
            await state.disconnect();
            return;
        }

        if (!settings.tempChannels.multipleAllowed && hasExistingChannel(state.member!)) {
            await state.member?.send(locale.error.alreadyHasChannel);
            await state.disconnect();
            return;
        }

        const category = state.guild.channels.cache.get(settings.tempChannels.category) as CategoryChannel;
        if (!category) {
            await state.member?.send(locale.error.categoryNotFound);
            await state.disconnect();
            return;
        }

        const channelName = settings.tempChannels.defaultName.replace('{user}', state.member!.displayName);
        const channel = await state.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: category,
            userLimit: settings.tempChannels.defaultUserLimit,
            permissionOverwrites: getChannelPermissions(state.member!, settings)
        });

        await state.setChannel(channel);
        
        userChannels.set(channel.id, state.member!.id);

        await state.member?.send(locale.success.created);

    } catch (error) {
        console.error('Error creating temp channel:', error);
        await state.member?.send(locale.error.createFailed);
        await state.disconnect();
    }
};

const handleChannelDeletion = async (state: VoiceState, settings: any, locale: any): Promise<void> => {
    if (!settings.tempChannels.deleteWhenEmpty) return;
    
    const channel = state.channel as VoiceChannel;
    if (channel.members.size === 0) {
        try {
            const owner = await state.guild.members.fetch(userChannels.get(channel.id)!);
            await owner.send(locale.success.emptied.replace('{time}', (settings.tempChannels.deleteDelay / 1000).toString()));
        } catch (error) {
            console.error('Failed to send deletion warning:', error);
        }

        setTimeout(async () => {
            try {
                if (channel.members.size === 0) {
                    await channel.delete();
                    userChannels.delete(channel.id);
                }
            } catch (error) {
                console.error('Failed to delete temp channel:', error);
            }
        }, settings.tempChannels.deleteDelay);
    }
};

const hasPermission = (member: GuildMember, settings: any): boolean => {
    const { enabledRoleIds, disabledRoleIds } = settings.tempChannels.permissions;
    
    if (disabledRoleIds.some((id: string) => member.roles.cache.has(id))) return false;
    
    if (enabledRoleIds.length > 0) {
        return enabledRoleIds.some((id: string) => member.roles.cache.has(id));
    }
    
    return true;
};

const hasExistingChannel = (member: GuildMember): boolean => {
    return Array.from(userChannels.values()).includes(member.id);
};

const getChannelPermissions = (member: GuildMember, settings: any) => {
    const getPermissionFlags = (perms: string[]) => {
        return perms.map(perm => PermissionsBitField.Flags[perm as keyof typeof PermissionsBitField.Flags]);
    };

    const fullPermissions = [
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ManageRoles,
        PermissionsBitField.Flags.MuteMembers,
        PermissionsBitField.Flags.DeafenMembers,
        PermissionsBitField.Flags.MoveMembers,
        PermissionsBitField.Flags.PrioritySpeaker,
        PermissionsBitField.Flags.Stream,
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
        PermissionsBitField.Flags.UseVAD,
        PermissionsBitField.Flags.ViewChannel
    ];

    const perms = [
        {
            id: member.id,
            allow: settings.tempChannels.fullPermissions 
                ? fullPermissions
                : getPermissionFlags(settings.tempChannels.userPermissions.manage)
        },
        {
            id: member.guild.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.Stream,
                PermissionsBitField.Flags.UseVAD
            ]
        }
    ];

    return perms;
}; 
