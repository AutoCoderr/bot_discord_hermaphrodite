import config from "../config";
import Command from "../Classes/Command";
import { forEachNotifyOnReact } from "../Classes/OtherFunctions";
import { existingCommands } from "../Classes/CommandsDescription";
import StoredNotifyOnReact from "../Models/StoredNotifyOnReact";
import Discord, {GuildChannel, GuildEmoji, Message} from "discord.js";

export default class CancelNotifyOnReact extends Command {

    argsModel = {
        help: {
            fields: ["--help", "-h"],
            type: "boolean",
            description: "Pour afficher l'aide",
            required: false
        },
        all: {
            fields: ["--all"],
            type: "boolean",
            description: "à mettre sans rien d'autre, pour désactiver l'écoute sur tout les messages",
            required: false
        },
        channel: {
            fields: ["--channel","-ch"],
            type:"channel",
            description: "Spécifier le channel sur lequel désactifier l'écoute de réaction",
            required: args => (args.help == undefined || !args.help) && ( args.all == undefined || !args.all )
        },
        emote: {
            fields: ["--emote", "-e"],
            type: "emote",
            description: "Spécifier l'émote pour laquelle il faut désactiver l'écoute (nécessite --channel et --message)",
            required: false
        },
        message: {
            fields: ["--message", "-m"],
            type: "message",
            description: "Spécifier l'id du message sur lequel désactiver l'écoute (nécessite le champs --channel pour savoir où est le message)",
            required: args => args.emote != undefined,
            moreDatas: (args) => args.channel
        }
    };

    static description = "Pour désactiver l'écoute d'une réaction sur un ou plusieurs messages.";
    static commandName = "cancelNotifyOnReact"

    constructor(message: Message) {
        super(message, CancelNotifyOnReact.commandName);
    }

    async action(args: {help: boolean, channel: GuildChannel, message: Message, emote: GuildEmoji},bot) {
        let {help,channel,message,emote} = args;

        if (help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild == null || this.message.member == null) {
            this.sendErrors({
                name: "Missing data",
                value: "We can't find guild or member in the message object"
            });
            return false;
        }
        if (message && message.guild == null) {
            this.sendErrors({
                name: "Missing data",
                value: "We can't find guild in the given message"
            });
            return false;
        }

        let emoteName = emote ? emote.name : undefined;

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('écoutes de réactions désactivées:')
            .setDescription("Ceci est la liste des écoutes de réactions désactivées :")
            .setTimestamp();
        // @ts-ignore
        let listenings = existingCommands.NotifyOnReact.listenings[this.message.guild.id];
        if (emoteName == undefined) {
            await forEachNotifyOnReact((found, channel, messageId, contentMessage, emoteName) => {
                if (found) { // @ts-ignore
                    this.deleteNotifyOnReactInBdd(this.message.guild.id,channel.id,messageId,emoteName);
                    listenings[channel.id][messageId][emoteName] = false;
                    Embed.addFields({
                        name: "Supprimée : sur '#" + channel.name + "' (" + contentMessage + ") :" + emoteName + ":",
                        value: "Cette écoute de réaction a été supprimée"
                    });
                } else {
                    Embed.addFields({
                        name: "Aucune réaction",
                        value: "Aucune réaction n'a été trouvée et supprimée"
                    });
                }
            }, channel, message, this.message);
        } else if (listenings && listenings[channel.id] && listenings[channel.id][message.id] && listenings[channel.id][message.id][emoteName]) { // @ts-ignore
            this.deleteNotifyOnReactInBdd(message.guild.id,channel.id,message.id,emoteName);
            listenings[channel.id][message.id][emoteName] = false;
            Embed.addFields({
                name: "sur '#" + channel.name + "' (" + message.content + ") :" + emoteName + ":",
                value: "Cette écoute de réaction a été supprimée"
            });
        } else {
            Embed.addFields({
                name: "Aucune réaction",
                value: "Aucune réaction n'a été trouvée et supprimée"
            });
        }

        this.message.channel.send(Embed);
        return true;
    }

    async deleteNotifyOnReactInBdd(serverId,channelId,messageId,emoteName) {
        await StoredNotifyOnReact.deleteOne({
            serverId: serverId,
            channelToListenId: channelId,
            messageToListenId: messageId,
            emoteName: emoteName
        });
    }

    help(Embed) {
            Embed.addFields({
                name: "Exemples :",
                value: config.command_prefix+this.commandName+" --channel #leChannel\n"+
                    config.command_prefix+this.commandName+" --channel #leChannel --message idDuMessage\n"+
                    config.command_prefix+this.commandName+" -ch #leChannel -m idDuMessage -e :emote: \n"+
                    config.command_prefix+this.commandName+" --all"
            });
    }

}
