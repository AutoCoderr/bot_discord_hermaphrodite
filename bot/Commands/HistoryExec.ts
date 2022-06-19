import Command from "../Classes/Command";
import config from "../config";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildChannel,
    GuildMember,
    MessageEmbed,
    TextChannel,
    User
} from "discord.js";
import {getArgsModelHistory, getHistory} from "../Classes/OtherFunctions";

export default class HistoryExec extends Command {
    static display = true;
    static description = "Pour executer des commandes de l'historique.";
    static commandName = "historyExec";

    static argsModel = getArgsModelHistory();

    constructor(channel: TextChannel, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, HistoryExec.commandName, HistoryExec.argsModel);
    }


    async action(args: {commands: typeof Command[], sort: string, limit: number, channels: GuildChannel[], users: GuildMember[]}, bot) {

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
            .addField(
                config.command_prefix+this.commandName+" --command notifyOnReact -l 10 --channel #blabla -s desc -u @toto",
                "Executer les 10 dernières commandes notifyOnReact dans l'ordre décroissant, sur le channel #blabla, effectuées par l'utilisateur @toto");
    }
}
