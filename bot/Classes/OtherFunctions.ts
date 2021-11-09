import { existingCommands } from "./CommandsDescription";
import History from "../Models/History";
import {EmbedFieldData, GuildChannel, GuildMember, Message, MessageEmbed} from "discord.js";
import Command from "./Command";

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

        commands: {
            fields: ['-c', '--command'],
            type: "commands",
            required: false,
            description: "La ou les commandes dont on souhaite voir l'historique",
            valid: async (commandList: typeof Command[], _) => { // Vérifie si une commande n'a pas été tapée plusieurs fois
                const alreadySpecifiedCommands = {};
                for (const command of commandList) {
                    if (alreadySpecifiedCommands[<string>command.commandName] === undefined) {
                        alreadySpecifiedCommands[<string>command.commandName] = true;
                    } else {
                        return false;
                    }
                }
                return true;
            },
            errorMessage: (value, _) => {
                if (value != undefined) {
                    return {
                        name: "Liste de commandes invalide",
                        value: value+" : Une de ces commandes n'existe pas, vous est inaccesible, ou a été spécifiée plusieurs fois"
                    };
                }
                return {
                    name: "Nom de commande manquant",
                    value: "Nom de la commande non spécifié"
                };
            }
        },
        sort: {
            fields: ['-s', '--sort'],
            type: "string",
            required: false,
            description: "'asc' ou 'desc/dsc' ('desc' par défaut) pour trier du debut à la fin ou de la fin au début dans l'ordre chronologique",
            valid: (value, _) => ['asc','desc','dsc'].includes(value.toLowerCase()),
            default: "desc"
        },
        limit: {
            fields: ['-l', '--limit'],
            type: "number",
            required: false,
            description: "Pour afficher les n premieres commandes de la listes"
        },
        channels: {
            fields: ['-ch', '--channel'],
            type: "channels",
            required: false,
            description: "Pour afficher les commandes executées dans un ou des channels spécifiques"
        },
        users: {
            fields: ['-u', '--user'],
            type: "users",
            required: false,
            description: "Pour afficher les commandes executées par un ou des utilisateurs spécifiques"
        }

    };
}


export async function getHistory(message,args: {commands: typeof Command[], sort: string, limit: number, channels: GuildChannel[], users: GuildMember[]}) {
    let { commands, sort, limit, channels, users } = args;

    let where:any = {serverId: message.guild.id};
    if (users != undefined) {
        where.userId = {$in: users.map(user => user.id)};
    }
    if (channels != undefined) {
        where.channelId = {$in: channels.map(channel => channel.id)};
    }
    if (commands != undefined) {
        where.commandName = {$in: []};
        for (const command of commands) {
            where.commandName.$in.push(command.commandName);
        }
    } else {
        where.commandName = { $nin: [] };
        for (let aCommand in existingCommands) {
            if (!await existingCommands[aCommand].staticCheckPermissions(message,false)) {
                where.commandName.$nin.push(aCommand);
            }
        }
    }

    if (sort == "dsc") sort = "desc";

    return await History.find(where).limit(limit).sort({dateTime: sort});
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
                            const contentMessage = message.content.substring(0,Math.min(20,message.content.length)) + "...";
                            callback(true, channel, message.id, contentMessage, emote);
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

export function splitFieldsEmbed(nbByPart: number,
                                     fields: EmbedFieldData[],
                                     atEachPart: Function): Array<MessageEmbed> {
    let Embed: MessageEmbed;
    let Embeds: Array<MessageEmbed> = [];
    for (let i=0;i<fields.length;i++) {
        if (i % nbByPart == 0) {
            Embed = new MessageEmbed()
                .setColor('#0099ff')
                .setTimestamp();
            atEachPart(Embed, (i/nbByPart)+1);
            Embeds.push(Embed);
        }
        const field = fields[i];
        // @ts-ignore
        Embed.addFields(field);
    }
    return Embeds;
}

export function splitOneFieldLinesEmbed(title: string, nbByPart: number, lines: string[]) {
    let embeds: MessageEmbed[] = [];
    for (let i=0;i<Math.floor(lines.length/nbByPart)+(lines.length%nbByPart != 0 ? 1 : 0);i++) {
        embeds.push(new MessageEmbed()
            .setColor('#0099ff')
            .setTimestamp()
            .addFields({
                name: title,
                value: lines.slice(i*nbByPart,Math.min((i+1)*nbByPart,lines.length)).join("\n")
            }));
    }
    return embeds;
}

export function isNumber(num) {
    return (typeof(num) == 'number' && !isNaN(num)) || (
      typeof(num) == 'string' && parseInt(num).toString() == num && num != "NaN"
    );
}

export const durationUnits = {
    second: ['s','seconde','secondes','second','seconds','sec'],
    minute: ['m','minute','minutes','min'],
    hour: ['h','hour','hours','heure','heures']
}

export const durationUnitsMult = {
    second: 1000,
    minute: 60*1000,
    hour: 60*60*1000
}

export function decomposeMsTime(ms: number): {h: number, m: number, s: number} {
    return {
        h: Math.floor(ms/1000/60/60),
        m: Math.floor(ms/1000/60)%60,
        s: Math.floor(ms/1000)%60
    }
}

export function showTime(time: {h: number, m: number, s: number}): string {
    return (time.h > 0 ? ' '+time.h+' heure'+(time.h > 1 ? 's' : '') : '')+
        (time.m > 0 ? ' '+time.m+' minute'+(time.m > 1 ? 's' : '') : '')+
        (time.s > 0 ? ' '+time.s+' seconde'+(time.s > 1 ? 's' : '') : '')
}
