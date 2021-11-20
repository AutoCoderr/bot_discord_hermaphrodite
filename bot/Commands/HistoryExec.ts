import Command from "../Classes/Command";
import config from "../config";
import {Guild, GuildChannel, GuildMember, Message, MessageEmbed, TextBasedChannels, User} from "discord.js";
import {getArgsModelHistory, getHistory} from "../Classes/OtherFunctions";

export default class HistoryExec extends Command {
    static display = true;
    static description = "Pour executer des commandes de l'historique.";
    static commandName = "historyExec";

    static argsModel = getArgsModelHistory();

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommand: null|string = null) {
        super(channel, member, guild, writtenCommand, HistoryExec.commandName, HistoryExec.argsModel);
    }


    async action(args: {help: boolean, commands: typeof Command[], sort: string, limit: number, channels: GuildChannel[], users: GuildMember[]}, bot) {

        if (args.help)
            return this.response(false, this.displayHelp());

        const histories = await getHistory(this,args);

        const messages: string[] = [];

        messages.push("Execute : ");

        if (histories.length > 0) {
            for (let history of histories) {
                messages.push(config.command_prefix+history.command);
            }
        } else {
            messages.push("Aucune commande trouvée")
        }

        return this.response(true, messages);
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
