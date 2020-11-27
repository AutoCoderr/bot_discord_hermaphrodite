import config from "../config";
import Command from "../Classes/Command";

export default class HistoryCmd extends Command {
    static match(message) {
        return message.content.split(" ")[0] == config.command_prefix+"history";
    }

    static async action(message, bot) {
        this.displayHelp(message);
        return true;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "-c ou --command, la commande dont on souhaite voir l'historique\n"+
                "-s ou --sort, 'ACD' ou 'DESC' ('ACD' par défaut) pour trier du debut à la fin ou de la fin au début dans l'ordre chronologique\n"+
                "-l ou --limit, Pour afficher les n dernières commandes de la listes\n"+
                "-ch ou --channel, Pour afficher les commandes executées dans un channel spécifique"
        }).addFields({
                name: "Exemples :",
                value: config.command_prefix+"history --command notifyOnReact -l 10 --channel #blabla"
            })
    }

    static async saveHistory(message) {} // overload saveHistory of Command class to save nothing in the history
}