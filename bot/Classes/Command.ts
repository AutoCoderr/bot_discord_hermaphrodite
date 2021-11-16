import config from "../config";
import * as Discord from "discord.js";
import {addMissingZero, splitFieldsEmbed} from "./OtherFunctions";
import Permissions, { IPermissions } from "../Models/Permissions";
import History, {IHistory} from "../Models/History";
import {isNumber} from "./OtherFunctions";
import {Message, MessageEmbed} from "discord.js";
import {checkTypes} from "./TypeChecker";
import {extractTypes} from "./TypeExtractor";

const validModelCommands = {};

export default class Command {

    static commandName: null|string = null;
    static display: boolean = false;
    static description: null|string = null;
    static argsModel: any = {};

    commandName: null|string;
    message: Message;
    argsModel: any = {};

    constructor(message: Message, commandName: null|string, argsModel: any) {
        this.message = message;
        this.commandName = commandName;
        this.argsModel = argsModel;
    }

    async match() {
        if (this.commandName == null) return false;
        return this.message.content.split(" ")[0] == config.command_prefix+this.commandName;
    }

    sendErrors(errors: Object|Array<Object>){
        if (!(errors instanceof Array)) {
            errors = [errors];
        }
        const commandName = this.message.content.split(" ")[0];
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Erreur sur la commande '+commandName)
            .setDescription("Il y a plusieurs erreurs sur cette commande")
            .setTimestamp()

        // @ts-ignore
        for (let error of errors) {
            Embed.addFields(
                error
            )
        }

        this.message.channel.send({embeds: [Embed]});
    }

    displayHelp(displayHelp = true, fails: null|Array<any> = null, failsExtract: null|Array<any> = null, args = null) {
        const commandName = this.message.content.split(" ")[0];
        let embeds: Array<MessageEmbed> = [
            new MessageEmbed()
                .setTitle("Aide pour la commande "+commandName)
                .setColor('#0099ff')
        ];

        if (fails instanceof Array || failsExtract instanceof Array) {
            if (fails instanceof Array && fails.length > 0) {
                const subFields = this.getArgsList(fails);
                for (const fail of fails) {
                    if (typeof(fail.errorMessage) == "function") {
                        const errors = fail.errorMessage(fail.value, args)
                        if (errors instanceof Array){
                            for (const error of errors) {
                                subFields.push(error);
                            }
                        } else {
                            subFields.push(errors);
                        }
                    }
                }
                embeds = [...embeds, ...splitFieldsEmbed(25, subFields, (Embed: MessageEmbed, partNb) => {
                    if (partNb == 1) {
                        Embed.setTitle("Arguments manquants ou invalides :");
                    }
                })];
            }
            if (failsExtract instanceof Array && failsExtract.length > 0) {

                const subFields = this.getArgsList(failsExtract);

                for (const failExtract of failsExtract) {
                    if (typeof(failExtract.errorMessage) == "function") {
                        const errors = failExtract.errorMessage(failExtract.value, args)
                        if (errors instanceof Array){
                            for (const error of errors) {
                                subFields.push(error);
                            }
                        } else {
                            subFields.push(errors);
                        }
                    }
                }

                embeds = [...embeds, ...splitFieldsEmbed(25, subFields, (Embed: MessageEmbed, partNb) => {
                    if (partNb == 1) {
                        Embed.setTitle("Données introuvables");
                    }
                })];
            }
        } else {
            const subFields: Array<{name: string, value: string}> = [];
            for (const attr in this.argsModel) {
                if (attr[0] != "$") {
                    const field = this.argsModel[attr];
                    subFields.push({
                        name: field.fields.join(", "),
                        value: field.description + " | ( "+(field.default != undefined ? "Par défaut : "+field.default+" ; " : "")+"type attendu : " + (field.type ?? field.types) + " )"
                    })
                }
            }
            if (this.argsModel.$argsByOrder) {
                for (const arg of this.argsModel.$argsByOrder) {
                    subFields.push({
                        name: arg.field,
                        value: arg.description + " | ( "+(arg.default != undefined ? "Par défaut : "+arg.default+" ; " : "")+"type attendu : " + (arg.type ?? arg.types) + " )"
                    });
                }
            } else if (this.argsModel.$argsByType) {
                for (const attr in this.argsModel.$argsByType) {
                    const field = this.argsModel.$argsByType[attr];
                    subFields.push({
                        name: attr,
                        value: field.description + " | ( "+(field.default != undefined ? "Par défaut : "+field.default+" ; " : "")+"type attendu : " + (field.type ?? field.types) + " )"
                    });
                }
            }

            embeds = [...embeds, ...splitFieldsEmbed(25, subFields, (Embed: MessageEmbed, partNb) => {
                if (partNb == 1) {
                    Embed.setTitle("Champs");
                }
            })];

        }


        if (this.argsModel.$argsByOrder !== undefined && this.argsModel.$argsByOrder.length > 1)
            embeds[embeds.length-1].addFields({
                name: "Ordre des arguments :",
                value: config.command_prefix+this.commandName+" "+this.argsModel.$argsByOrder.map(model => "<"+model.field+'>').join(" ")
            });

        if (displayHelp)
            embeds.push(this.help())
        else
            embeds[embeds.length-1].addFields({
                name: "Voir l'aide : ",
                value: "Tapez : "+config.command_prefix+this.commandName+" -h"
            });
        this.message.channel.send({embeds});

    }

