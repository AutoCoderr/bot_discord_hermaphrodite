import { existingCommands } from "./CommandsDescription";
import History, {IHistory} from "../Models/History";
import config from "../config";

export function extractEmoteName(emoteName) {
    return emoteName.split(":")[1]
}

export function addMissingZero(number, n = 2) {
    number = number.toString();
    while (number.length < n) {
        number = "0"+number;
    }
    return number;
}

export function extractChannelId(channelMention) {
    let channelId = channelMention.split("<#")[1];
    if (channelId == undefined) return false;
    if (channelId[channelId.length-1] != ">") return false;
    channelId = channelId.substring(0,channelId.length-1);
    if (channelId.length != 18) return false;
    return channelId;
}


export async function getHistory(message,args) {
    let errors: Array<Object> = [];

    let commandName: null|string = null;
    if (typeof(args.c) != "undefined" && typeof(args.command) != "undefined") {
        errors.push({name: "-c or --command", value: "Please use -c or --command but not the both"});
    } else if (typeof(args.c) != "undefined" || typeof(args.command) != "undefined") {
        commandName = typeof(args.c) != "undefined" ? args.c : args.command;
        if (!Object.keys(existingCommands).includes(<string>commandName) || !existingCommands[<string>commandName].display) {
            errors.push({name: "That command can't be grepped", value: "'"+config.command_prefix+commandName+"' command can't be grepped in "+config.command_prefix+"history"});
        } else if (!await existingCommands[<string>commandName].commandClass.checkPermissions(message,false)) {
            errors.push({name: "You are not allowed", value: "You are not allowed to check '"+config.command_prefix+commandName+"'"});
        }
    }

    let sort: string = "asc";
    if (typeof(args.s) != "undefined" && typeof(args.sort) != "undefined") {
        errors.push({name: "-s or --sort", value: "Please use -s or --sort but not the both"});
    } else if (typeof(args.s) != "undefined" || typeof(args.sort) != "undefined") {
        sort = typeof(args.s) != "undefined" ? args.s : args.sort;
        sort = sort.toLowerCase();
        if (sort == "dsc") {
            sort = "desc";
        }
        if (sort != "asc" && sort != "desc") {
            errors.push({name: "Bad argument for sort", value: "Please use 'asc' or 'desc/dsc'"});
        }
    }

    let limit: number = 0;
    if (typeof(args.l) != "undefined" && typeof(args.limit) != "undefined") {
        errors.push({name: "-l or --limit", value: "Please use -l or --limit but not the both"});
    } else if (typeof(args.l) != "undefined" || typeof(args.limit) != "undefined") {
        let limitToCheck: string = typeof(args.l) != "undefined" ? args.l : args.limit;
        if (parseInt(limitToCheck).toString() != limitToCheck || limitToCheck == "NaN") {
            errors.push({name: "Bad argument for limit", value: "Limit specified is incorrect, specify a number"});
        } else {
            limit = parseInt(limitToCheck);
        }
    }

    let channelId: null|string = null;
    if (typeof(args.ch) != "undefined" && typeof(args.channel) != "undefined") {
        errors.push({name: "-ch or --channel", value: "Please use -ch or --channel but not the both"});
    } else if (typeof(args.ch) != "undefined" || typeof(args.channel) != "undefined") {
        channelId = typeof(args.ch) != "undefined" ? args.ch : args.channel; // @ts-ignore
        if (typeof(channelId) != "string") {
            errors.push({name: "Bad argument for channel", value: "Specified channel is incorrect"});
        } else { // @ts-ignore
            channelId = channelId.replaceAll(" ",""); // @ts-ignore
            channelId = channelId.split("<#")[1];
            if (channelId == undefined) {
                errors.push({name: "Bad argument for channel", value: "Specified channel is incorrect"});
            } else {
                channelId = channelId.substring(0,channelId.length-1);
                let channel = message.guild.channels.cache.get(channelId);
                if (channel == undefined) {
                    errors.push({name: "Channel does not exist", value: "The specified channel does not exist"});
                }
            }
        }
    }

    let userId: null|string = null;
    if (typeof(args.u) != "undefined" && typeof(args.user) != "undefined") {
        errors.push({name: "-u or --user", value: "Please use -u or --user but not the both"});
    } else if (typeof(args.u) != "undefined" || typeof(args.user) != "undefined") {
        userId = typeof(args.u) != "undefined" ? args.u : args.user; // @ts-ignore
        if (typeof(userId) != "string") {
            errors.push({name: "Bad argument for user", value: "Specified user is incorrect"});
        } else { // @ts-ignore
            userId = userId.replaceAll(" ",""); // @ts-ignore
            userId = userId.split("<@")[1];
            if (userId == undefined) {
                errors.push({name: "Bad argument for channel", value: "Specified channel is incorrect"});
            } else {
                if (userId[0] == "!") {
                    userId = userId.slice(1)
                }
                userId = userId.substring(0,userId.length-1);
                let user = message.guild.members.cache.get(userId);
                if (user == undefined) {
                    errors.push({name: "User does not exist", value: "The specified user does not exist"});
                }
            }
        }
    }

    if (errors.length > 0) {
        return {errors: errors, histories: []};
    }

    let where:any = {serverId: message.guild.id};
    if (userId != null) {
        where.userId = userId
    }
    if (channelId != null) {
        where.channelId = channelId;
    }
    if (commandName != null) {
        where.commandName = commandName;
    } else {
        where.commandName = { $nin: [] };
        for (let aCommand in existingCommands) {
            if (!await existingCommands[aCommand].commandClass.checkPermissions(message,false)) {
                where.commandName.$nin.push(aCommand);
            }
        }
    }

    const histories:Array<IHistory> = await History.find(where).limit(limit).sort({dateTime: sort});

    return {errors: [], histories: histories};
}

