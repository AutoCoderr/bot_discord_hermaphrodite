import {
    CategoryChannel, Guild,
    GuildChannel,
    GuildEmoji,
    GuildMember,
    Message,
    Role, TextBasedChannels,
    ThreadChannel, User,
    VoiceChannel
} from "discord.js";
import client from "../client";
import {existingCommands} from "./CommandsDescription";
import Command from "./Command";
import {isNumber,durationUnits,durationUnitsMult} from "./OtherFunctions";

export const extractTypes = {
    channel: (field, command: Command): GuildChannel|ThreadChannel|VoiceChannel|false => {
        if (command.guild == null) return false;
        let channelId = field.split("<#")[1];
        channelId = channelId.substring(0,channelId.length-1);
        const channel = command.guild.channels.cache.get(channelId);
        return channel != undefined ? channel : false;
    },
    channels: (field, command: Command): Array<GuildChannel|ThreadChannel|VoiceChannel>|false => {
        const channelsMentions = field.split(",");
        const channels: Array<GuildChannel|ThreadChannel> = [];
        for (const channelMention of channelsMentions) {
            const AChannel = extractTypes.channel(channelMention.trim(), command);
            if (!AChannel) return false;
            channels.push(AChannel);
        }
        return channels;
    },
    category: (field, command: Command): CategoryChannel|boolean => {
        if (command.guild == null) return false;
        const channel = command.guild.channels.cache.get(field);
        return (channel instanceof CategoryChannel && channel.type == "GUILD_CATEGORY") ? channel : false;
    },
    message: async (field, _: Command, mentionedChannel: GuildChannel|boolean): Promise<Message|false> => {
        if (mentionedChannel) {
            try { // @ts-ignore
                return await mentionedChannel.messages.fetch(field.toString())
            } catch (e) {
                return false;
            }
        }
        return false;
    },
    messages: async (field, command: Command, mentionedChannel: GuildChannel|boolean):  Promise<Array<Message>|false> => {
        const messagesIds = field.split(",");
        const messages: Array<Message> = [];
        for (const messageId of messagesIds) {
            const AMessage = await extractTypes.message(messageId.trim(), command, mentionedChannel);
            if (!AMessage) return false;
            messages.push(AMessage);
        }
        return messages;
    },
    listenerReactMessage: async (field, command: Command): Promise<{channel: GuildChannel, message: Message}|false> => {
        const channelMention = field.split("/")[0];
        const channel: GuildChannel|ThreadChannel|boolean = extractTypes.channel(channelMention, command);
        let messageToGet: Message|null = null
        if (channel instanceof GuildChannel) {
            const messageId = field.split("/")[1].replaceAll(" ","");
            // @ts-ignore
            messageToGet = await extractTypes.message(messageId,command,channel);
        } else {
            return false;
        }
        return messageToGet ? {message: messageToGet,channel} : false;
    },
    emote: (field, _: Command): GuildEmoji|false => {
        if (new RegExp("^[^\u0000-\u007F]+$").test(field)) return field;
        const emoteId = field.split(":")[2].split(">")[0];
        const emote = client.emojis.cache.get(emoteId);
        return emote ? emote : false;
    },
    user: async (field, command: Command): Promise<GuildMember|false> => {
        if (command.guild == null) return false;
        let userId = field.split("<@")[1].split(">")[0];
        if (userId[0] == "!") userId = userId.substring(1);
        try {
            return await command.guild.members.fetch(userId);
        } catch(e) {
            return false;
        }
    },
    users: async (field, command: Command): Promise<Array<GuildMember>|false> => {
        const userMentions = field.split(",");
        const users: Array<GuildMember> = [];
        for (const userMention of userMentions) {
            const AUser = await extractTypes.user(userMention.trim(), command);
            if (!AUser) return false;
            users.push(AUser);
        }
        return users;
    },
    role: (field, command: Command): Role|false => {
        if (command.guild == null) return false;
        const roleId = field.split("<@&")[1].split(">")[0];
        const role = command.guild.roles.cache.get(roleId);
        return role ?? false;
    },
    roles: (field, command: Command): Array<Role>|false => {
        if (field.length-field.replace(",","") == 0) return [];

        const roles: Array<Role> = [];
        const rolesMentions = field.split(",");
        for (const roleMention of rolesMentions) {
            const role = extractTypes.role(roleMention.trim(), command);
            if (!(role instanceof Role)) return false;
            roles.push(role);
        }
        return roles;
    },
    command: async (field, currentCommand: Command): Promise<typeof Command|false>=> {
        const commandList: typeof Command[] = Object.values(existingCommands);
        for (const eachCommand of commandList) {
            if (eachCommand.commandName === field && eachCommand.display && await eachCommand.staticCheckPermissions(currentCommand.channel,currentCommand.member, currentCommand.guild, false, eachCommand.commandName)) {
                return eachCommand;
            }
        }
        return false;
    },
    commands: async (field, currentCommand: Command): Promise<typeof Command[]|false> => {
        let commands: typeof Command[] = [];
        for (let commandName of field.split(",")) {
            commandName = commandName.trim();
            const foundCommand = await extractTypes.command(commandName,currentCommand);
            if (!foundCommand) return false;
            commands.push(foundCommand);
        }
        return commands;
    },
    duration: (field,_: Command) => {
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
