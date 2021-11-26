import config from "../config";
import {forEachNotifyOnReact} from "../Classes/OtherFunctions";
import Command from "../Classes/Command";
import Discord, {
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

export default class ListNotifyOnReact extends Command {
    static display = true;
    static description = "Pour lister les messages, sur lesquels il y a une écoute de réaction.";
    static commandName = "listNotifyOnReact";

    static argsModel = {
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

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommand: null|string = null) {
        super(channel, member, guild, writtenCommand, ListNotifyOnReact.commandName, ListNotifyOnReact.argsModel);
    }

    async action(args: {help: boolean, channel: GuildChannel, message: Message, emote: GuildEmoji|string}, bot) {
        let {help,channel,message,emote} = args;

        if (help)
            return this.response(false, this.displayHelp());

        if (this.guild == null) return this.response(false,
            this.sendErrors({
                name: "Guild missing",
                value: "We cannot find the guild"
            })
        );

        let emoteName = emote ? (emote instanceof GuildEmoji ? emote.name : emote) : undefined;

        // Affiche dans un Embed, l'ensemble des écoutes de réactions qu'il y a

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Listes des écoutes de réactions :')
            .setDescription("Ceci est la liste des écoutes de réactions :")
            .setTimestamp();

        // @ts-ignore
        let listenings = existingCommands.NotifyOnReact.listenings[this.guild.id];

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
            }, channel, message, this);
        } else if (listenings && listenings[channel.id] && listenings[channel.id][message.id] && listenings[channel.id][message.id][emoteName]) {
            const contentMessage = message.content.substring(0,Math.min(20,message.content.length)) + "...";
            Embed.addFields({
                name: "sur '#" + channel.name + "' (" + contentMessage + ") :" + emoteName + ":",
                value: "Cette écoute de réaction a été supprimée"
            });
        } else {
            Embed.addFields({
                name: "Aucune réaction",
                value: "Aucune réaction n'a été trouvée et supprimée"
            });
        }

        return this.response(true, {embeds: [Embed]});
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "--channel #leChannel",
                    value: "Lister les écoutes de réaction du channel #leChannel"
                },
                {
                    name: "--channel #leChannel -m idDuMessage",
                    value: "Lister les écoutes de réaction du channel #leChannel sur le message mentionné"
                },
                {
                    name: "--all",
                    value: "Afficher toutes les écoutes de réaction du serveur"
                }
            ].map(field => ({
                name: config.command_prefix+this.commandName+" "+field.name,
                value: field.value
            })));
    }
}
