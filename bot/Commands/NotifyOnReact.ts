import config from "../config";
import Command from "../Classes/Command";
import StoredNotifyOnReact, { IStoredNotifyOnReact, maximumStoredNotifyMessageSize, minimumStoredNotifyMessageSize } from "../Models/StoredNotifyOnReact";
import {
    ClientUser, CommandInteraction,
    EmbedBuilder, Emoji,
    Guild,
    GuildChannel,
    GuildEmoji,
    GuildMember,
    Message,
    MessageReaction,
    Snowflake,
    TextChannel
} from "discord.js";
import {existingCommands} from "../Classes/CommandsDescription";
import {checkTypes} from "../Classes/TypeChecker";
import client from "../client";
import CustomError from "../logging/CustomError";
import reportError from "../logging/reportError";
import {IArgsModel} from "../interfaces/CommandInterfaces";

const messageVariables: {[key: string]: [(userWhoReact: GuildMember) => string, number]} = {
    user: [(userWhoReact) => "<@"+userWhoReact.id+">", 23]
}
export interface IListeningsOnAServer<IData> {
    [channelId: string]: {
        [messageId: string]: IData
    }
}

interface IListenings<IData> {
    [server: string]: IListeningsOnAServer<IData>
}

export interface IListeningData {
    [emoteKey: string]: {
        messageToWrite: string,
        channelToWrite: TextChannel
    }
}

export default class NotifyOnReact extends Command {
    static listenings: IListenings<IListeningData> = {};
    static listenedMessages: IListenings<true> = {};

