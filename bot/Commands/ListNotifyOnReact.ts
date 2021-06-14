import config from "../config";
import {forEachNotifyOnReact} from "../Classes/OtherFunctions";
import Command from "../Classes/Command";
import Discord, {GuildChannel, GuildEmoji, Message} from "discord.js";
import {existingCommands} from "../Classes/CommandsDescription";

export default class ListNotifyOnReact extends Command {

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
            description: "à mettre sans rien d'autre, pour afficher l'écoute sur tout les messages",
            required: false
        },
        channel: {
            fields: ["--channel","-ch"],
            type:"channel",
            description: "Spécifier le channel sur lequel afficher les écoutes de réaction",
            required: args => (args.help == undefined || !args.help) && ( args.all == undefined || !args.all )
        },
        emote: {
            fields: ["--emote", "-e"],
            type: "emote",
            description: "Spécifier l'émote pour laquelle il faut afficher l'écoute (nécessite --channel et --message)",
            required: false
        },
        message: {
            fields: ["--message", "-m"],
            type: "message",
            description: "Spécifier l'id du message sur lequel afficher les écoutes (nécessite le champs --channel pour savoir où est le message)",
            required: args => args.emote != undefined,
            moreDatas: (args) => args.channel
        }
    };

    static display = true;
    static description = "Pour lister les messages, sur lesquels il y a une écoute de réaction.";
    static commandName = "listNotifyOnReact";

    constructor(message: Message) {
        super(message, ListNotifyOnReact.commandName);
    }

    async action(args: {help: boolean, channel: GuildChannel, message: Message, emote: GuildEmoji}, bot) {
        let {help,channel,message,emote} = args;

        if (help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild == null) {
            this.sendErrors({
                name: "Missing data",
                value: "We can't find guild in the message object"
            });
            return false;
        }

        let emoteName = emote ? emote.name : undefined;

        // Affiche dans un Embed, l'ensemble des écoutes de réactions qu'il y a

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Listes des écoutes de réactions :')
            .setDescription("Ceci est la liste des écoutes de réactions :")
            .setTimestamp();

        // @ts-ignore
        let listenings = existingCommands.NotifyOnReact.listenings[this.message.guild.id];

        if (emoteName == undefined) {
            await forEachNotifyOnReact((found, channel, messageId, contentMessage, emoteName) => {
                if (found) {
                    Embed.addFields({
                        name: "Sur '#" + channel.name + "' (" + contentMessage + ") :" + emoteName + ":",
                        value: "Il y a une écoute de réaction sur ce message"
                    });
                } else {
                    Embed.addFields({
                        name: "Aucune réaction",
                        value: "Aucune réaction n'a été trouvée"
                    });
                }
            }, channel, message, this.message);
        } else if (listenings && listenings[channel.id] && listenings[channel.id][message.id] && listenings[channel.id][message.id][emoteName]) { // @ts-ignore
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

    help(Embed) {
        Embed.addFields({
                name: "Exemples :",
                value: config.command_prefix+this.commandName+" --channel #leChannel\n"+
                    config.command_prefix+this.commandName+" --channel #leChannel -m idDuMessage\n"+
                    config.command_prefix+this.commandName+" --all\n"
            });
    }
}