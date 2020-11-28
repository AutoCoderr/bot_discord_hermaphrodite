import config from "../config";
import Command from "../Classes/Command";
import { existingCommands } from "../Classes/CommandsDescription";
import History, { IHistory } from "../Models/History";

export class HistoryCmd extends Command {
    static commandName = "history"

    static async action(message, bot) {
        const args = this.parseCommand(message);
        let errors: Array<Object> = [];

        if (args[0] == "help") {
            this.displayHelp(message);
            return true;
        }

        let commandName: null|string = null;
        if (typeof(args.c) != "undefined" && typeof(args.command) != "undefined") {
            errors.push({name: "-c or --command", value: "Please use -c or --command but not the both"});
        } else if (typeof(args.c) != "undefined" || typeof(args.command) != "undefined") {
            commandName = typeof(args.c) != "undefined" ? args.c : args.command;
            if (!Object.keys(existingCommands).includes(<string>commandName) || !existingCommands[<string>commandName].display) {
                errors.push({name: "That command can't be grepped", value: "'"+config.command_prefix+commandName+"' command can't be grepped in "+config.command_prefix+"history"});
            } else if (!await existingCommands[<string>commandName].commandClass.checkPermissions(message,false)) {
                errors.push({name: "You are not allowed", value: "You are not allowed to check '"+config.command_prefix+commandName+"'"});
            }
        }

        let sort: string = "asc";
        if (typeof(args.s) != "undefined" && typeof(args.sort) != "undefined") {
            errors.push({name: "-s or --sort", value: "Please use -s or --sort but not the both"});
        } else if (typeof(args.s) != "undefined" || typeof(args.sort) != "undefined") {
            sort = typeof(args.s) != "undefined" ? args.s : args.sort;
            sort = sort.toLowerCase();
            if (sort == "dsc") {
                sort = "desc";
            }
            if (sort != "asc" && sort != "desc") {
                errors.push({name: "Bad argument for sort", value: "Please use 'asc' or 'desc/dsc'"});
            }
        }

        let limit: number = 0;
        if (typeof(args.l) != "undefined" && typeof(args.limit) != "undefined") {
            errors.push({name: "-l or --limit", value: "Please use -l or --limit but not the both"});
        } else if (typeof(args.l) != "undefined" || typeof(args.limit) != "undefined") {
            let limitToCheck: string = typeof(args.l) != "undefined" ? args.l : args.limit;
            if (parseInt(limitToCheck).toString() != limitToCheck || limitToCheck == "NaN") {
                errors.push({name: "Bad argument for limit", value: "Limit specified is incorrect, specify a number"});
            } else {
                limit = parseInt(limitToCheck);
            }
        }

        let channelId: null|string = null;
        if (typeof(args.ch) != "undefined" && typeof(args.channel) != "undefined") {
            errors.push({name: "-ch or --channel", value: "Please use -ch or --channel but not the both"});
        } else if (typeof(args.ch) != "undefined" || typeof(args.channel) != "undefined") {
            channelId = typeof(args.ch) != "undefined" ? args.ch : args.channel; // @ts-ignore
            if (typeof(channelId) != "string") {
                errors.push({name: "Bad argument for channel", value: "Specified channel is incorrect"});
            } else { // @ts-ignore
                channelId = channelId.replaceAll(" ",""); // @ts-ignore
                channelId = channelId.split("<#")[1];
                if (channelId == undefined) {
                    errors.push({name: "Bad argument for channel", value: "Specified channel is incorrect"});
                } else {
                    channelId = channelId.substring(0,channelId.length-1);
                    let channel = message.guild.channels.cache.get(channelId);
                    if (channel == undefined) {
                        errors.push({name: "Channel does not exist", value: "The specified channel does not exist"});
                    }
                }
            }
        }

        let userId: null|string = null;
        if (typeof(args.u) != "undefined" && typeof(args.user) != "undefined") {
            errors.push({name: "-u or --user", value: "Please use -u or --user but not the both"});
        } else if (typeof(args.u) != "undefined" || typeof(args.user) != "undefined") {
            userId = typeof(args.u) != "undefined" ? args.u : args.user; // @ts-ignore
            if (typeof(userId) != "string") {
                errors.push({name: "Bad argument for user", value: "Specified user is incorrect"});
            } else { // @ts-ignore
                userId = userId.replaceAll(" ",""); // @ts-ignore
                userId = userId.split("<@!")[1];
                if (userId == undefined) {
                    errors.push({name: "Bad argument for channel", value: "Specified channel is incorrect"});
                } else {
                    userId = userId.substring(0,userId.length-1);
                    let user = message.guild.members.cache.get(userId);
                    if (user == undefined) {
                        errors.push({name: "User does not exist", value: "The specified user does not exist"});
                    }
                }
            }
        }

        if (errors.length > 0) {
            this.sendErrors(message,errors);
            return false;
        }
        console.log("\n\ncommandName => "+(commandName == null ? "all" : commandName));
        console.log("sort => "+sort);
        console.log("limit => "+limit);
        console.log("channel => "+(channelId == null ? 'all' : channelId));
        console.log("user => "+(userId == null ? 'all' : userId));

        let where:any = {};
        if (userId != null) {
            where.userId = userId
        }
        if (channelId != null) {
            where.channelId = channelId;
        }
        if (commandName != null) {
            where.commandName = commandName;
        } else {
            where.commandName = { $nin: [] };
            for (let aCommand in existingCommands) {
                if (!await existingCommands[aCommand].commandClass.checkPermissions(message,false)) {
                    where.commandName.$nin.push(aCommand);
                }
            }
        }

        console.log(where);

        const histories:Array<IHistory> = await History.find(where).limit(limit).sort({dateTime: sort});

        console.log(histories);

        message.channel.send("Command correctly typed");


        return true;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "-c ou --command, la commande dont on souhaite voir l'historique\n"+
                "-s ou --sort, 'asc' ou 'desc/dsc' ('asc' par défaut) pour trier du debut à la fin ou de la fin au début dans l'ordre chronologique\n"+
                "-l ou --limit, Pour afficher les n dernières commandes de la listes\n"+
                "-ch ou --channel, Pour afficher les commandes executées dans un channel spécifique\n"+
                "-u ou --user, Pour afficher les commandes executées par un utilisateur spécifique"
        }).addFields({
                name: "Exemples :",
                value: config.command_prefix+"history --command notifyOnReact -l 10 --channel #blabla"
            })
    }

    static async saveHistory(message) {} // overload saveHistory of Command class to save nothing in the history

    static async checkPermissions(message, displayMsg) { // overload checkPermission of Command class to permit all users to execute the help command
        return true;
    }
}