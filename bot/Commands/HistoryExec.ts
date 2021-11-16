import Command from "../Classes/Command";
import config from "../config";
import {GuildChannel, GuildMember, Message, MessageEmbed} from "discord.js";
import {getArgsModelHistory, getHistory} from "../Classes/OtherFunctions";

export default class HistoryExec extends Command {
    static display = true;
    static description = "Pour executer des commandes de l'historique.";
    static commandName = "historyExec";

    static argsModel = getArgsModelHistory();

    constructor(message: Message) {
        super(message, HistoryExec.commandName, HistoryExec.argsModel);
    }


    async action(args: {help: boolean, commands: typeof Command[], sort: string, limit: number, channels: GuildChannel[], users: GuildMember[]}, bot) {

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

    help() {
        return new MessageEmbed()
            .setTitle("Exemples")
            .addFields([
                {
                    name: config.command_prefix+this.commandName+" --command notifyOnReact -l 10 --channel #blabla -s desc -u @toto",
                    value: "Executer les 10 dernières commandes notifyOnReact dans l'ordre décroissant, sur le channel #blabla, effectuées par l'utilisateur @toto"
                }
            ]);
    }
}
