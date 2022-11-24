import {existingCommands} from "./CommandsDescription";
import History from "../Models/History";
import {
    EmbedBuilder, EmbedField,
    Guild,
    GuildChannel,
    GuildMember,
    Message, PermissionResolvable,
    TextChannel,
    ThreadChannel, User, VoiceChannel
} from "discord.js";
import Command from "./Command";
import CancelNotifyOnReact from "../Commands/CancelNotifyOnReact";
import HistoryExec from "../Commands/HistoryExec";
import HistoryCmd from "../Commands/HistoryCmd";
import ListNotifyOnReact from "../Commands/ListNotifyOnReact";
import {IArgsModel} from "../interfaces/CommandInterfaces";

export function addMissingZero(number, n = 2) {
    number = number.toString();
    while (number.length < n) {
        number = "0" + number;
    }
    return number;
}

export function getArgsModelHistory(): IArgsModel {
    return {
        $argsByName: {
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
                            value: value + " : Une de ces commandes n'existe pas, vous est inaccesible, ou a été spécifiée plusieurs fois"
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
                description: "'asc' ou 'desc/dsc' ('desc' par défaut) pour trier dans l'ordre chronologique dans les deux sens",
                valid: (value, _) => ['asc', 'desc', 'dsc'].includes(value.toLowerCase()),
                default: "desc"
            },
            limit: {
                fields: ['-l', '--limit'],
                type: "number",
                required: false,
                default: 15,
                description: "Pour afficher les n dernières commandes de la listes"
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
        }
    };
}


export async function getHistory(currentCommand: HistoryCmd | HistoryExec, args: { commands: typeof Command[], sort: string, limit: number, channels: GuildChannel[], users: GuildMember[] }) {
    let {commands, sort, limit, channels, users} = args;

    let where: any = {serverId: (<Guild>currentCommand.guild).id};
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
        where.commandName = {$nin: []};
        for (let aCommand in existingCommands) {
            if (!await existingCommands[aCommand].staticCheckPermissions(currentCommand.member, currentCommand.guild)) {
                where.commandName.$nin.push(aCommand);
            }
        }
    }

    if (sort == "dsc") sort = "desc";

    return await History.find(where).limit(limit).sort({dateTime: sort});
}

