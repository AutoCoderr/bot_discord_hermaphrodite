import config from "../config";
import Command from "../Classes/Command";
import StoredNotifyOnReact, { IStoredNotifyOnReact } from "../Models/StoredNotifyOnReact";
import {
    ClientUser,
    CommandInteractionOptionResolver, Emoji,
    Guild,
    GuildChannel,
    GuildEmoji,
    GuildMember,
    Message,
    MessageEmbed,
    TextBasedChannels,
    User
} from "discord.js";
import {existingCommands} from "../Classes/CommandsDescription";
import {checkTypes} from "../Classes/TypeChecker";
import client from "../client";

export default class NotifyOnReact extends Command {
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
    static description = "Pour envoyer un message sur un channel indiqué, quand une réaction à été detectée sur un message.";
    static commandName = "notifyOnReact";

    static slashCommand = true

    static argsModel = {
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
    };

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: string) {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, NotifyOnReact.commandName, NotifyOnReact.argsModel);
        this.listenings = NotifyOnReact.listenings;
    }

    listenings: any;

    async action(args: { channelToListen: GuildChannel, messageToListen: Message, emoteToReact: GuildEmoji|string, messageToWrite: string, channelToWrite: GuildChannel },bot) { // notifyOnReact --listen #ChannelAEcouter/IdDuMessageAEcouter -e :emoteAEcouter: --message '$user$ a réagit à ce message' --writeChannel #channelSurLequelEcrire

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

        if (this.listenings[this.guild.id] &&
            this.listenings[this.guild.id][channelToListen.id] &&
            this.listenings[this.guild.id][channelToListen.id][messageToListen.id] &&
            this.listenings[this.guild.id][channelToListen.id][messageToListen.id][emoteKey]) {
            return this.response(false,
                this.sendErrors({
                    name: "Déjà écouté",
                    value: "Ce message est déjà écouté sur cette émote"
                })
            );
        }

        if (typeof(this.listenings[this.guild.id]) == "undefined") {
            this.listenings[this.guild.id] = {};
        }
        if (typeof(this.listenings[this.guild.id][channelToListen.id]) == "undefined") {
            this.listenings[this.guild.id][channelToListen.id] = {};
        }
        if (typeof(this.listenings[this.guild.id][channelToListen.id][messageToListen.id]) == "undefined") {
            this.listenings[this.guild.id][channelToListen.id][messageToListen.id] = {};
        }
        this.listenings[this.guild.id][channelToListen.id][messageToListen.id][typeof(emoteToReact) === "string" ? emoteToReact : emoteToReact.id] = true; // Set the key of that reaction listener in the listenings Object

        messageToListen.react(emoteToReact);

        NotifyOnReact.saveNotifyOnReact(messageToListen, channelToWrite, messageToWrite, emoteKey, channelToListen);
        NotifyOnReact.reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteKey, channelToListen);

        return this.response(true, "Command sucessfully executed, all reactions to this message will be notified");
    }

    static async reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteKey: string, channelToListen) {
        const serverId = messageToListen.guild.id;

        let userWhoReact;
        const filter = (reaction, user) => {
            userWhoReact = user;
            return (reaction.emoji.id??reaction.emoji.name) === emoteKey;
        };
        messageToListen.awaitReactions({ max: 1 , filter})
            .then(_ => {
                if (!userWhoReact) return;
                if (userWhoReact.id === (<ClientUser>client.user).id) {
                    this.reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteKey, channelToListen);
                    return;
                }
                if (!this.listenings[serverId][channelToListen.id][messageToListen.id][emoteKey])  { // Detect if the listening on the message has been disabled
                    delete this.listenings[serverId][channelToListen.id][messageToListen.id][emoteKey]; // And delete the useless keys in the listenings object

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

                this.reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteKey, channelToListen);
            })
            .catch(e => {
                console.log("Catch event in reactingAndNotifyOnMessage() function ");
                console.error(e);
            });
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
        console.log("Detect stored notifyOnReacts in the database and apply them")
        const channelsListened = {};
        const channelsWhereEmoteNotFound = {};
        const storedNotifyOnReacts: Array<IStoredNotifyOnReact> = await StoredNotifyOnReact.find({});
        for (const {serverId, emoteId, emoteName, channelToListenId, messageToListenId, channelToWriteId, messageToWrite} of storedNotifyOnReacts) {

            const emoteNameOrId: string = <string>(emoteName??emoteId); //@ts-ignore
            const deleteNotif = () => existingCommands.CancelNotifyOnReact.deleteNotifyOnReactInBdd(serverId,channelToListenId,messageToListenId,emoteNameOrId);

            const server: Guild|undefined = bot.guilds.cache.get(serverId);
            if (server == undefined) continue;

            const channelToListen = server.channels.cache.get(channelToListenId);
            if (channelToListen == undefined) {
                deleteNotif();
                continue;
            }
            let messageToListen: null|Message = null;
            try {
                // @ts-ignore
                messageToListen = await channelToListen.messages.fetch(messageToListenId);
            } catch (e) {}
            if (messageToListen == null) {
                deleteNotif();
                continue;
            }

            const channelToWrite = server.channels.cache.get(channelToWriteId);
            if (channelToWrite == undefined) {
                deleteNotif();
                continue;
            }
            let reaction;
            let emote;

            // Si l'émote n'est pas une émote native en unicode, on essaye de la récupérer à partir du nom ou de l'id, sur le serveur, et sur le message à écouter en lui même.
            if (!checkTypes.unicode(emoteNameOrId) && (
                (emoteId &&
                    (emote = server.emojis.cache.get(emoteId)) === undefined &&
                    (emote = (reaction = messageToListen.reactions.cache.find(reaction => reaction.emoji.id === emoteId)) ? reaction.emoji : undefined  ) === undefined
                ) ||
                (emoteName &&
                    (emote = server.emojis.cache.find((emote) => emote.name === emoteName)) === undefined &&
                    (emote = (reaction = messageToListen.reactions.cache.find(reaction => reaction.emoji.name === emoteName)) ? reaction.emoji : undefined  ) === undefined
                )
                )) {
                deleteNotif();
                if (!channelsWhereEmoteNotFound[channelToWrite.id]) {
                    channelsWhereEmoteNotFound[channelToWrite.id] = true; // @ts-ignore
                    channelToWrite.send("Une ou plusieurs emotes n'ont pas été trouvée. Une ou plusieurs écoutes de réaction ont été supprimées");
                }
                continue;
            }

            const emoteKey: string = emote instanceof Emoji ? (<string>emote.id) : emoteNameOrId;

            if (typeof (this.listenings[serverId]) == "undefined") {
                this.listenings[serverId] = {};
            }
            if (typeof (this.listenings[serverId][channelToListen.id]) == "undefined") {
                this.listenings[serverId][channelToListen.id] = {};
            }
            if (typeof (this.listenings[serverId][channelToListen.id][messageToListen.id]) == "undefined") {
                this.listenings[serverId][channelToListen.id][messageToListen.id] = {};
            }
            this.listenings[serverId][channelToListen.id][messageToListen.id][emoteKey] = true; // Set the key of that reaction listener in the listenings Object

            NotifyOnReact.reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteKey, channelToListen);

            if (!channelsListened[channelToWrite.id]) {
                channelsListened[channelToWrite.id] = true; // @ts-ignore
                channelToWrite.send("Le serveur du bot a redémarré. Une écoute de réaction sera notifiée sur ce channel");
            }
        }
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: config.command_prefix+this.commandName+" -lc #ChannelAEcouter -lm IdDuMessageAEcouter -e :emoteAEcouter: --message '$user$ a réagit à ce message' --writeChannel #channelSurLequelEcrire",
                    value: "Créer une écoute pour qu'un message '$user$ a réagit à ce message' soit posté sur le channel #channelSurLequelEcrire à chaque fois qu'on réagit avec l'émote :emoteAEcouter: sur le message ayant l'id IdDuMessageAEcouter dans le channel #ChannelAEcouter"
                }
            ]);
    }
}
