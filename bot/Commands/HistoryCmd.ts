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
        const {help, commands, sort, limit, channels, users} = args;

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

        const historByEmbed = 15;

        if (histories.length > 0) {
            embeds = splitFieldsEmbed(historByEmbed,histories.map(history => { //@ts-ignore
                const user = this.message.guild.members.cache.get(history.userId); //@ts-ignore
                const channel = this.message.guild.channels.cache.get(history.channelId);

                const userName = user != undefined ? (user.nickname ?? user.user.username) : history.userId+" (user not found)";
                const channelName = channel != undefined ? channel.name : history.channelId

                return {
                    name: "[" + history.dateTime + "] "+userName+" sur #"+channelName+" :",
                    value: config.command_prefix+history.command
                };
            }), (Embed: MessageEmbed, partNb: number) => {
                if (partNb == 1)
                    Embed
                        .setTitle("L'historique des commandes "+(limit > 0 ? "(les "+limit+" premiers)" : "(Sans limite)")+" :")
                        .setDescription("Liste des commandes qui ont été tapées \n\n"+
                            (sort !== undefined ? "Ordre "+(sort === 'asc' ? 'croissant' : "décroissant")+"\n" : '')+
                            (limit !== undefined ? "Les "+limit+" premiers de la liste\n" : '')+
                            (commands !== undefined ? "Les commandes : "+commands+"\n" : '')+
                            (channels !== undefined ? (channels.length > 1 ? "Sur les channels" : "Sur le channel")+" : "+channels.map(channel => "<#"+channel.id+">" ).join(", ")+"\n" : '')+
                            (users !== undefined ? (users.length > 1 ? "Par les utilisateurs" : "Par l'utilisateur")+" : "+users.map(user => "<@"+user.id+">" ).join(", ")+"\n" : ''));
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
        for (const embed of embeds)
            this.message.channel.send({embeds: [embed]});
        return true;
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
