import config from "../config";
import Command from "../Classes/Command";
import {getArgsModelHistory, getHistory, splitFieldsEmbed} from "../Classes/OtherFunctions";
import {Guild, GuildChannel, GuildMember, Message, MessageEmbed, TextBasedChannels, User} from "discord.js";
import {IHistory} from "../Models/History";

export default class HistoryCmd extends Command {
    static display = true;
    static description = "Pour accéder à l'historique des commandes.";
    static commandName = "history";

    static argsModel = getArgsModelHistory();

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommand: null|string = null) {
        super(channel, member, guild, writtenCommand, HistoryCmd.commandName, HistoryCmd.argsModel);
    }

    async action(args: {commands: typeof Command[], sort: string, limit: number, channels: GuildChannel[], users: GuildMember[]}, bot) {

        if (this.guild == null)
            return this.response(false,
                this.sendErrors({
                    name: "Guild missing",
                    value: "We cannot find the guild"
                })
            );

        const histories: Array<IHistory> = await getHistory(this,args);

        let embeds: Array<MessageEmbed> = [];

        const historByEmbed = 25;

        if (histories.length > 0) {
            embeds = splitFieldsEmbed(historByEmbed,histories.map(history => { //@ts-ignore
                const user = this.guild.members.cache.get(history.userId); //@ts-ignore
                const channel = this.guild.channels.cache.get(history.channelId);

                const userName = user != undefined ? (user.nickname ?? user.user.username) : history.userId+" (user not found)";
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
        return this.response(true, {embeds});
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples")
            .addFields([
                {
                    name: config.command_prefix+this.commandName+" --command notifyOnReact -l 10 --channel #blabla -s desc -u @toto",
                    value: "Afficher les 10 dernières commandes notifyOnReact dans l'ordre décroissant, sur le channel #blabla, effectuées par l'utilisateur @toto"
                }
            ]);
    }

    saveHistory() {} // overload saveHistory of Command class to save nothing in the history
}