export async function checkArgumentsNotifyOnReact(message,args) {  // Vérifie la validité des arguments passés pour récupérer les écoutes de réactions
    let channelId = null;
    let channel;

    let errors: Array<Object> = [];

    if (typeof(args.channel) != "undefined" && typeof(args.ch) != "undefined") {
        errors.push({
            name: "--channel or -ch",
            value: "--channel or -ch but not the both"
        });
    } else if (typeof(args.channel) != "undefined" || typeof(args.ch) != "undefined") {
        channelId = extractChannelId(typeof(args.channel) != "undefined" ? args.channel : args.ch);
        if (!channelId) {
            errors.push({
                name: "Channel invalide",
                value: "Mention de channel indiqué invalide"
            });
        } else {
            channel = message.guild.channels.cache.get(channelId);
            if (channel == undefined) {
                errors.push( {
                    name: "Channel inexistant",
                    value: "Mention de channel indiqué inexistant"
                });
            }
        }
    }

    let messageId = null;
    let contentMessage;
    if (typeof(args.message) != "undefined" && typeof(args.m) != "undefined") {
        errors.push({
            name: "--message or -m",
            value: "--message or -m but not the both"
        });
    } else if (typeof(args.message) != "undefined" || typeof(args.m) != "undefined") {
        if (channelId == null || channel == undefined) {
            errors.push({
                name: "Spécifiez un channel",
                value: "Vous devez spécifier un channel, avant de spécifier un message"
            });
        } else {
            let messageListened
            messageId = typeof (args.message) != "undefined" ? args.message : args.m;
            try {
                messageListened = await channel.messages.fetch(messageId);
            } catch (e) {
            }
            contentMessage = messageListened != undefined ?
                messageListened.content.substring(0, Math.min(20, messageListened.content.length)) + "..."
                : messageId;
        }
    }

    return {errors, channelId, channel, messageId, contentMessage};
}

export async function forEachNotifyOnReact(callback, channelId, channel, messageId, contentMessage, messageCommand, serverId) {
    let listenings = existingCommands.notifyOnReact.commandClass.listenings[serverId];

    if (typeof(listenings) == "undefined") {
        callback(false);
    } else if (channelId != null) {
        if (typeof(listenings[channelId]) != "undefined") {
            if (messageId != null) {
                let nbListeneds = 0;
                if (typeof(listenings[channelId][messageId]) != "undefined") { // Si un channel et un message ont été spécifiés, regarde dans le message
                    // @ts-ignore
                    for (let emote in listenings[channelId][messageId]) {
                        if (listenings[channelId][messageId][emote]) {
                            callback(true, channel, contentMessage, emote);
                            nbListeneds += 1;
                        }
                    }
                }
                if (nbListeneds == 0) {
                    callback(false);
                }
            } else { // Si un channel a été spécififié, mais pas de message, regarde tout les messages de ce channel
                let nbListeneds = 0; // @ts-ignore
                for (let messageId in listenings[channelId]) {
                    let messageListened;
                    try {
                        messageListened = await channel.messages.fetch(messageId);
                    } catch(e) {
                    }
                    const contentMessage = messageListened != undefined ?
                        messageListened.content.substring(0, Math.min(20,messageListened.content.length)) + "..."
                        : messageId; // @ts-ignore
                    for (let emote in listenings[channelId][messageId]) {
                        if (listenings[channelId][messageId][emote]) {
                            nbListeneds += 1;
                            callback(true, channel, contentMessage, emote);
                        }
                    }
                }
                if (nbListeneds == 0) {
                    callback(false);
                }

            }
        } else {
            callback(false);
        }
    } else { // Si rien n'a été spécifié en argument, regarde sur tout les messaqes de tout les channels
        let nbListeneds = 0;
        for (let channelId in listenings) {
            let channel = messageCommand.guild.channels.cache.get(channelId);
            for (let messageId in listenings[channelId]) {
                let messageListened;
                try {
                    messageListened = await channel.messages.fetch(messageId);
                } catch (e) {
                }
                const contentMessage = messageListened != undefined ?
                    messageListened.content.substring(0, Math.min(20,messageListened.content.length)) + "..."
                    : messageId;
                for (let emote in listenings[channelId][messageId]) {
                    if (listenings[channelId][messageId][emote]) {
                        nbListeneds += 1;
                        callback(true, channel, contentMessage, emote);
                    }
                }
            }
        }
        if (nbListeneds == 0) {
            callback(false);
        }
    }
}