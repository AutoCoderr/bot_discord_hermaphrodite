import config from "../config";
import Command from "../Classes/Command";
import {getArgsModelHistory, getHistory} from "../Classes/OtherFunctions";
import Discord, {GuildChannel, GuildMember, Message, MessageEmbed} from "discord.js";
import {existingCommands} from "../Classes/CommandsDescription";

export default class HistoryCmd extends Command {

    argsModel = getArgsModelHistory(this.message);

    static display = true;
    static description = "Pour accéder à l'historique des commandes.";
    static commandName = "history";

    constructor(message: Message) {
        super(message, HistoryCmd.commandName);
    }

    async action(args: {help: boolean, command: string, sort: string, limit: number, channel: GuildChannel, user: GuildMember}, bot) {

        if (args.help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild == null) {
            this.sendErrors({
                name: "Guild missing",
                value: "We cannot find the message guild"
            });
            return false;
        }

        const response = await getHistory(this.message,args);

        const histories = response.histories;

        let Embeds: Array<any> = [];
        let Embed;

        const historByEmbed = 25;

        if (histories.length > 0) {
            for (let i=0;i<histories.length;i++) {
                if (i % historByEmbed == 0) {
                    Embed = new Discord.MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle("L'historique des commandes (Partie "+((i/historByEmbed)+1)+") "+(<number>response.limit > 0 ? "(limité à "+response.limit+")" : "(Sans limite)")+" :")
                        .setDescription("Liste des commandes qui ont été tapées :")
                        .setTimestamp();
                    Embeds.push(Embed);
                }
                const history = histories[i];
                const user = this.message.guild.members.cache.get(history.userId);
                const channel = this.message.guild.channels.cache.get(history.channelId);

                const userName = user != undefined ? user.nickname : "unknown";
                const channelName = channel != undefined ? channel.name : "unknown"

                Embed.addFields({
                    name: "[" + history.dateTime + "] "+userName+" sur #"+channelName+" :",
                    value: config.command_prefix+history.command
                });
            }
        } else {
            Embeds.push(new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle("L'historique des commandes :")
                .setDescription("Liste des commandes qui ont été tapées :")
                .setTimestamp()
                .addFields({
                    name: "Aucun historique",
                    value: "Aucun élément n'a été trouvé dans l'historique"
                }));
        }
        for (let Embed of Embeds) {
            this.message.channel.send(Embed);
        }
        return true;
    }

    help(Embed) {
        Embed.addFields({
                name: "Exemples :",
                value: config.command_prefix+"history --command notifyOnReact -l 10 --channel #blabla"
            })
    }

    saveHistory() {} // overload saveHistory of Command class to save nothing in the history
}