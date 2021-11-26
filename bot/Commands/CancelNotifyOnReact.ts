import config from "../config";
import Command from "../Classes/Command";
import { forEachNotifyOnReact } from "../Classes/OtherFunctions";
import { existingCommands } from "../Classes/CommandsDescription";
import StoredNotifyOnReact from "../Models/StoredNotifyOnReact";
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

export default class CancelNotifyOnReact extends Command {
    static description = "Pour désactiver l'écoute d'une réaction sur un ou plusieurs messages.";
    static display = true;
    static commandName = "cancelNotifyOnReact"

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

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommand: null|string = null) {
        super(channel, member, guild, writtenCommand, CancelNotifyOnReact.commandName, CancelNotifyOnReact.argsModel);
    }

    async action(args: {help: boolean, channel: GuildChannel, message: Message, emote: GuildEmoji|string},bot) {
        let {help,channel,message,emote} = args;

        if (help)
            return this.response(false, this.displayHelp());

        if (this.guild == null || this.member == null) {
            return this.response(
                false,
                this.sendErrors({
                    name: "Missing data",
                    value: "We can't find guild or member"
                })
            );
        }
        if (message && message.guild == null) {
            return this.response(
                false,
                this.sendErrors({
                    name: "Missing data",
                    value: "We can't find guild"
                })
            );
        }

        let emoteName = emote ? (emote instanceof GuildEmoji ? emote.name : emote) : undefined;

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('écoutes de réactions désactivées:')
            .setDescription("Ceci est la liste des écoutes de réactions désactivées :")
            .setTimestamp();
        // @ts-ignore
        let listenings = existingCommands.NotifyOnReact.listenings[this.guild.id];
        if (emoteName == undefined) {
            await forEachNotifyOnReact((found, channel, messageId, contentMessage, emoteName) => {
                if (found) { // @ts-ignore
                    CancelNotifyOnReact.deleteNotifyOnReactInBdd(this.guild.id,channel.id,messageId,emoteName);
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
            }, channel, message, this);
        } else if (listenings && listenings[channel.id] && listenings[channel.id][message.id] && listenings[channel.id][message.id][emoteName]) { // @ts-ignore
            CancelNotifyOnReact.deleteNotifyOnReactInBdd(message.guild.id,channel.id,message.id,emoteName);
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
        return this.response(true, {embeds: [Embed]});
    }

    static async deleteNotifyOnReactInBdd(serverId,channelId,messageId,emoteName) {
        await StoredNotifyOnReact.deleteOne({
            serverId: serverId,
            channelToListenId: channelId,
            messageToListenId: messageId,
            emoteName: emoteName
        });
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "--channel #channel",
                    value: "Désactiver les écoutes de réaction du channel #channel"
                },
                {
                    name: "--channel #channel --message idDuMessage",
                    value: "Désactiver les écoutes de réaction du channel #channel sur le message spécifié par son id"
                },
                {
                    name: "-ch #channel -m idDuMessage -e :emote:",
                    value: "Désactiver les écoutes de réaction du channel #channel sur le message spécifié par son id, sur l'émote mentionnée"
                },
                {
                    name: "--all",
                    value: "Désactiver toutes les écoutes de réactions du serveur"
                },
                {
                    name: "-h",
                    value: "Afficher l'aide"
                }
            ].map(field => ({
                name: config.command_prefix+this.commandName+" "+field.name,
                value: field.value
            })))
    }

}
