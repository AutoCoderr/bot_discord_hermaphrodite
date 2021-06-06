import { existingCommands } from "./CommandsDescription";
import History, {IHistory} from "../Models/History";
import {GuildChannel, GuildMember, Message, MessageEmbed} from "discord.js";

export function addMissingZero(number, n = 2) {
    number = number.toString();
    while (number.length < n) {
        number = "0"+number;
    }
    return number;
}

export function getArgsModelHistory(message: Message) {
    return {
        help: { fields: ['-h', '--help'], type: "boolean", required: false, description: "Pour afficher l'aide" },

        command: {
            fields: ['-c', '--command'],
            type: "string",
            required: false,
            description: "La commande dont on souhaite voir l'historique",
            valid: async (value, _) => { // Vérifie si l'utilisateur à le droit d'accéder à cette commande
                const commands = Object.keys(existingCommands);
                for (let i=0;i<commands.length;i++) {
                    const commandName = commands[i];
                    if (!existingCommands[commandName].display || !(await existingCommands[commandName].commandClass.staticCheckPermissions(message,false))) {
                        commands.splice(i,1);
                        i -= 1;
                    }
                }
                return commands.includes(value);
            },
            errorMessage: (value, _, embed: MessageEmbed) => {
                if (value != undefined) {
                    embed.addFields({
                        name: "La commande n'existe pas",
                        value: "La commande '" + value + "' n'existe pas, ou vous est inaccessible"
                    });
                } else {
                    embed.addFields({
                        name: "Nom de commande manquant",
                        value: "Nom de la commande non spécifié"
                    });
                }
            }
        },
        sort: {
            fields: ['-s', '--sort'],
            type: "string",
            required: false,
            description: "'asc' ou 'desc/dsc' ('desc' par défaut) pour trier du debut à la fin ou de la fin au début dans l'ordre chronologique",
            valid: (value, _) => ['asc','desc','dsc'].includes(value),
            default: "desc"
        },
        limit: {
            fields: ['-l', '--limit'],
            type: "number",
            required: false,
            description: "Pour afficher les n dernières commandes de la listes"
        },
        channel: {
            fields: ['-ch', '--channel'],
            type: "channel",
            required: false,
            description: "Pour afficher les commandes executées dans un channel spécifique"
        },
        user: {
            fields: ['-u', '--user'],
            type: "user",
            required: false,
            description: "Pour afficher les commandes executées par un utilisateur spécifique"
        }

    };
}


export async function getHistory(message,args: {command: string, sort: string, limit: number, channel: GuildChannel, user: GuildMember}) {
    let { command, sort, limit, channel, user } = args;

    let where:any = {serverId: message.guild.id};
    if (user != undefined) {
        where.userId = user.id
    }
    if (channel != undefined) {
        where.channelId = channel.id;
    }
    if (command != null) {
        where.commandName = command;
    } else {
        where.commandName = { $nin: [] };
        for (let aCommand in existingCommands) {
            if (!await existingCommands[aCommand].commandClass.staticCheckPermissions(message,false)) {
                where.commandName.$nin.push(aCommand);
            }
        }
    }

    if (sort == "dsc") sort = "desc";

    const histories:Array<IHistory> = await History.find(where).limit(limit).sort({dateTime: sort});

    return {histories: histories, limit: limit};
}

export async function forEachNotifyOnReact(callback, channel: GuildChannel, message: Message, messageCommand) {
    const serverId = messageCommand.guild.id;
    // @ts-ignore
    let listenings = existingCommands.NotifyOnReact.listenings[serverId];

    if (typeof(listenings) == "undefined") {
        callback(false);
    } else if (channel != undefined) {
        if (typeof(listenings[channel.id]) != "undefined") {
            if (message != undefined) {
                let nbListeneds = 0;
                if (typeof(listenings[channel.id][message.id]) != "undefined") { // Si un channel et un message ont été spécifiés, regarde dans le message
                    for (let emote in listenings[channel.id][message.id]) {
                        if (listenings[channel.id][message.id][emote]) {
                            callback(true, channel, message.id, message.content, emote);
                            nbListeneds += 1;
                        }
                    }
                }
                if (nbListeneds == 0) {
                    callback(false);
                }
            } else { // Si un channel a été spécififié, mais pas de message, regarde tout les messages de ce channel
                let nbListeneds = 0;
                for (let messageId in listenings[channel.id]) {
                    let messageListened;
                    try { // @ts-ignore
                        messageListened = await channel.messages.fetch(messageId);
                    } catch(e) {
                    }
                    const contentMessage = messageListened != undefined ?
                        messageListened.content.substring(0, Math.min(20,messageListened.content.length)) + "..."
                        : messageId;
                    for (let emote in listenings[channel.id][messageId]) {
                        if (listenings[channel.id][messageId][emote]) {
                            nbListeneds += 1;
                            callback(true, channel, messageId, contentMessage, emote);
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
                        callback(true, channel, messageId, contentMessage, emote);
                    }
                }
            }
        }
        if (nbListeneds == 0) {
            callback(false);
        }
    }
}

export function isNumber(num) {
    return (typeof(num) == 'number' && !isNaN(num)) || (
      typeof(num) == 'string' && parseInt(num).toString() == num && num != "NaN"
    );
}
