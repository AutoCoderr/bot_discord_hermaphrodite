import config from "../config";
import Command from "../Classes/Command";
import {getArgsModelHistory, getHistory, splitFieldsEmbed} from "../Classes/OtherFunctions";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildChannel,
    GuildMember,
    MessageEmbed,
    TextBasedChannels,
    User
} from "discord.js";
import {IHistory} from "../Models/History";

export default class HistoryCmd extends Command {
    static display = true;
    static description = "Pour accéder à l'historique des commandes.";
    static commandName = "history";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel = getArgsModelHistory();

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, HistoryCmd.commandName, HistoryCmd.argsModel);
    }

    async action(args: {commands: typeof Command[], sort: string, limit: number, channels: GuildChannel[], users: GuildMember[]}, bot) {
        const {commands, sort, limit, channels, users} = args;

        if (this.guild == null)
            return this.response(false,
                this.sendErrors({
                    name: "Guild missing",
                    value: "We cannot find the guild"
                })
            );

        const histories: Array<IHistory> = await getHistory(this,args);

        let embeds: Array<MessageEmbed> = [];

        const historByEmbed = 15;

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

        return this.response(true, embeds.map(embed => ({ embeds: [embed] })));
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
