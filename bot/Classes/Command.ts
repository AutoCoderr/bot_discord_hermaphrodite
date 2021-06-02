import config from "../config";
import * as Discord from "discord.js";
import { addMissingZero } from "./OtherFunctions";
import Permissions, { IPermissions } from "../Models/Permissions";
import History, {IHistory} from "../Models/History";
import {isNumber} from "./OtherFunctions";
import {Message} from "discord.js";
import {checkTypes} from "./TypeChecker";
import {extractTypes} from "./TypeExtractor";

export default class Command {

    static staticCommandName: null|string = null;

    commandName: null|string;
    message: Message;

    argsModel = {};

    constructor(message: Message, commandName: null|string) {
        this.message = message;
        this.commandName = commandName
    }


    async match() {
        if (this.commandName == null) return false;
        return this.message.content.split(" ")[0] == config.command_prefix+this.commandName;
    }

    sendErrors(errors: Object|Array<Object>, displayHelp: boolean = true){
        if (!(errors instanceof Array)) {
            errors = [errors];
        }
        const commandName = this.message.content.split(" ")[0];
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

        this.message.channel.send(Embed);
    }

    displayHelp(fails: null|Array<any> = null) {
        const commandName = this.message.content.split(" ")[0];
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Aide pour la commande '+commandName)
            .setTimestamp()
        let name: string;
        let value: string;
        if (fails instanceof Array) {
            name = "Arguments manquants ou invalides :";
            value = fails
                .map(fail =>
                    (fail.fields instanceof Array ? fail.fields.join(", ") : fail.field)+" : "+fail.description+ " | (type attendu : " + fail.type + ")"
                ).join("\n");
        } else {
            name = "Champs "
            value = "";
            for (const attr in this.argsModel) {
                const field = this.argsModel[attr];
                value += field.fields.join(", ")+" : "+field.description+ " | (type attendu : " + field.type + ")\n";
            }
            if (this.argsModel['$argsWithoutKey'] instanceof Array) {
                for (const field of this.argsModel['$argsWithoutKey']) {
                    value += field.field+" : "+field.description+ " | (type attendu : " + field.type + ")\n";
                }
            }
        }
        Embed.addFields({name,value});
        this.help(Embed);
        this.message.channel.send(Embed);
    }

    async check(bot) {
        if (await this.match() && await this.checkPermissions()) {
            const args = await this.computeArgs(this.parseCommand(),this.argsModel);
            if (args && await this.action(args,bot)) {
                this.saveHistory();
            }
        }
    }

    saveHistory() {
        if (this.message.author.bot) return; // Do nothing if the message is typed by a bot

        const date = new Date();

        const year = addMissingZero(date.getFullYear(), 4),
            month = addMissingZero(date.getMonth()+1),
            day = addMissingZero(date.getDate()),
            hour = addMissingZero(date.getHours()),
            minute = addMissingZero(date.getMinutes()),
            seconds = addMissingZero(date.getSeconds());

        const commandName = this.message.content.slice(1).split(" ")[0],
            command = this.message.content.slice(1),
            dateTime = year+"-"+month+"-"+day+" "+hour+":"+minute+":"+seconds,
            channelId = this.message.channel.id,
            userId = this.message.member != null ? this.message.member.id : "nobody",
            serverId = this.message.guild != null ? this.message.guild.id : "nothing";

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

    checkPermissions(displayMsg = true) {
        return Command.staticCheckPermissions(this.message,displayMsg);
    }

    static async staticCheckPermissions(message: Message, displayMsg = true) {
        const commandName = this.staticCommandName;

        if(message.channel.type == "dm" || config.roots.includes(message.author.id) || (message.member && message.member.hasPermission("ADMINISTRATOR"))) return true;

        if (message.member && message.guild) {
            const permission: IPermissions = await Permissions.findOne({
                serverId: message.guild.id,
                command: commandName
            });
            if (permission != null) {
                // @ts-ignore
                for (let roleId of this.message.member._roles) {
                    if (permission.roles.includes(roleId)) return true;
                }
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

    getValueInCorrectType(value: string) {
        if (value == "true" || value == "false") {
            return value == "true";
        } else if (isNumber(value)) {
            return parseInt(value);
        } else {
            return  value;
        }
    }

    parseCommand(): any {
        let argsObject = {};
        let args = "";
        const commandSplitted = this.message.content.split(" ");
        for (let i=1;i<commandSplitted.length;i++) {
            if (i > 1) {
                args += " ";
            }
            args += commandSplitted[i];
        }
        let attr: string = "";
        for (let i=0;i<args.length;i++) {
            if (args[i] == "-") {

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
                        argsObject[attr] = this.getValueInCorrectType(value);
                        attr = "";
                    } else {
                        let value = "";
                        while (i < args.length && args[i] != " ") {
                            value += args[i];
                            i += 1;
                        }
                        argsObject[attr] = this.getValueInCorrectType(value);
                        attr = "";
                    }
                } else {
                    i -= 1;
                    argsObject[attr] = true;
                    attr = "";
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
                argsObject[j] = this.getValueInCorrectType(value);
            }
        }
        if (attr != "") argsObject[attr] = true;
        return argsObject;
    }
    async computeArgs(args,model) {
        console.log("computeArgs");
        console.log({args,model});
        let out: any = {};
        let fails: Array<any> = []
        let argsWithoutKeyDefined = false;
        for (const attr in model) {
            if (attr[0] != "$") {
                let found = false;
                for (let field of model[attr].fields) {
                    if (args[field] != undefined &&
                        (
                            model[attr].type == "string" || checkTypes[model[attr].type](args[field])
                        )
                    ) {
                        if (extractTypes[model[attr].type]) {
                            out[attr] = await extractTypes[model[attr].type](args[field],this.message);
                        } else {
                            out[attr] = model[attr].type == "string" ? args[field].toString() : args[field];
                        }
                        found = true;
                        break;
                    }
                }
                if (!found &&
                    (
                        model[attr].required == undefined ||
                        (typeof(model[attr].required) == "boolean" && model[attr].required) ||
                        (typeof(model[attr].required) == "function" && model[attr].required(out))
                    )
                ) fails.push(model[attr]);
            } else if (attr == "$argsWithoutKey" && !argsWithoutKeyDefined) {
                argsWithoutKeyDefined = true;
                const argsWithoutKey = model[attr];
                for (let i=0;i<argsWithoutKey.length;i++) {
                    if (
                        (
                            args[i] == undefined &&
                            (
                                argsWithoutKey[i].required == undefined ||
                                argsWithoutKey[i].required
                            )
                        ) || (
                            args[i] != undefined &&
                            typeof(args[i]) != argsWithoutKey[i].type
                        )
                    ) {
                        fails.push(argsWithoutKey[i]);
                    } else {
                        out[argsWithoutKey[i].field] = args[i];
                    }
                }
            }
        }
        if (fails.length > 0) {
            this.displayHelp(fails);
            return false;
        }
        return out;
    }

    help(Embed) {} // To be overloaded

    async action(args,bot) { // To be overloaded
        return true;
    }
}