import {
    CategoryChannel,
    GuildChannel,
    GuildEmoji,
    GuildMember,
    Message,
    Role,
    ThreadChannel,
    VoiceChannel
} from "discord.js";
import client from "../client";
import {existingCommands} from "./CommandsDescription";
import Command from "./Command";
import {isNumber,durationUnits,durationUnitsMult} from "./OtherFunctions";

export const extractTypes = {
    channel: (field, message: Message): GuildChannel|ThreadChannel|VoiceChannel|false => {
        if (message.guild == null) return false;
        let channelId = field.split("<#")[1];
        channelId = channelId.substring(0,channelId.length-1);
        const channel = message.guild.channels.cache.get(channelId);
        return channel != undefined ? channel : false;
    },
    channels: (field, message: Message): Array<GuildChannel|ThreadChannel|VoiceChannel>|false => {
        const channelsMentions = field.split(",");
        const channels: Array<GuildChannel|ThreadChannel> = [];
        for (const channelMention of channelsMentions) {
            const AChannel = extractTypes.channel(channelMention.trim(), message);
            if (!AChannel) return false;
            channels.push(AChannel);
        }
        return channels;
    },
    category: (field, message: Message): CategoryChannel|boolean => {
        if (message.guild == null) return false;
        const channel = message.guild.channels.cache.get(field);
        return (channel instanceof CategoryChannel && channel.type == "GUILD_CATEGORY") ? channel : false;
    },
    message: async (field, _: Message, channel: GuildChannel|boolean): Promise<Message|false> => {
        if (channel) {
            try { // @ts-ignore
                return await channel.messages.fetch(field.toString())
            } catch (e) {
                return false;
            }
        }
        return false;
    },
    messages: async (field, message: Message, channel: GuildChannel|boolean):  Promise<Array<Message>|false> => {
        const messagesIds = field.split(",");
        const messages: Array<Message> = [];
        for (const messageId of messagesIds) {
            const AMessage = await extractTypes.message(messageId.trim(), message, channel);
            if (!AMessage) return false;
            messages.push(AMessage);
        }
        return messages;
    },
    listenerReactMessage: async (field, message: Message): Promise<{channel: GuildChannel, message: Message}|false> => {
        const channelMention = field.split("/")[0];
        const channel: GuildChannel|ThreadChannel|boolean = extractTypes.channel(channelMention, message);
        let messageToGet: Message|null = null
        if (channel instanceof GuildChannel) {
            const messageId = field.split("/")[1].replaceAll(" ","");
            // @ts-ignore
            messageToGet = await extractTypes.message(messageId,message,channel);
        } else {
            return false;
        }
        return messageToGet ? {message: messageToGet,channel} : false;
    },
    emote: (field, _: Message): GuildEmoji|false => {
        if (new RegExp("^[^\u0000-\u007F]+$").test(field)) return field;
        const emoteId = field.split(":")[2].split(">")[0];
        const emote = client.emojis.cache.get(emoteId);
        return emote ? emote : false;
    },
    user: async (field, message: Message): Promise<GuildMember|false> => {
        if (message.guild == null) return false;
        let userId = field.split("<@")[1].split(">")[0];
        if (userId[0] == "!") userId = userId.substring(1);
        try {
            return await message.guild.members.fetch(userId);
        } catch(e) {
            return false;
        }
    },
    users: async (field, message: Message): Promise<Array<GuildMember>|false> => {
        const userMentions = field.split(",");
        const users: Array<GuildMember> = [];
        for (const userMention of userMentions) {
            const AUser = await extractTypes.user(userMention.trim(), message);
            if (!AUser) return false;
            users.push(AUser);
        }
        return users;
    },
    role: (field, message: Message): Role|false => {
        if (message.guild == null) return false;
        const roleId = field.split("<@&")[1].split(">")[0];
        const role = message.guild.roles.cache.get(roleId);
        return role ?? false;
    },
    roles: (field, message: Message): Array<Role>|false => {
        if (field.length-field.replace(",","") == 0) return [];

        const roles: Array<Role> = [];
        const rolesMentions = field.split(",");
        for (const roleMention of rolesMentions) {
            const role = extractTypes.role(roleMention.trim(), message);
            if (!(role instanceof Role)) return false;
            roles.push(role);
        }
        return roles;
    },
    command: async (field, message: Message): Promise<typeof Command|false>=> {
        const commandList: typeof Command[] = Object.values(existingCommands);
        let commandFound: typeof Command|false = false;
        for (const command of commandList) {
            if (command.commandName === field && command.display && await command.staticCheckPermissions(message,false)) {
                commandFound = command;
                break;
            }
        }
        return commandFound;
    },
    commands: async (field, message: Message): Promise<typeof Command[]|false> => {
        let commands: typeof Command[] = [];
        for (let commandName of field.split(",")) {
            commandName = commandName.trim();
            const command = await extractTypes.command(commandName,message);
            if (!command) return false;
            commands.push(command);
        }
        return commands;
    },
    duration: (field,_) => {
        if (field === 0 || (typeof(field) == "string" && parseInt(field) === 0)) return 0;
        const unitByName = Object.entries(durationUnits).reduce((acc,[key,values]) => ({
                ...acc,
                ...values.reduce((acc, value) => ({
                    ...acc,
                    [value]: key
                }), {})
            }), {});

        let ms = 0;
        let i=0;
        while (i<field.length) {
            while (field[i] === " ") {
                i++
            }
            let numStr = ''
            while (isNumber(field[i])) {
                numStr += field[i];
                i++;
            }
            while (field[i] === " ") {
                i++
            }
            let unitName = ''
            while (i<field.length && field[i] !== " " && !isNumber(field[i])) {
                unitName += field[i];
                i++;
            }
            ms += parseInt(numStr)*durationUnitsMult[unitByName[unitName]]
        }

        return ms;
    }
};
