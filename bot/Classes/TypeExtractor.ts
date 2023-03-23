import {
    BaseGuildTextChannel,
    CategoryChannel,
    GuildChannel,
    GuildEmoji,
    GuildMember,
    Message, Permissions,
    Role,
    ThreadChannel,
    VoiceChannel,
    ChannelType, Attachment, User
} from "discord.js";
import {existingCommands} from "./CommandsDescription";
import Command from "./Command";
import {isNumber, userHasChannelPermissions} from "./OtherFunctions";
import {durationUnits,durationUnitsMult} from "./DateTimeManager";
import request from "./request";

export const extractTypes = {
    channel: (field, command: Command): GuildChannel|ThreadChannel|VoiceChannel|false => {
        if (command.guild == null) return false;
        let channelId = field.split("<#")[1];
        channelId = channelId.substring(0,channelId.length-1);
        const channel = command.guild.channels.cache.get(channelId);
        if (!channel)
            return false;

        return userHasChannelPermissions(command.member, channel, 'ViewChannel') ? channel : false;
    },
    channels: (field, command: Command): Array<GuildChannel|ThreadChannel|VoiceChannel>|false => {
        const channelsSplitted = field.split("<#");
        const channels: Array<GuildChannel|ThreadChannel> = [];
        for (let i=1;i<channelsSplitted.length;i++) {
            const channelMention = "<#"+channelsSplitted[i].trim();
            const AChannel = extractTypes.channel(channelMention, command);
            if (!AChannel) return false;
            channels.push(AChannel);
        }
        return channels;
    },
    category: (field, command: Command): CategoryChannel|boolean => {
        if (command.guild == null) return false;
        const channel = command.guild.channels.cache.get(field);
        return (channel instanceof CategoryChannel && channel.type == ChannelType.GuildCategory) ? channel : false;
    },
    message: async (field, _: Command, mentionedChannel: BaseGuildTextChannel|boolean): Promise<Message|false> => {
        if (mentionedChannel && mentionedChannel !== true) {
            try {
                return await mentionedChannel.messages.fetch(field.toString())
            } catch (e) {
                return false;
            }
        }
        return false;
    },
    messages: async (field, command: Command, mentionedChannel: GuildChannel|BaseGuildTextChannel|boolean):  Promise<Array<Message>|false> => {
        if (!(mentionedChannel instanceof BaseGuildTextChannel))
            return false;
        const messages: Array<Message|false> = await Promise.all(field.split(",")
            .map(messageId => messageId.trim())
            .map(async messageId => {
                const AMessage = await extractTypes.message(messageId, command, mentionedChannel);
                return AMessage ? AMessage : false;
            }));
        return messages.includes(false) ? false : <Array<Message>>messages;
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
    emote: (field, command: Command): GuildEmoji|false => {
        if (new RegExp("^[^\u0000-\u007F]+$").test(field)) return field;
        const emoteId = field.split(":")[2].split(">")[0];
        const emote = command.client.emojis.cache.get(emoteId);
        return emote ? emote : false;
    },
    user: async (field: string|User, command: Command): Promise<GuildMember|false> => {
        if (command.guild == null) return false;

        let userId;
        if (field instanceof User) {
            userId = field.id;
        } else {
            userId = field.split("<@")[1].split(">")[0];
            if (userId[0] == "!") userId = userId.substring(1);
        }

        try {
            return await command.guild.members.fetch(userId);
        } catch(e) {
            return false;
        }
    },
    users: async (field, command: Command): Promise<Array<GuildMember>|false> => {
        const usersSplitted = field.split("<@");
        const users: Array<GuildMember> = [];
        for (let i=1;i<usersSplitted.length;i++) {
            const userMention = "<@"+usersSplitted[i].replace(",","").trim();
            const AUser = await extractTypes.user(userMention, command);
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
        const rolesSplitted = field.split("<@");

        const roles: Array<Role> = [];
        for (let i=1;i<rolesSplitted.length;i++) {
            const roleMention = "<@"+rolesSplitted[i].replace(",","").trim();
            const role = extractTypes.role(roleMention, command);
            if (!(role instanceof Role)) return false;
            roles.push(role);
        }
        return roles;
    },
    command: async (field, currentCommand: Command): Promise<typeof Command|false>=> {
        const commandList: typeof Command[] = Object.values(existingCommands);
        for (const eachCommand of commandList) {
            if (eachCommand.commandName === field && eachCommand.display && await eachCommand.staticCheckPermissions(currentCommand.member, currentCommand.guild)) {
                return eachCommand;
            }
        }
        return false;
    },
    commands: async (field, currentCommand: Command): Promise<typeof Command[]|false> => {
        let commands: typeof Command[] = [];
        let commandName = "";
        for (let i=0;i<field.length;i++) {
            if (field[i] !== " " && field[i] !== ",") {
                commandName += field[i];
            } else {
                const foundCommand = await extractTypes.command(commandName,currentCommand);
                if (!foundCommand) return false;
                commands.push(foundCommand);
                commandName = "";
            }
        }
        if (commandName != "") {
            const foundCommand = await extractTypes.command(commandName,currentCommand);
            if (!foundCommand) return false;
            commands.push(foundCommand);
        }
        return commands;
    },
    timeUnits: (field: string, _: Command) => {
        const [value, u] = [/[0-9]+/g, /[a-z]+/g].map(r => (<string[]>field.match(r))[0]);

        return {
            value: parseInt(value),
            unit: Object.keys(durationUnits).find(unit => durationUnits[unit].includes(u))
        }
    },
    duration: (field,_: Command) => {
        if (field === 0 || (typeof(field) == "string" && parseInt(field) === 0)) return 0;
        const unitByName = Object.entries(durationUnits)
            .filter(([key,_]) => durationUnitsMult[key] !== undefined)
            .reduce((acc,[key,values]) => ({
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
    },
    jsonFile: async (attachment: Attachment) => {
      const {status, body} = await request(attachment.url);

      if (status !== 200)
          return false;

      let json;
      try {
          json = JSON.parse(body);
      } catch(_) {
          return false;
      }
      return json;
    },
    strings: (field) => {
        let quote = null;
        const strings: string[] = [];
        let string = "";
        for (let i=0;i<field.length;i++) {
            if (!quote && ["'",'"'].includes(field[i])) {
                quote = field[i];
                continue;
            }
            if ((quote && quote === field[i]) || (!quote && field[i] === " ")) {
                strings.push(string);
                quote = null;
                string = "";
                continue;
            }

            string += field[i];
        }
        if (string !== "")
            strings.push(string);

        return strings;
    },
    timezone: (field) => {
        return parseInt(field.match("(\\-|\\+)?(1[0-2]|[0-9])"));
    }
};
