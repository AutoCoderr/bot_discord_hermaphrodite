import Command from "../Classes/Command";
import config from "../config";
import {
    CommandInteractionOptionResolver, EmbedBuilder,
    Guild,
    GuildChannel,
    GuildMember,
    TextChannel,
    User
} from "discord.js";
import {getArgsModelHistory, getHistory} from "../Classes/OtherFunctions";
import {IArgsModel} from "../interfaces/CommandInterfaces";

export default class HistoryExec extends Command {
    static display = true;
    static description = "Pour executer des commandes de l'historique.";
    static commandName = "historyExec";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel: IArgsModel = getArgsModelHistory();

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
        return new EmbedBuilder()
            .setTitle("Exemples")
            .addFields({
                name: config.command_prefix + this.commandName + " --command notifyOnReact -l 10 --channel #blabla -s desc -u @toto",
                value: "Executer les 10 dernières commandes notifyOnReact dans l'ordre décroissant, sur le channel #blabla, effectuées par l'utilisateur @toto"
            });
    }
}