    static display = true;
    static description = "Pour envoyer un message sur un channel indiqué, quand une réaction à été detectée sur un message.";
    static commandName = "notifyOnReact";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel: IArgsModel = {
        $argsByName: {
            channelToListen: {
                fields: ['--listen-channel','-lc'],
                type: "channel",
                description: "Indique le channel sur lequel écouter",
                required: true
            },
            messageToListen: {
                fields: ["--listen-message","-lm"],
                type: "message",
                description: "Indique le message à écouter (nécessite d'avoir spécifié le channel)",
                required: true,
                moreDatas: (args) => args.channelToListen
            },
            messageToWrite: {
                fields: ["--message", "-m"],
                type: "string",
                description: "Le message à afficher dés qu'une réaction sur le message est detectée",
                valid: (value) => {
                    const length = Object.entries(messageVariables).reduce((acc,[key,[,size]]) => {
                        const nbOccurs = (value.match(new RegExp("\\$"+key))??[]).length
                        return acc - nbOccurs*(key.length+1) + nbOccurs*size
                    }, value.length);
                    return length >= minimumStoredNotifyMessageSize && length <= maximumStoredNotifyMessageSize;
                },
                errorMessage: () => ({
                    name: "Message rentré incorrect",
                    value: "La taille du message doit être située entre "+[minimumStoredNotifyMessageSize,maximumStoredNotifyMessageSize].join(" et ")+" caractères inclus."
                }),
                required: true
            },
            channelToWrite: {
                fields: ["--writeChannel", "-wc"],
                type: "channel",
                description: "le channel sur lequel écrire le message à chaque réaction",
                required: true
            },
            emoteToReact: {
                fields: ["--emote", "-e"],
                type: "emote",
                description: "Indique l'emote à laquelle réagir",
                required: true
            },
        }
    };

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, NotifyOnReact.commandName, NotifyOnReact.argsModel);
        this.listenings = NotifyOnReact.listenings;
        this.listenedMessages = NotifyOnReact.listenedMessages;
    }

    listenings: IListenings<IListeningData>;
    listenedMessages: IListenings<true> = {};

    async action(args: { channelToListen: TextChannel, messageToListen: Message, emoteToReact: GuildEmoji|string, messageToWrite: string, channelToWrite: TextChannel },bot) { // notifyOnReact --listen #ChannelAEcouter/IdDuMessageAEcouter -e :emoteAEcouter: --message '$user$ a réagit à ce message' --writeChannel #channelSurLequelEcrire

        const { channelToListen, messageToListen, emoteToReact, messageToWrite, channelToWrite } = args;

        if (this.guild == null) {
            return this.response(false,
                this.sendErrors({
                    name: "Guild missing",
                    value: "We cannot find the guild"
                })
            );
        }

        if (messageToListen.guild == null) {
            return this.response(false,
                this.sendErrors({
                    name: "Guild missing in the message to listen",
                    value: "We cannot find the guild in the message to listen"
                })
            );
        }

        if (emoteToReact == null) {
            return this.response(false, "L'émoji spécifié semble invalide");
        }

        const emoteKey = emoteToReact instanceof Emoji ? emoteToReact.id : emoteToReact;

        if (this.listenings?.[this.guild.id]?.[channelToListen.id]?.[messageToListen.id]?.[emoteKey] !== undefined) {
            return this.response(false,
                this.sendErrors({
                    name: "Déjà écouté",
                    value: "Ce message est déjà écouté sur cette émote"
                })
            );
        }
        
        NotifyOnReact.setListeningData(this.listenings, this.guild.id, channelToListen.id, messageToListen.id, (data) => ({
            ...(data??{}),
            [emoteKey]: {
                messageToWrite,
                channelToWrite
            }
        }))

        await messageToListen.react(emoteToReact);

        await NotifyOnReact.saveNotifyOnReact(messageToListen, channelToWrite, messageToWrite, emoteKey, channelToListen);

        if (this.listenedMessages?.[this.guild.id]?.[channelToListen.id]?.[messageToListen.id] === undefined)
            NotifyOnReact.reactingAndNotifyOnMessage(messageToListen, channelToListen);

        return this.response(true, "Command sucessfully executed, all reactions to this message will be notified");
    }

    static async reactingAndNotifyOnMessage(messageToListen: Message, channelToListen: GuildChannel) {
        const serverId = (<Guild>messageToListen.guild).id;

        this.setListeningData(
            this.listenedMessages,
            serverId,
            channelToListen.id,
            messageToListen.id,
            true
        )

        let userWhoReact;
        let currentReaction: MessageReaction;
        const filter = (reaction, user) => {
            userWhoReact = user;
            currentReaction = reaction;

            return this.detectEmptyAndCleanListeningData(
                this.listenings,
                serverId,
                channelToListen.id,
                messageToListen.id
            ) || this.listenings[serverId][channelToListen.id][messageToListen.id][reaction.emoji.id??reaction.emoji.name] !== undefined;
        };
        return messageToListen.awaitReactions({ max: 1 , filter})
            .then(_ => {

                if (this.listenings[serverId]?.[channelToListen.id]?.[messageToListen.id] === undefined) {
                    delete this.listenedMessages[serverId][channelToListen.id][messageToListen.id];
                    this.detectEmptyAndCleanListeningData(this.listenedMessages, serverId, channelToListen.id, messageToListen.id);
                    return;
                }

                if (!userWhoReact) return;

                if (userWhoReact.id === (<ClientUser>client.user).id) {
                    return this.reactingAndNotifyOnMessage(messageToListen, channelToListen);
                }

                let {channelToWrite, messageToWrite} = this.listenings[serverId][channelToListen.id][messageToListen.id][<string>(currentReaction.emoji.id??currentReaction.emoji.name)];
                for (let key in messageVariables) {
                    messageToWrite = messageToWrite.replace(new RegExp("\\$"+key), messageVariables[key][0](userWhoReact));
                }
                channelToWrite.send(messageToWrite);

                return this.reactingAndNotifyOnMessage(messageToListen, channelToListen);
            })
            .catch(e => {
                const data: any = currentReaction ? this.listenings[serverId]?.
                                                            [channelToListen.id]?.
                                                            [messageToListen.id]?.
                                                            [<string>(currentReaction.emoji.id??currentReaction.emoji.name)]??{} : {};
                reportError(new CustomError(e, {
                    from: "listeningNotifyOnReact",
                    channel: channelToListen,
                    guild: channelToListen.guild,
                    storedNotifyOnReact: {
                        messageToListenId: messageToListen.id,
                        channelToWriteId: data.channelToWrite ? data.channelToWrite.id : null,
                        messageToWrite: data.messateToWrite ?? null,
                        channelToListenId: channelToListen.id,
                        serverId
                    }
                }))
            });
    }

    static detectEmptyAndCleanListeningData<IData extends IListeningData|true>(
        object: IListenings<IData>, 
        serverId: string, 
        channelId: string, 
        messageId: string,
    ): boolean {
        if (!object[serverId]) {
            delete object[serverId];
            return true;
        }
        if (!object[serverId][channelId]) {
            delete object[serverId][channelId];
            if (Object.keys(object[serverId]).length == 0) {
                delete object[serverId];
            }
            return true;
        }
        if (
            !object[serverId][channelId][messageId] || 
            (
                typeof(object[serverId][channelId][messageId]) === "object" && 
                Object.keys(object[serverId][channelId][messageId]).length === 0
            )
        ) {
            delete object[serverId][channelId][messageId]

            if (Object.keys(object[serverId][channelId]).length == 0) {
                delete object[serverId][channelId];
            }
            if (Object.keys(object[serverId]).length == 0) {
                delete object[serverId];
            }
            return true;
        }
        return false;
    }

    static setListeningData<IData extends IListeningData|true>(
        object: IListenings<IData>, 
        serverId: string, 
        channelId: string, 
        messageId: string, 
        valueOrFunction: IData|((data: IData|undefined) => IData)
    ) {
        if (typeof(object[serverId]) == "undefined") {
            object[serverId] = {};
        }
        if (typeof(object[serverId][channelId]) == "undefined") {
            object[serverId][channelId] = {};
        }
        
        object[serverId][channelId][messageId] = typeof(valueOrFunction) === "function" ? valueOrFunction(object[serverId][channelId][messageId]) : valueOrFunction
    }

    static saveNotifyOnReact(messageToListen, channelToWrite, messageToWrite, emoteId, channelToListen) {
        const storedNotifyOnReact: IStoredNotifyOnReact = {
            emoteId,
            channelToListenId: channelToListen.id,
            messageToListenId: messageToListen.id,
            messageToWrite,
            channelToWriteId: channelToWrite.id,
            serverId: messageToListen.guild.id
        };

        StoredNotifyOnReact.create(storedNotifyOnReact);
    }

    static async applyNotifyOnReactAtStarting(bot) { // Detect notifyOnReacts storeds in the database and apply them
        const channelsListened = {};
        const channelsWhereEmoteNotFound = {};
        const storedNotifyOnReacts: Array<IStoredNotifyOnReact> = await StoredNotifyOnReact.find({});
        for (const {serverId, emoteId, emoteName, channelToListenId, messageToListenId, channelToWriteId, messageToWrite} of storedNotifyOnReacts) {
            try {
                const emoteNameOrId: string = <string>(emoteName ?? emoteId); //@ts-ignore
                const deleteNotif = () => existingCommands.CancelNotifyOnReact.deleteNotifyOnReactInBdd(serverId, channelToListenId, messageToListenId, emoteNameOrId);

                const server: Guild | undefined = bot.guilds.cache.get(serverId);
                if (server == undefined) continue;

                const channelToListen = <undefined|TextChannel>server.channels.cache.get(channelToListenId);
                if (channelToListen == undefined) {
                    await deleteNotif();
                    continue;
                }
                let messageToListen: null | Message = null;
                try {
                    // @ts-ignore
                    messageToListen = await channelToListen.messages.fetch(messageToListenId);
                } catch (e) {
                }
                if (messageToListen == null) {
                    await deleteNotif();
                    continue;
                }

                const channelToWrite = <undefined|TextChannel>server.channels.cache.get(channelToWriteId);
                if (channelToWrite == undefined) {
                    await deleteNotif();
                    continue;
                }
                let reaction;
                let emote;

                // Si l'émote n'est pas une émote native en unicode, on essaye de la récupérer à partir du nom ou de l'id, sur le serveur, et sur le message à écouter en lui même.
                if (!checkTypes.unicode(emoteNameOrId) && (
                    (emoteId &&
                        (emote = server.emojis.cache.get(emoteId)) === undefined &&
                        (emote = (reaction = messageToListen.reactions.cache.find(reaction => reaction.emoji.id === emoteId)) ? reaction.emoji : undefined) === undefined
                    ) ||
                    (emoteName &&
                        (emote = server.emojis.cache.find((emote) => emote.name === emoteName)) === undefined &&
                        (emote = (reaction = messageToListen.reactions.cache.find(reaction => reaction.emoji.name === emoteName)) ? reaction.emoji : undefined) === undefined
                    )
                )) {
                    await deleteNotif();
                    if (!channelsWhereEmoteNotFound[channelToWrite.id]) {
                        channelsWhereEmoteNotFound[channelToWrite.id] = true; // @ts-ignore
                        channelToWrite.send("Une ou plusieurs emotes n'ont pas été trouvée. Une ou plusieurs écoutes de réaction ont été supprimées");
                    }
                    continue;
                }

                const emoteKey: string = emote instanceof Emoji ? (<string>emote.id) : emoteNameOrId;

                this.setListeningData(
                    this.listenings,
                    serverId,
                    channelToListen.id,
                    messageToListen.id,
                    (data) => ({
                        ...(data??{}),
                        [emoteKey]: {
                            messageToWrite,
                            channelToWrite
                        }
                    })
                )

                if (this.listenedMessages?.[serverId]?.[channelToListen.id]?.[messageToListen.id] === undefined)
                    NotifyOnReact.reactingAndNotifyOnMessage(messageToListen, channelToListen);

                if (!channelsListened[channelToWrite.id]) {
                    channelsListened[channelToWrite.id] = true; // @ts-ignore
                    channelToWrite.send("Le serveur du bot a redémarré. Une écoute de réaction sera notifiée sur ce channel");
                }
            } catch (e) {
                throw new CustomError(<Error>e, {storedNotifyOnReact: {serverId, emoteId, emoteName, channelToListenId, messageToListenId, channelToWriteId, messageToWrite}})
            }
        }
    }

    help() {
        return new EmbedBuilder()
            .setTitle("Exemples :")
            .addFields({
                name: config.command_prefix + this.commandName + " -lc #ChannelAEcouter -lm IdDuMessageAEcouter -e :emoteAEcouter: --message '$user$ a réagit à ce message' --writeChannel #channelSurLequelEcrire",
                value: "Créer une écoute pour qu'un message '$user$ a réagit à ce message' soit posté sur le channel #channelSurLequelEcrire à chaque fois qu'on réagit avec l'émote :emoteAEcouter: sur le message ayant l'id IdDuMessageAEcouter dans le channel #ChannelAEcouter"
            });
    }
}
