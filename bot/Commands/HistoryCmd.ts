import config from "../config";
import Command from "../Classes/Command";
import { getHistoru } from "../Classes/OtherFunctions";
import Discord from "discord.js";

export class HistoryCmd extends Command {
    static commandName = "history"

    static async action(message, bot) {
        const args = this.parseCommand(message);

        if (args[0] == "help") {
            this.displayHelp(message);
            return true;
        }

        const response = await getHistoru(message,args);

        if (response.errors.length > 0) {
            this.sendErrors(message, response.errors);
            return false;
        }

        const histories = response.histories;

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle("L'historique des commands :")
            .setDescription("Liste des commandes qui ont été tapées :")
            .setTimestamp();

        if (histories.length > 0) {
            for (let history of histories) {
                const user = message.guild.members.cache.get(history.userId);
                const channel = message.guild.channels.cache.get(history.channelId);

                const userName = user != undefined ? user.nickname : "unknown";
                const channelName = channel != undefined ? channel.name : "unknown"

                Embed.addFields({
                    name: "[" + history.dateTime + "] ("+history.commandName+") "+userName+" sur #"+channelName+" :",
                    value: history.command
                });
            }
        } else {
            Embed.addFields({
                name: "Aucun historique",
                value: "Aucun élément n'a été trouvé dans l'historique"
            })
        }
        message.channel.send(Embed);
        return true;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "-c ou --command, la commande dont on souhaite voir l'historique\n"+
                "-s ou --sort, 'asc' ou 'desc/dsc' ('asc' par défaut) pour trier du debut à la fin ou de la fin au début dans l'ordre chronologique\n"+
                "-l ou --limit, Pour afficher les n dernières commandes de la listes\n"+
                "-ch ou --channel, Pour afficher les commandes executées dans un channel spécifique\n"+
                "-u ou --user, Pour afficher les commandes executées par un utilisateur spécifique"
        }).addFields({
                name: "Exemples :",
                value: config.command_prefix+"history --command notifyOnReact -l 10 --channel #blabla"
            })
    }

    static async saveHistory(message) {} // overload saveHistory of Command class to save nothing in the history
}