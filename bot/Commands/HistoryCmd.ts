import config from "../config";
import Command from "../Classes/Command";
import {getArgsModelHistory, getHistory, splitFieldsEmbed} from "../Classes/OtherFunctions";
import {GuildChannel, GuildMember, Message, MessageEmbed} from "discord.js";
import {IHistory} from "../Models/History";

export default class HistoryCmd extends Command {

    argsModel = getArgsModelHistory(this.message);

    static display = true;
    static description = "Pour accéder à l'historique des commandes.";
    static commandName = "history";

    constructor(message: Message) {
        super(message, HistoryCmd.commandName);
    }

    async action(args: {help: boolean, commands: string, sort: string, limit: number, channels: GuildChannel[], users: GuildMember[]}, bot) {

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

        const histories: Array<IHistory> = await getHistory(this.message,args);

        let embeds: Array<MessageEmbed> = [];

        const historByEmbed = 25;

        if (histories.length > 0) {
            embeds = splitFieldsEmbed(historByEmbed,histories.map(history => { //@ts-ignore
                const user = this.message.guild.members.cache.get(history.userId); //@ts-ignore
                const channel = this.message.guild.channels.cache.get(history.channelId);

                const userName = user != undefined ? (user.nickname ?? user.user.username) : "<@"+history.userId+">";
                const channelName = channel != undefined ? channel.name : history.channelId

                return {
                    name: "[" + history.dateTime + "] "+userName+" sur #"+channelName+" :",
                    value: config.command_prefix+history.command
                };
            }), (Embed: MessageEmbed, partNb: number) => {
                Embed
                    .setTitle("L'historique des commandes (Partie "+partNb+") "+(<number>args.limit > 0 ? "(limité à "+args.limit+")" : "(Sans limite)")+" :")
                    .setDescription("Liste des commandes qui ont été tapées :");
            });
        } else {
            embeds.push(new MessageEmbed()
                .setColor('#0099ff')
                .setTitle("L'historique des commandes :")
                .setDescription("Liste des commandes qui ont été tapées :")
                .setTimestamp()
                .addFields({
                    name: "Aucun historique",
                    value: "Aucun élément n'a été trouvé dans l'historique"
                }));
        }
        this.message.channel.send({embeds});
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
