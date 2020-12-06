import config from "../config";
import { checkArgumentsNotifyOnReact, forEachNotifyOnReact } from "../Classes/OtherFunctions";
import Command from "../Classes/Command";
import Discord from "discord.js";

export class ListNotifyOnReact extends Command {
    static commandName = "listNotifyOnReact";

    static async action(message,bot) {
        const args = this.parseCommand(message);
        if (!args) return false;

        if (typeof(args[0]) != "undefined" && args[0] == "help") {
            this.displayHelp(message);
            return true;
        }

        //{errors, channelId, channel, messageId, contentMessage}
        const checked = await checkArgumentsNotifyOnReact(message, args)

        let errors = checked.errors,
            channelId = checked.channelId,
            channel = checked.channel,
            messageId = checked.messageId,
            contentMessage = checked.contentMessage;

        if (errors.length > 0) {
            this.sendErrors(message, errors);
            return false;
        }

        // Affiche dans un Embed, l'ensemble des écoutes de réactions qu'il y a

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Listes des écoutes de réactions :')
            .setDescription("Ceci est la liste dess écoutes de réactions :")
            .setTimestamp();

        await forEachNotifyOnReact((found, channel, contentMessage, emote) => {
            if (found) {
                Embed.addFields({
                    name: "Sur '#" + channel.name + "' (" + contentMessage + ") :" + emote + ":",
                    value: "Il y a une écoute de réaction sur ce message"
                });
            } else {
                Embed.addFields({
                    name: "Aucune réaction",
                    value: "Aucune réaction n'a été trouvée"
                });
            }
        }, channelId, channel, messageId, contentMessage, message, message.guild.id);

        message.channel.send(Embed);
        return true;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "--channel ou -ch, Spécifier le channel sur lequel lister les écoutes de réactions \n"+
                "--message ou -m, Spécifier l'id du message sur lequel afficher les réactions (nécessite le champs --channel pour savoir où est le message)"
        })
            .addFields({
                name: "Exemples :",
                value: config.command_prefix+this.commandName+" -channel #leChannel\n"+
                    config.command_prefix+this.commandName+" -channel #leChannel -m idDuMessage\n"
            });
    }
}