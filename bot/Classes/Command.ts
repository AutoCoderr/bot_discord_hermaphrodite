import config from "../config";
import * as Discord from "discord.js";
import { addMissingZero } from "./OtherFunctions";
import Permissions, { IPermissions } from "../Models/Permissions";
import History, {IHistory} from "../Models/History";

export default class Command {

    static commandName: string|null = null;

    static match(message) {
        if (this.commandName == null) return false;
        return message.content.split(" ")[0] == config.command_prefix+this.commandName;
    }

    static sendErrors(message, errors: Object|Array<Object>, displayHelp: boolean = true){
        if (!(errors instanceof Array)) {
            errors = [errors];
        }
        const commandName = message.content.split(" ")[0];
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Error in '+commandName)
            .setDescription("There is some errors in your command")
            .setTimestamp()

        // @ts-ignore
        for (let error of errors) {
            Embed.addFields(
                error
            )
        }
        if (displayHelp) {
            this.help(Embed);
        }

        message.channel.send(Embed);
    }

    static displayHelp(message) {
        const commandName = message.content.split(" ")[0];
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Aide pour la commande '+commandName)
            .setTimestamp()
        this.help(Embed);
        message.channel.send(Embed);
    }

    static async check(message,bot) {
        if (this.match(message) && await this.checkPermissions(message)) {
            if (await this.action(message, bot)) {
                this.saveHistory(message);
            }
        }
    }

    static saveHistory(message) {
        const date = new Date();

        const year = addMissingZero(date.getFullYear(), 4),
            month = addMissingZero(date.getMonth()+1),
            day = addMissingZero(date.getDate()),
            hour = addMissingZero(date.getHours()),
            minute = addMissingZero(date.getMinutes()),
            seconds = addMissingZero(date.getSeconds());

        const commandName = message.content.slice(1).split(" ")[0],
            command = message.content,
            dateTime = year+"-"+month+"-"+day+" "+hour+":"+minute+":"+seconds,
            channelId = message.channel.id,
            userId = message.member.id,
            serverId = message.guild.id;

        const history: IHistory = {
            commandName,
            command,
            dateTime,
            channelId,
            userId,
            serverId
        }

        History.create(history);
    }

    static async checkPermissions(message, displayMsg = true) {
        const commandName = this.commandName;

        if(config.roots.includes(message.author.id) || message.member.hasPermission("ADMINISTRATOR")) return true;

        const permission: IPermissions = await Permissions.findOne({serverId: message.guild.id, command: commandName});
        if (permission != null) {
            for (let roleId of message.member._roles) {
                if (permission.roles.includes(roleId)) return true;
            }
        }
        if (displayMsg) {
            let Embed = new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Permission denied')
                .setDescription("Vous n'avez pas le droit d'executer la commande '" + commandName + "'")
                .setTimestamp();
            message.channel.send(Embed);
        }
        return false;
    }

    static parseCommand(message): any {
        let argsObject = {};
        let args = "";
        const commandSplitted = message.content.split(" ");
        for (let i=1;i<commandSplitted.length;i++) {
            if (i > 1) {
                args += " ";
            }
            args += commandSplitted[i];
        }

        for (let i=0;i<args.length;i++) {
            if (args[i] == "-") {
                let attr = "";
                if (args[i]+args[i+1] == "--")
                    i += 2;
                else
                    i += 1;

                while (i < args.length && args[i] != " ") {
                    attr += args[i];
                    i += 1;
                }
                while (i < args.length && args[i] == " ") {
                    i += 1;
                }
                if (args[i] != "-") {
                    if (i < args.length && (args[i] == "'" || args[i] == '"')) {
                        let quote = args[i];
                        let value = "";
                        i += 1;
                        while (i < args.length && args[i] != quote) {
                            value += args[i];
                            i += 1;
                        }
                        argsObject[attr] = value != "" ? value : true;
                    } else {
                        let value = "";
                        while (i < args.length && args[i] != " ") {
                            value += args[i];
                            i += 1;
                        }
                        argsObject[attr] = value != "" ? value : true;
                    }
                } else {
                    argsObject[attr] = true;
                }
            } else if (args[i] != " ") {
                let value = "";
                if (i < args.length && (args[i] == "'" || args[i] == '"')) {
                    let quote = args[i];
                    i += 1;
                    while (i < args.length && args[i] != quote) {
                        value += args[i];
                        i += 1;
                    }
                } else {
                    while (i < args.length && args[i] != " ") {
                        value += args[i];
                        i += 1;
                    }
                }
                let j = 0;
                while (typeof(argsObject[j]) != "undefined") {
                    j += 1;
                }
                argsObject[j] = value;
            }
        }
        return argsObject;
    }

    static help(Embed) {} // To be overloaded

    static async action(message, bot) { // To be overloaded
        return true;
    }
}