import config from "../config";
import Command from "../Classes/Command";
import StoredNotifyOnReact, { IStoredNotifyOnReact } from "../Models/StoredNotifyOnReact";
import {GuildChannel, GuildEmoji, Message} from "discord.js";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";
import {existingCommands} from "../Classes/CommandsDescription";

export default class NotifyOnReact extends Command {

    argsModel = {
        help: {
            fields: ["--help", "-h"],
            type: "boolean",
            description: "Pour afficher l'aide",
            required: false
        },
        listen: {
            fields: ["--listen","-l"],
            type: "listenerReactMessage",
            description: "Indique le channel et le message à écouter, séparés d'un '/'",
            required: args => args.help == undefined
        },
        messageToWrite: {
            fields: ["--message", "-m"],
            type: "string",
            description: "Le message à afficher dés qu'une réaction sur le message est detectée",
            required: args => args.help == undefined
        },
        channelToWrite: {
            fields: ["--writeChannel", "-wc"],
            type: "channel",
            description: "le channel sur lequel écrire le message à chaque réaction",
            required: args => args.help == undefined
        },
        emoteToReact: {
            fields: ["--emote", "-e"],
            type: "emote",
            description: "Indique l'emote à laquelle réagir",
            required: args => args.help == undefined
        },
    };

    static listenings = {}; /* example : {
    "773657730388852746": { // id d'un serveur
        "775101704638169148": { // id d'un channel
                "784849560765464586": { //id d'un message
                    yoyo: true, // une emote (écoute activée)
                    nod: false // une autre emote (écoute désactivée)
                }
            }
         }
        }*/

    static display = true;
    static description = "Pour envoyer un message sur un channel indiqué, quand une réaction à été detectée sur un autre message.";
    static commandName = "notifyOnReact";

    constructor(message: Message) {
        super(message, NotifyOnReact.commandName);
        this.listenings = NotifyOnReact.listenings;
    }

    listenings: any;

    async action(args: { help: boolean, listen: {channel: GuildChannel, message: Message}, emoteToReact: GuildEmoji|string, messageToWrite: string, channelToWrite: GuildChannel },bot) { // notifyOnReact --listen #ChannelAEcouter/IdDuMessageAEcouter -e :emoteAEcouter: --message '$user$ a réagit à ce message' --writeChannel #channelSurLequelEcrire

        let { help, listen, emoteToReact, messageToWrite, channelToWrite } = args;

        let channelToListen,messageToListen;
        if (listen) {
            channelToListen = listen.channel;
            messageToListen = listen.message
        }

        if (help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild == null) {
            this.sendErrors({
                name: "Guild missing",
                value: "We cannot find the message guild"
            });
            return false;
        }

        if (messageToListen.guild == null) {
            this.sendErrors({
                name: "Guild missing in the message to listen",
                value: "We cannot find the guild in the message to listen"
            });
            return false;
        }

        const emoteName = emoteToReact instanceof GuildEmoji ? emoteToReact.name : emoteToReact;

        if (this.listenings[this.message.guild.id] &&
            this.listenings[this.message.guild.id][listen.channel.id] &&
            this.listenings[this.message.guild.id][listen.channel.id][listen.message.id] &&
            this.listenings[this.message.guild.id][listen.channel.id][listen.message.id][emoteName]) {
            this.sendErrors({
                name: "Déjà écouté",
                value: "Ce message est déjà écouté sur cette émote"
            });
            return false;
        }

        const serverId = messageToListen.guild.id;

        if (typeof(this.listenings[serverId]) == "undefined") {
            this.listenings[serverId] = {};
        }
        if (typeof(this.listenings[serverId][channelToListen.id]) == "undefined") {
            this.listenings[serverId][channelToListen.id] = {};
        }
        if (typeof(this.listenings[serverId][channelToListen.id][messageToListen.id]) == "undefined") {
            this.listenings[serverId][channelToListen.id][messageToListen.id] = {};
        }
        this.listenings[serverId][channelToListen.id][messageToListen.id][emoteName] = true; // Set the key of that reaction listener in the listenings Object

        NotifyOnReact.saveNotifyOnReact(messageToListen, channelToWrite, messageToWrite, emoteName, channelToListen);
        NotifyOnReact.reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteName, channelToListen);

