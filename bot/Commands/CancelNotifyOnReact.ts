import config from "../config";
import Command from "../Classes/Command";
import { checkArgumentsNotifyOnReact, extractEmoteName, forEachNotifyOnReact } from "../Classes/OtherFunctions";
import { existingCommands } from "../Classes/CommandsDescription";
import StoredNotifyOnReact, { IStoredNotifyOnReact } from "../Models/StoredNotifyOnReact";
import Discord, {Message} from "discord.js";

export class CancelNotifyOnReact extends Command {
    static staticCommandName = "cancelNotifyOnReact"

    constructor(message: Message) {
        super(message, CancelNotifyOnReact.staticCommandName);
    }

    async action(bot) {
        const args = this.parseCommand();
        if (!args) return false;

        if (typeof(args[0]) != "undefined" && args[0] == "help") {
            this.displayHelp();
            return false;
        }

        const checked = await checkArgumentsNotifyOnReact(this.message, args)

        let errors = checked.errors,
            channelId = checked.channelId,
            channel = checked.channel,
            messageId = checked.messageId,
            contentMessage = checked.contentMessage;

        let emote = null;
        if (typeof(args.e) != "undefined") {
            emote = extractEmoteName(args.e);
            if (!emote) {
                errors.push({name: "Invalid emote", value: "Specified emote is invalid"});
            }
        }

        if (this.message.guild == null || this.message.member == null) {
            errors.push({name: "Missing data", value: "We can't find guild or member in the message object"});
        }

        if (errors.length > 0) {
            this.sendErrors(errors);
            return false;
        }

        if  (channelId == null && messageId == null && emote == null) {
            if (args[0] != "all") {
                this.displayHelp();
                return true;
            }
        }

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('écoutes de réactions désactivées:')
            .setDescription("Ceci est la liste des écoutes de réactions désactivées :")
            .setTimestamp();
        // @ts-ignore
        let listenings = existingCommands.notifyOnReact.commandClass.listenings[this.message.guild.id];
        if (emote == null) {
            await forEachNotifyOnReact((found, channel, messageId, contentMessage, emote) => {
                if (found) { // @ts-ignore
                    this.deleteNotifyOnReactInBdd(this.message.guild.id,channel.id,messageId,emote);
                    listenings[channel.id][messageId][emote] = false;
                    Embed.addFields({
                        name: "Supprimée : sur '#" + channel.name + "' (" + contentMessage + ") :" + emote + ":",
                        value: "Cette écoute de réaction a été supprimée"
                    });
                } else {
                    Embed.addFields({
                        name: "Aucune réaction",
                        value: "Aucune réaction n'a été trouvée et supprimée"
                    });
                }
            }, channelId, channel, messageId, contentMessage, this.message);
        } else {
            if (typeof(listenings[channel.id][messageId][emote]) != "undefined") { // @ts-ignore
                this.deleteNotifyOnReactInBdd(message.guild.id,channel.id,messageId,emote);
                listenings[channel.id][messageId][emote] = false;
                Embed.addFields({
                    name: "sur '#" + channel.name + "' (" + contentMessage + ") :" + emote + ":",
                    value: "Cette écoute de réaction a été supprimée"
                });
            } else {
                Embed.addFields({
                    name: "Aucune réaction",
                    value: "Aucune réaction n'a été trouvée et supprimée"
                });
            }
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
            name: "Arguments :",
            value: "--channel ou -ch, Spécifier le channel sur lequel désactifier l'écoute de réaction \n"+
                "\t(si pas de message spécifié, désactive l'écoute sur tout les messages de ce channel sur lesquels il y a une écoute)\n"+
                "--message ou -m, Spécifier l'id du message sur lequel désactiver l'écoute (nécessite le champs --channel pour savoir où est le message)\n"+
                "-e, Spécifier l'émote pour laquelle il faut désactiver l'écoute (nécessite --channel et \n--message)\n"+
                "all, à mettre sans rien d'autre, pour désactiver l'écoute sur tout les messages"
        })
            .addFields({
                name: "Exemples :",
                value: config.command_prefix+this.commandName+" --channel #leChannel\n"+
                    config.command_prefix+this.commandName+" --channel #leChannel --message idDuMessage\n"+
                    config.command_prefix+this.commandName+" -ch #leChannel -m idDuMessage -e :emote: \n"+
                    config.command_prefix+this.commandName+" all"
            });
    }

}