export async function forEachNotifyOnReact(callback, channel: undefined | GuildChannel, message: undefined | Message, embed: EmbedBuilder, command: CancelNotifyOnReact | ListNotifyOnReact) {
    if (command.guild == null) {
        callback(false);
        return;
    }
    const serverId = command.guild.id;
    // @ts-ignore
    let listenings = existingCommands.NotifyOnReact.listenings[serverId];

    if (typeof (listenings) == "undefined") {
        callback(false);
    } else if (channel != undefined) {
        if (typeof (listenings[channel.id]) != "undefined") {
            if (message != undefined) {
                let nbListeneds = 0;
                if (typeof (listenings[channel.id][message.id]) != "undefined") { // Si un channel et un message ont été spécifiés, regarde dans le message
                    for (let emoteKey in listenings[channel.id][message.id]) {
                        if (listenings[channel.id][message.id][emoteKey]) {
                            const contentMessage = message.content.substring(0, Math.min(20, message.content.length)) + "...";
                            callback(true, channel, message, contentMessage, emoteKey);
                            nbListeneds += 1;
                        }
                    }
                }
                if (nbListeneds == 0) {
                    callback(false);
                }
            } else { // Si un channel a été spécifié, mais pas de message, regarde tout les messages de ce channel
                let nbListeneds = 0;
                for (let messageId in listenings[channel.id]) {
                    let messageListened: Message | null = null;
                    try {
                        messageListened = await (<TextChannel>channel).messages.fetch(messageId);
                    } catch (e) {
                        embed.setFields({
                            name: "Message introuvable, écoutes supprimées",
                            value: "Le message " + messageId + " est introuvable, écoutes supprimées"
                        });
                        // @ts-ignore
                        existingCommands.CancelNotifyOnReact.deleteNotifyOnReactInBdd(serverId, channel.id, messageId);

                        delete listenings[channel.id][messageId];
                        continue;
                    }
                    const contentMessage = messageListened.content.substring(0, Math.min(20, messageListened.content.length)) + "...";
                    for (let emoteKey in listenings[channel.id][messageId]) {
                        if (listenings[channel.id][messageId][emoteKey]) {
                            nbListeneds += 1;
                            callback(true, channel, messageListened, contentMessage, emoteKey);
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
            const channel: GuildChannel | ThreadChannel | null = command.guild.channels.cache.get(channelId) ?? null;
            if (channel === null) {
                embed.setFields({
                    name: "Channel introuvable, écoutes supprimées",
                    value: "Le channel " + channelId + " est introuvable, écoutes supprimées"
                });
                // @ts-ignore
                existingCommands.CancelNotifyOnReact.deleteNotifyOnReactInBdd(serverId, channelId);

                delete listenings[channelId];
                continue;
            }
            for (let messageId in listenings[channelId]) {
                let messageListened: Message | null = null;
                try {
                    messageListened = await (<TextChannel>channel).messages.fetch(messageId) ?? null;
                } catch (e) {
                    embed.setFields({
                        name: "Message introuvable, écoutes supprimées",
                        value: "Le message " + messageId + " est introuvable, écoutes supprimées"
                    });
                    // @ts-ignore
                    existingCommands.CancelNotifyOnReact.deleteNotifyOnReactInBdd(serverId, channel.id, messageId);

                    delete listenings[channelId][messageId];
                    continue;
                }
                const contentMessage = messageListened.content.substring(0, Math.min(20, messageListened.content.length)) + "...";
                for (let emoteKey in listenings[channelId][messageId]) {
                    if (listenings[channelId][messageId][emoteKey]) {
                        nbListeneds += 1;
                        callback(true, channel, messageListened, contentMessage, emoteKey);
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
                                 fields: EmbedField[],
                                 atEachPart: Function): Array<EmbedBuilder> {
    let Embed: EmbedBuilder;
    let Embeds: Array<EmbedBuilder> = [];
    for (let i = 0; i < fields.length; i++) {
        if (i % nbByPart == 0) {
            Embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTimestamp();
            atEachPart(Embed, (i / nbByPart) + 1);
            Embeds.push(Embed);
        }
        const field = fields[i];
        // @ts-ignore
        Embed.addFields(field);
    }
    return Embeds;
}

export function splitOneFieldLinesEmbed(title: string, nbByPart: number, lines: string[]) {
    let embeds: EmbedBuilder[] = [];
    for (let i = 0; i < Math.floor(lines.length / nbByPart) + (lines.length % nbByPart != 0 ? 1 : 0); i++) {
        embeds.push(new EmbedBuilder()
            .setColor('#0099ff')
            .setTimestamp()
            .addFields({
                name: title,
                value: lines.slice(i * nbByPart, Math.min((i + 1) * nbByPart, lines.length)).join("\n")
            }));
    }
    return embeds;
}

export function isNumber(num) {
    return (typeof (num) == 'number' && !isNaN(num)) || (
        typeof (num) == 'string' && parseInt(num).toString() == num && num != "NaN"
    );
}

export function propAccess(obj: Object, key: null|string|string[] = null) {
    if (obj === undefined || key === null)
        return obj;
    const keyArray: string[] = key instanceof Array ? key : key.split(".");
    if (keyArray.length === 0)
        return obj;
    return propAccess(obj[keyArray[0]], keyArray.slice(1));
}

export function propUpdate(obj: {[key: string]: any}, key: string|string[], value) {
    if (obj === undefined)
        return null;

    const keyArray: string[] = key instanceof Array ? key : key.split(".");
    if (keyArray.length === 0)
        return value;

    return {
        ...(obj._doc??obj),
        [keyArray[0]]: propUpdate(obj[keyArray[0]], keyArray.slice(1), value)
    }
}

export function userHasChannelPermissions(user: GuildMember|User, channel: GuildChannel|ThreadChannel|VoiceChannel, permissions: PermissionResolvable[]|PermissionResolvable, all: boolean = false) {
    const permissionsArray = permissions instanceof Array ? permissions : [permissions];
    const channelWhichHasPermissions: GuildChannel|ThreadChannel|null = channel.permissionsFor !== undefined ?
        channel :
        (channel.parent && channel.parent.permissionsFor) ?
            channel.parent :
            null;

    if (!channelWhichHasPermissions)
        return false;

    const channelPermissions = channelWhichHasPermissions.permissionsFor(user)
    if (!channelPermissions)
        return false;

    return (
        (all && !permissionsArray.some(permission => !channelPermissions.has(permission))) ||
        (!all && permissionsArray.some(permission => channelPermissions.has(permission)))
    )
}

export function round(n, p) {
    return Math.round(n * 10**p)/10**p
}

export async function deleteMP(user: User, messageId: string) {
    const dmChannel = user.dmChannel ?? await user.createDM().catch(() => null);
    if (dmChannel === null)
        return;

    const message: null|Message = await dmChannel.messages.fetch(messageId).catch(() => null);

    if (message === null)
        return;

    await message.delete().catch(() => null);
}