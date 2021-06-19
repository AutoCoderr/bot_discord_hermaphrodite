import Command from "../Classes/Command";
import config from "../config";
import {GuildChannel, GuildMember, Message} from "discord.js";
import {getArgsModelHistory, getHistory} from "../Classes/OtherFunctions";

export default class HistoryExec extends Command {

    argsModel = getArgsModelHistory(this.message);

    static display = true;
    static description = "Pour executer des commandes de l'historique.";
    static commandName = "historyExec";

    constructor(message: Message) {
        super(message, HistoryExec.commandName);
    }


    async action(args: {help: boolean, command: string, sort: string, limit: number, channel: GuildChannel, user: GuildMember}, bot) {

        if (args.help) {
            this.displayHelp();
            return false;
        }

        const histories = await getHistory(this.message,args);

        this.message.channel.send("Execute : ");

        if (histories.length > 0) {
            for (let history of histories) {
                this.message.channel.send(config.command_prefix+history.command);
            }
        } else {
            this.message.channel.send("Aucune commande trouvée")
        }

        return true;
    }

    saveHistory() {} // overload saveHistory of Command class to save nothing in the history

    help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "-c ou --command, la commande dont on souhaite executer l'historique\n"+
                "-s ou --sort, 'asc' ou 'desc/dsc' ('asc' par défaut) pour trier du debut à la fin ou de la fin au début dans l'ordre chronologique\n"+
                "-l ou --limit, Pour executer les n premières commandes de la listes\n"+
                "-ch ou --channel, Pour éxecuté les commandes ayant été executées dans un channel spécifique\n"+
                "-u ou --user, Pour éxecuter les commandes ayant été executées par un utilisateur spécifique"
        }).addFields({
            name: "Exemples :",
            value: config.command_prefix+"historyExec --command notifyOnReact -l 10 --channel #blabla"
        })
    }
}
