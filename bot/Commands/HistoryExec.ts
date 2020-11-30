import Command from "../Classes/Command";
import config from "../config";
import {getHistory} from "../Classes/OtherFunctions";

export class HistoryExec extends Command {
    static commandName = "historyExec";

    static async action(message, bot) {

        const args = this.parseCommand(message);

        if (args[0] == "help") {
            this.displayHelp(message);
            return true;
        }

        const response = await getHistory(message,args);

        if (response.errors.length > 0) {
            this.sendErrors(message, response.errors);
            return false;
        }

        const histories = response.histories;

        message.channel.send("Execute : ");

        if (histories.length > 0) {
            for (let history of histories) {
                message.channel.send(config.command_prefix+history.command);
            }
        } else {
            message.channel.send("Aucune commande trouvée")
        }

        return true;
    }

    static async saveHistory(message) {} // overload saveHistory of Command class to save nothing in the history

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
            value: config.command_prefix+"historyExec --command notifyOnReact -l 10 --channel #blabla"
        })
    }
}