        this.message.channel.send("Command sucessfully executed, all reactions to this message will be notified");
        return true;
    }

    static async reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteName, channelToListen) {
        const serverId = messageToListen.guild.id;

        let userWhoReact;
        const filter = (reaction, user) => {
            userWhoReact = user;
            return reaction.emoji.name == emoteName;
        };
        messageToListen.awaitReactions(filter, { max: 1 })
            .then(_ => {
                if (!userWhoReact) return;
                if (!this.listenings[serverId][channelToListen.id][messageToListen.id][emoteName])  { // Detect if the listening on the message has been disabled
                    delete this.listenings[serverId][channelToListen.id][messageToListen.id][emoteName]; // And delete the useless keys in the listenings object

                    if (Object.keys(this.listenings[serverId][channelToListen.id][messageToListen.id]).length == 0) {
                        delete this.listenings[serverId][channelToListen.id][messageToListen.id];
                    }
                    if (Object.keys(this.listenings[serverId][channelToListen.id]).length == 0) {
                        delete this.listenings[serverId][channelToListen.id];
                    }
                    if (Object.keys(this.listenings[serverId]).length == 0) {
                        delete this.listenings[serverId];
                    }
                    return;
                }
                const variables: Object = {
                    user: "<@"+userWhoReact.id+">"
                }
                let toWrite = messageToWrite;
                for (let key in variables) {
                    const regex = new RegExp("\\$( )*"+key+"( )*\\$");
                    toWrite = toWrite.replace(regex, variables[key]);
                }
                channelToWrite.send(toWrite);

                this.reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteName, channelToListen);
            })
            .catch(e => {
                console.log("Catch event in reactingAndNotifyOnMessage() function ");
                console.error(e);
            });
    }

    static saveNotifyOnReact(messageToListen, channelToWrite, messageToWrite, emoteName, channelToListen) {
        const storedNotifyOnReact: IStoredNotifyOnReact = {
            emoteName: emoteName,
            channelToListenId: channelToListen.id,
            messageToListenId: messageToListen.id,
            messageToWrite: messageToWrite,
            channelToWriteId: channelToWrite.id,
            serverId: messageToListen.guild.id
        };

        StoredNotifyOnReact.create(storedNotifyOnReact);
    }

    static async applyNotifyOnReactAtStarting(bot) { // Detect notifyOnReacts storeds in the database and apply them
        const channels = {};
        const storedNotifyOnReacts: Array<IStoredNotifyOnReact> = await StoredNotifyOnReact.find({});
        for (let i=0;i<storedNotifyOnReacts.length;i++) {
            const storedNotifyOnReact = storedNotifyOnReacts[i];
            const serverId = storedNotifyOnReact.serverId; // @ts-ignore
            const deleteNotif = () => existingCommands.CancelNotifyOnReact.deleteNotifyOnReactInBdd(serverId,storedNotifyOnReact.channelToListenId,storedNotifyOnReact.messageToListenId,storedNotifyOnReact.emoteName);

            const server = bot.guilds.cache.get(serverId);
            if (server == undefined) continue;

            const channelToListen = server.channels.cache.get(storedNotifyOnReact.channelToListenId);
            if (channelToListen == undefined) {
                deleteNotif();
                continue;
            }
            let messageToListen: null|Message = null;
            try {
                // @ts-ignore
                messageToListen = await channelToListen.messages.fetch(storedNotifyOnReact.messageToListenId);
            } catch (e) {}
            if (messageToListen == null) {
                deleteNotif();
                continue;
            }

            const channelToWrite = server.channels.cache.get(storedNotifyOnReact.channelToWriteId);
            if (channelToWrite == undefined) {
                deleteNotif();
                continue;
            }

            if (typeof (this.listenings[serverId]) == "undefined") {
                this.listenings[serverId] = {};
            }
            if (typeof (this.listenings[serverId][channelToListen.id]) == "undefined") {
                this.listenings[serverId][channelToListen.id] = {};
            }
            if (typeof (this.listenings[serverId][channelToListen.id][messageToListen.id]) == "undefined") {
                this.listenings[serverId][channelToListen.id][messageToListen.id] = {};
            }
            this.listenings[serverId][channelToListen.id][messageToListen.id][storedNotifyOnReact.emoteName] = true; // Set the key of that reaction listener in the listenings Object

            NotifyOnReact.reactingAndNotifyOnMessage(messageToListen, channelToWrite, storedNotifyOnReact.messageToWrite, storedNotifyOnReact.emoteName, channelToListen);

            if (!channels[channelToWrite.id]) {
                channels[channelToWrite.id] = true; // @ts-ignore
                channelToWrite.send("Le serveur du bot a redémarré. Une écoute de réaction sera notifiée sur ce channel");
            }
        }
    }

    help(Embed) {
        Embed.addFields({
            name: "Exemple :",
            value: config.command_prefix+"notifyOnReact --listen #ChannelAEcouter/IdDuMessageAEcouter -e :emoteAEcouter: --message '$user$ a réagit à ce message' --writeChannel #channelSurLequelEcrire"
        });
    }
}