    getArgsList(args: Array<any>) {
        return args
            .filter(arg => typeof(arg.errorMessage) != "function")
            .map(arg =>
                ({
                    name: (arg.fields instanceof Array ? arg.fields.join(", ") : arg.field),
                    value: arg.description + " | ( "+(arg.default != undefined ? "Par défaut : "+arg.default+" ; " : "")+"type attendu : " + (arg.type ?? arg.types) + " )"
                })
            );
    }

    async check(bot) {
        if (await this.match() && await this.checkPermissions() && this.checkIfModelValid()) {
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
        return Command.staticCheckPermissions(this.message,displayMsg,this.commandName);
    }

    static async staticCheckPermissions(message: Message, displayMsg = true, commandName: string|null = null) {
        if (commandName == null) {
            commandName = this.commandName;
        }

        if (message.channel.type == "DM" || config.roots.includes(message.author.id) || (message.member && message.member.permissions.has("ADMINISTRATOR"))) return true;

        if (message.member && message.guild) {
            const permission: IPermissions = await Permissions.findOne({
                serverId: message.guild.id,
                command: commandName
            });
            if (permission != null) {
                // @ts-ignore
                for (let roleId of message.member._roles) {
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
            message.channel.send({embeds: [Embed]});
        }
        return false;
    }

    getValueInCorrectType(value: string) {
        value = value.trim();
        if (value == "true" || value == "false") {
            return value == "true";
        } else if (isNumber(value)) {
            return parseInt(value);
        } else {
            return value;
        }
    }

    checkIfModelValid() {
        if (this.commandName != null && validModelCommands[this.commandName]) return true;

        let valid = true;
        if (this.commandName != null && validModelCommands[this.commandName] == false) valid = false;

        if (valid && this.argsModel.$argsByType && this.argsModel.$argsByOrder) valid = false;


        if (this.commandName != null && !validModelCommands[this.commandName]) {
            validModelCommands[this.commandName] = valid;
        }
        if (!valid) {
            this.message.channel.send({embeds: [
                    new MessageEmbed()
                        .setTitle("Modèle de la commande invalide")
                        .setDescription("Le modèle de la commande est invalide")
                        .setColor('#0099ff')
                        .setTimestamp()
                ]})
            return false;
        }
        return true;
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
                if (i < args.length && args[i] != "-") {
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
                } else if (i < args.length) {
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
        let out: any = {};
        let fails: Array<any> = [];
        let failsExtract: Array<any> = [];
        let argsWithoutKeyDefined = false;

        for (const attr in model) {
            if (attr[0] != "$") {
                let found = false;
                let incorrectField = false;
                let extractFailed = false;
                let triedValue;

                for (let field of model[attr].fields) {
                    let argType: Array<string>|string = model[attr].type ?? model[attr].types;
                    if (args[field] != undefined &&
                        (
                            (
                                argType instanceof Array &&
                                    await Promise.all(argType.map(async type => {
                                        if (type == "string" || await checkTypes[type](args[field])) {
                                            argType = type;
                                            return true;
                                        }
                                        return false
                                    })).then(goodTypes => goodTypes.some(type => type))
                            ) || (
                                typeof(argType) == "string" && (
                                    argType == "string" || await checkTypes[argType](args[field])
                                )
                            )
                        )
                    ) {
                        if (extractTypes[<string>argType]) {
                            const moreDatas = typeof(model[attr].moreDatas) == "function" ? await model[attr].moreDatas(out,argType, this.message) : null
                            const data = await extractTypes[<string>argType](args[field],this.message,moreDatas);
                            if (data !== false) {
                                if (typeof(model[attr].valid) != "function" || await model[attr].valid(data,out, this.message))
                                    out[attr] = data;
                                else {
                                    incorrectField = true;
                                    triedValue = args[field];
                                }
                            } else {
                                extractFailed = true;
                                triedValue = args[field];
                            }
                        } else if (typeof(model[attr].valid) != "function" || await model[attr].valid(args[field],out, this.message))
                            out[attr] = argType == "string" ? args[field].toString() : args[field];
                        else {
                            incorrectField = true;
                            triedValue = args[field];
                        }

                        if (out[attr] != undefined) {
                            found = true;
                            break;
                        }
                    } else if (args[field] != undefined) {
                        triedValue = args[field];
                        incorrectField = true;
                    }
                }
                const required = model[attr].required == undefined ||
                    (typeof(model[attr].required) == "boolean" && model[attr].required) ||
                    (typeof(model[attr].required) == "function" && await model[attr].required(out, this.message));

                if (required) {
                    const defaultValue = typeof (model[attr].default) == "function" ? model[attr].default(out, this.message) : model[attr].default;
                    if (defaultValue != undefined && !found && !incorrectField && !extractFailed) {
                        out[attr] = defaultValue;
                        found = true;
                    }
                }
                if (!found) {
                    if (extractFailed) {
                        failsExtract.push({...model[attr], value: triedValue});
                    } else if (incorrectField || required) {
                        fails.push({...model[attr], value: triedValue });
                    }
                }
            } else if (attr == "$argsByOrder" && !argsWithoutKeyDefined) {
                argsWithoutKeyDefined = true;
                let currentIndex = 0;
                const argsByOrder = model[attr];
                for (let j=0;j<argsByOrder.length;j++) {
                    const argModel = argsByOrder[j];
                    if (argModel.multi)
                        out[argModel.field] = [];
                    let argType: Array<string>|string = argModel.type ?? argModel.types;
                    let found = false;
                    let incorrectField = false;
                    let triedValue;
                    let extractFailed = false;
                    for (let i=currentIndex;args[i] !== undefined;i++) {
                        if (args[i] != undefined && (
                            (
                                argType instanceof Array &&
                                await Promise.all(argType.map(async type => {
                                    if (type == "string" || await checkTypes[type](args[i]) || (type == "boolean" && args[i] === argModel.field)) {
                                        argType = type;
                                        return true;
                                    }
                                    return false
                                })).then(goodTypes => goodTypes.some(type => type))
                            ) || (
                                typeof(argType) == "string" && (
                                    argType == "string" || await checkTypes[argType](args[i]) || (argType == "boolean" && args[i] === argModel.field)
                                )
                            ))
                        ) {
                            let data = argType == "string" ? args[i].toString() : args[i];
                            if (extractTypes[<string>argType]) {
                                const moreDatas = typeof(argModel.moreDatas) == "function" ? await argModel.moreDatas(out,argType, this.message) : null
                                data = await extractTypes[<string>argType](data,this.message,moreDatas);
                                if (data === false) {
                                    failsExtract.push({...argModel, value: args[i]});
                                    extractFailed = true;
                                }
                            }

                            if (!extractFailed &&
                                (typeof(argModel.valid) != "function" || await argModel.valid(data,out, this.message)) &&
                                (!(argModel.choices instanceof Array) || argModel.choices.includes(data))
                            ) {
                                if (argType === "boolean" && data === argModel.field)
                                    data = true;
                                if (argModel.multi)
                                    out[argModel.field].push(data)
                                else
                                    out[argModel.field] = data
                                found = true;
                            } else if (!extractFailed) {
                                triedValue = args[i];
                                incorrectField = true;
                            }

                            if (incorrectField || extractFailed) {
                                currentIndex = i;
                                break;
                            }
                            if (found) {
                                currentIndex = i+1;
                                if (!argModel.multi)
                                    break;
                            }
                        } else {
                            if (j == argsByOrder.length - 1) {
                                triedValue = args[i];
                                incorrectField = true;
                            }
                            currentIndex = i;
                            break;
                        }
                    }
                    const required = argModel.required == undefined ||
                        (typeof(argModel.required) == "boolean" && argModel.required) ||
                        (typeof(argModel.required) == "function" && await argModel.required(out, this.message));

                    if (required) {
                        const defaultValue = typeof (argModel.default) == "function" ? argModel.default(out, this.message) : argModel.default;
                        if (!found && !incorrectField && defaultValue != undefined) {
                            out[argModel.field] = defaultValue;
                            found = true;
                        }
                    }
                    if (
                        !found && !extractFailed && (incorrectField || required )
                    ) {
                        fails.push({...argModel, value: triedValue});
                    }
                }
            } else if (attr == "$argsByType" && !argsWithoutKeyDefined) {
                argsWithoutKeyDefined = true;
                const argsByType = model[attr];
                const alreadyDefineds = {};

                for (let attr in argsByType) {
                    if (argsByType[attr].multi)
                        out[attr] = [];

                    let found = false;
                    let extractFailed = false;
                    let validFailed = false;
                    let triedValue;
                    let argType: Array<string>|string = argsByType[attr].type ?? argsByType[attr].types;

                    const required = argsByType[attr].required == undefined ||
                        (typeof(argsByType[attr].required) == "boolean" && argsByType[attr].required) ||
                        (typeof(argsByType[attr].required) == "function" && await argsByType[attr].required(out, this.message));

                    const displayExtractError = (typeof(argsByType[attr].displayExtractError) == "boolean" && argsByType[attr].displayExtractError) ||
                        (typeof(argsByType[attr].displayExtractError) == "function" && await argsByType[attr].displayExtractError(out, this.message));

                    const displayValidErrorEvenIfFound = (typeof(argsByType[attr].displayValidErrorEvenIfFound) == "boolean" && argsByType[attr].displayValidErrorEvenIfFound) ||
                        (typeof(argsByType[attr].displayValidErrorEvenIfFound) == "function" && await argsByType[attr].displayValidErrorEvenIfFound(out, this.message));

                    const displayValidError = (typeof(argsByType[attr].displayValidError) == "boolean" && argsByType[attr].displayValidError) ||
                        (typeof(argsByType[attr].displayValidError) == "function" && await argsByType[attr].displayValidError(out,this.message)) ||
                        displayValidErrorEvenIfFound;

                    for (let i=0;args[i] !== undefined;i++) {
                        if (alreadyDefineds[i]) {
                            if (found)
                                break;
                            else
                                continue;
                        }

                        if (args[i] != undefined && (
                            (
                                argType instanceof Array && await Promise.all(argType.map(async type => {
                                    if (type == "string" || await checkTypes[type](args[i]) || (type == "boolean" && args[i] === attr)) {
                                        argType = type;
                                        return true;
                                    }
                                    return false
                                })).then(goodTypes => goodTypes.some(type => type))
                            ) || (
                                typeof(argType) == "string" && (
                                    argType == "string" || checkTypes[argType](args[i]) || (argType == "boolean" && args[i] === attr)
                                )
                            ))
                        ) {
                            let data = argType == "string" ? args[i].toString() : args[i];
                            if (extractTypes[<string>argType]) {
                                const moreDatas = typeof(argsByType[attr].moreDatas) == "function" ? await argsByType[attr].moreDatas(out,argType, this.message) : null
                                data = await extractTypes[<string>argType](data,this.message,moreDatas);
                                if (data === false) {
                                    extractFailed = true;
                                    triedValue = args[i];
                                }
                            }
                            if (!extractFailed &&
                                (typeof(argsByType[attr].valid) != "function" || await argsByType[attr].valid(data,out, this.message)) &&
                                (!(argsByType[attr].choices instanceof Array) || argsByType[attr].choices.includes(data)) ) {
                                if (argType === "boolean" && data === attr)
                                    data = true
                                if (argsByType[attr].multi)
                                    out[attr].push(data);
                                else
                                    out[attr] = data;
                                found = true;
                                alreadyDefineds[i] = true;
                            } else if (!extractFailed) {
                                validFailed = true;
                                triedValue = args[i];
                            }

                            if (found && (!argsByType[attr].multi || validFailed || extractFailed))
                                break;
                        } else if (found)
                            break;
                    }

                    if (required) {
                        const defaultValue = typeof (argsByType[attr].default) == "function" ? argsByType[attr].default(out, this.message) : argsByType[attr].default;
                        if (!found && defaultValue != undefined) {
                            out[attr] = defaultValue;
                            found = true;
                        }
                    }
                    if (!found && extractFailed && (required || displayExtractError)) {
                        failsExtract.push({...argsByType[attr], value: triedValue, field: attr});
                    } else if ((!found && (required || (validFailed && displayValidError)) ) || (found && validFailed && displayValidErrorEvenIfFound)) {
                        fails.push({...argsByType[attr], value: triedValue, field: attr});
                    }
                }
            }
        }
        if (fails.length > 0 || failsExtract.length > 0) {
            this.displayHelp(false, fails, failsExtract, out);
            return false;
        }
        return out;
    }

    help(): MessageEmbed { // To be overloaded
        return new MessageEmbed();
    }

    async action(args: any,bot) { // To be overloaded
        return true;
    }
}
