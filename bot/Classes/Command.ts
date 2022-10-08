import config from "../config";
import {addMissingZero, splitFieldsEmbed} from "./OtherFunctions";
import History, {IHistory} from "../Models/History";
import {isNumber} from "./OtherFunctions";
import {
    ApplicationCommand,
    CommandInteractionOptionResolver,
    Guild,
    GuildMember, InteractionReplyOptions,
    MessagePayload, TextChannel,
    User, EmbedBuilder, EmbedField
} from "discord.js";
import {checkTypes} from "./TypeChecker";
import {extractTypes} from "./TypeExtractor";
import {getCustomType, getSlashTypeGetterName} from "../slashCommands";
import CustomError from "../logging/CustomError";
import {IArgsModel, responseResultsType, responseType} from "../interfaces/CommandInterfaces";

const validModelCommands = {};

export default class Command {

    static commandName: null|string = null;
    static display: boolean = false;
    static description: null|string = null;
    static argsModel: IArgsModel;

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract: boolean = false;

    static customCommand: boolean = true;

    commandOrigin: 'slash'|'custom';

    commandName: null|string;
    guild: null|Guild;
    channel: TextChannel;
    member: User|GuildMember;
    argsModel: IArgsModel;

    writtenCommand: null|string = null; // If command called as a custom command, get the message typed by the user
    slashCommandOptions: null|CommandInteractionOptionResolver = null; // If command called as a slash command, get options

    constructor(channel: TextChannel, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom', commandName: null|string, argsModel: IArgsModel) {
        this.guild = guild;
        this.channel = channel;
        this.member = member;
        this.commandName = commandName;
        this.argsModel = argsModel;
        this.commandOrigin = commandOrigin;
        if (writtenCommandOrSlashCommandOptions instanceof CommandInteractionOptionResolver)
            this.slashCommandOptions = writtenCommandOrSlashCommandOptions;
        else
            this.writtenCommand = writtenCommandOrSlashCommandOptions
    }

    async match() {
        if (this.writtenCommand == null || this.commandName == null) return false;
        return this.writtenCommand.split(" ")[0].toLowerCase() == config.command_prefix+this.commandName.toLowerCase();
    }

    async executeCommand(bot, slashCommand = false): Promise<false| { result: Array<string | MessagePayload | InteractionReplyOptions>, callback?: Function }> {
        if (this.writtenCommand === null || await this.match()) {

            if (this.writtenCommand && !(await this.checkPermissions()))
                return {result: [{ embeds: [new EmbedBuilder()
                            .setColor('#0099ff')
                            .setTitle('Permission denied')
                            .setDescription("Vous n'avez pas le droit d'executer la commande '" + this.commandName + "'")
                            .setTimestamp()] }] };

            const modelValidRes = this.checkIfModelValid();
            if (modelValidRes !== true)
                return {result: modelValidRes};

            let args: any;
            if (!slashCommand) {
                const {success, result} = await this.computeArgs(this.parseCommand(),this.argsModel);
                if (!success) return { result: <responseResultsType> result};
                args = result;
            } else {
                const {success, result} = await this.getArgsFromSlashOptions();
                if (!success) return { result: <responseResultsType> result};
                args = result;
            }

            const {success, result, callback} = await this.action(args, bot)
                .catch(e => {
                    throw new CustomError(e, {commandArguments: args});
                })

            if (success && this.writtenCommand !== null)
                this.saveHistory();
            return {result, callback};
        }
        return false;
    }

    sendErrors(errors: any|Array<any>): responseResultsType {
        if (!(errors instanceof Array)) {
            errors = [errors];
        }
        const commandName = this.commandName;
        let Embed = new EmbedBuilder()
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

        return [{embeds: [Embed]}];
    }

    displayHelp(displayHelp = true, fails: null|Array<any> = null, failsExtract: null|Array<any> = null, args: null|{[attr: string]: any} = null): responseResultsType {
        const commandName = this.commandName;
        let embeds: Array<EmbedBuilder> = [
            new EmbedBuilder()
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
                embeds = [...embeds, ...splitFieldsEmbed(25, subFields, (Embed: EmbedBuilder, partNb) => {
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

                embeds = [...embeds, ...splitFieldsEmbed(25, subFields, (Embed: EmbedBuilder, partNb) => {
                    if (partNb == 1) {
                        Embed.setTitle("Données introuvables");
                    }
                })];
            }
        } else {
            const subFields: EmbedField[] = [];
            for (const attr in this.argsModel) {
                if (attr[0] != "$") {
                    const field = this.argsModel[attr];
                    subFields.push({
                        inline: false,
                        name: field.fields.join(", "),
                        value: field.description + " | ( "+(field.default != undefined ? "Par défaut : "+field.default+" ; " : "")+"type attendu : " + (field.type ?? field.types) + " )"
                    })
                }
            }
            if (this.argsModel.$argsByOrder) {
                for (const arg of this.argsModel.$argsByOrder) {
                    subFields.push({
                        inline: false,
                        name: arg.field,
                        value: arg.description + " | ( "+(arg.default != undefined ? "Par défaut : "+arg.default+" ; " : "")+"type attendu : " + (arg.type ?? arg.types) + " )"
                    });
                }
            } else if (this.argsModel.$argsByType) {
                for (const attr in this.argsModel.$argsByType) {
                    const field = this.argsModel.$argsByType[attr];
                    subFields.push({
                        inline: false,
                        name: attr,
                        value: field.description + " | ( "+(field.default != undefined ? "Par défaut : "+field.default+" ; " : "")+"type attendu : " + (field.type ?? field.types) + " )"
                    });
                }
            }

            embeds = [...embeds, ...splitFieldsEmbed(25, subFields, (Embed: EmbedBuilder, partNb) => {
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
        else if (this.commandOrigin === "custom")
            embeds[embeds.length-1].addFields({
                name: "Voir l'aide : ",
                value: "Tapez : "+config.command_prefix + this.commandName + " -h"
            });
        return [{embeds}];
    }

    getArgsList(args: Array<any>): EmbedField[] {
        return args
            .filter(arg => typeof(arg.errorMessage) != "function")
            .map(arg =>
                ({
                    inline: false,
                    name: (arg.fields instanceof Array ? arg.fields.join(", ") : arg.field),
                    value: arg.description + " | ( "+(arg.default != undefined ? "Par défaut : "+arg.default+" ; " : "")+"type attendu : " + (arg.type ?? arg.types) + " )"
                })
            );
    }

    saveHistory() {
        if (this.writtenCommand == null ||
            (this.member instanceof GuildMember && this.member.user.bot) ||
            (this.member instanceof User && this.member.bot)) return; // Do nothing if the message is typed by a bot

        const date = new Date();

        const year = addMissingZero(date.getFullYear(), 4),
            month = addMissingZero(date.getMonth()+1),
            day = addMissingZero(date.getDate()),
            hour = addMissingZero(date.getHours()),
            minute = addMissingZero(date.getMinutes()),
            seconds = addMissingZero(date.getSeconds());

        const commandName = this.writtenCommand.slice(1).split(" ")[0],
            command = this.writtenCommand.slice(1),
            dateTime = year+"-"+month+"-"+day+" "+hour+":"+minute+":"+seconds,
            channelId = this.channel.id,
            userId = this.member.id,
            serverId = this.guild != null ? this.guild.id : "nothing";

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

    checkPermissions(): Promise<boolean> {
        //@ts-ignore
        return this.constructor.staticCheckPermissions(this.member,this.guild)
    }

    static async staticCheckPermissions(member: GuildMember|User, guild: null|Guild = null): Promise<boolean> {
        if (guild === null || !this.slashCommandIdByGuild[guild.id] || member instanceof User)
            return false;

        const slashCommand: null|ApplicationCommand = await guild.commands.fetch(this.slashCommandIdByGuild[guild.id]).catch(() => null);
        if (slashCommand) {
            const permissions = (await slashCommand.permissions.fetch({guild}).catch(() => null))??[];
            return guild.ownerId == member.id ||
                member.roles.cache.some(role => permissions.some(({id, permission}) => permission && id === role.id))
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

    checkIfModelValid(): true|responseResultsType {
        if (this.commandName != null && validModelCommands[this.commandName]) return true;

        let valid = true;
        if (this.commandName != null && validModelCommands[this.commandName] === false) valid = false;

        if (valid && this.argsModel.$argsByType && this.argsModel.$argsByOrder) valid = false;


        if (this.commandName != null && !validModelCommands[this.commandName]) {
            validModelCommands[this.commandName] = valid;
        }
        if (!valid) {
            return [{embeds: [
                    new EmbedBuilder()
                        .setTitle("Modèle de la commande invalide")
                        .setDescription("Le modèle de la commande est invalide")
                        .setColor('#0099ff')
                        .setTimestamp()
                ]}];
        }
        return true;
    }

    getSlashRawArguments(): null|{[key: string]: any} {
        if (this.slashCommandOptions === null)
            return null;
        const rawArguments = {};
        const additionalParams = {
            subCommandGroupSet: false
        };
        for (const attr in this.argsModel) {
            if (attr == '$argsByOrder' && this.argsModel.$argsByOrder) {
                for (const argModel of this.argsModel.$argsByOrder) {
                    this.getRawArgumentFromModel(argModel.field,argModel,additionalParams,rawArguments);
                }
            } else {
                for (const [attr2,argModel] of Object.entries(this.argsModel[attr])) {
                    this.getRawArgumentFromModel(attr2,argModel,additionalParams,rawArguments);
                }
            }
        }
        return rawArguments;
    }

    getRawArgumentFromModel(attr, argModel,additionalParams,rawArguments) {
        if (this.slashCommandOptions === null)
            return null;
        if (!argModel.isSubCommand)
            rawArguments[attr] = this.slashCommandOptions[getSlashTypeGetterName(argModel)](attr.toLowerCase());
        else {
            const subCommand = this.slashCommandOptions.getSubcommand();
            const subCommandGroup = this.slashCommandOptions.getSubcommandGroup(false);

            if ((subCommandGroup === null || additionalParams.subCommandGroupSet) && additionalParams.subCommand !== null && Object.keys(argModel.choices).includes(subCommand)) {
                rawArguments[attr] = subCommand;
            } else if (subCommandGroup !== null && Object.keys(argModel.choices).includes(subCommandGroup)) {
                additionalParams.subCommandGroupSet = true
                rawArguments[attr] = subCommandGroup;
            }
        }
    }

    async getArgsFromSlashOptions(): Promise<{ success: boolean, result: {[attr: string]: any}|responseResultsType }> {
        if (this.slashCommandOptions === null) return {success: false, result: {}};
        let args: {[name: string]: any} = {};
        let fails: Array<any> = [];
        let failsExtract: Array<any> = [];

        const additionalParams = {
            subCommandGroupSet: false
        };

        for (const attr in this.argsModel) {
            if (attr == '$argsByOrder' && this.argsModel.$argsByOrder) {
                for (const argModel of this.argsModel.$argsByOrder) {
                    await this.getSlashArgFromModel(argModel.field,argModel,args, fails, failsExtract, additionalParams);
                }
            } else {
                for (const [attr2,argModel] of Object.entries(this.argsModel[attr])) {
                    await this.getSlashArgFromModel(attr2,argModel,args, fails, failsExtract, additionalParams);
                }
            }
        }
        if (fails.length > 0 || failsExtract.length > 0) {
            return {success: false, result: this.displayHelp(false, fails, failsExtract, args)};
        }
        return {success: true, result: args};
    }

    async getSlashArgFromModel(attr: string, argModel: any, args: {[name: string]: any}, fails: Array<any>, failsExtract: Array<any>, additionalParams: {[key: string]: any}) {
        if (this.slashCommandOptions === null) return;
        if (!argModel.isSubCommand) {

            const initialValue = this.slashCommandOptions[getSlashTypeGetterName(argModel)](attr.toLowerCase());

            let failed = false;

            if (initialValue === null) {
                const required = argModel.required == undefined ||
                    (typeof (argModel.required) == "boolean" && argModel.required) ||
                    (typeof (argModel.required) == "function" && await argModel.required(args, this));

                if (required) {
                    fails.push({...argModel, field: attr});
                    return;
                }
                const defaultValue = typeof (argModel.default) == "function" ? argModel.default(args, this) : argModel.default;
                if (defaultValue !== undefined) {
                    args[attr] = defaultValue;
                } else if (argModel.multi) {
                    args[attr] = [];
                }
            } else {
                const customType = getCustomType(argModel);
                if (customType) {
                    if (checkTypes[customType](initialValue)) {
                        if (extractTypes[customType]) {
                            const moreDatas = typeof (argModel.moreDatas) == "function" ? await argModel.moreDatas(args, customType, this) : null
                            const data = await extractTypes[customType](initialValue, this, moreDatas);
                            if (data === false) {
                                failed = true;
                                failsExtract.push({...argModel, field: attr, value: args[attr]});
                            } else {
                                args[attr] = data
                            }
                        }
                    } else {
                        failed = true;
                        fails.push({...argModel, field: attr, value: initialValue});
                    }
                }
                if (args[attr] === undefined)
                    args[attr] = initialValue;
            }

            if (!failed && args[attr] !== undefined && typeof(argModel.valid) == 'function' && !(await argModel.valid(args[attr],args,this))) {
                fails.push({...argModel, field: attr, value: args[attr]});
            }
        } else {
            const subCommand = this.slashCommandOptions.getSubcommand();
            const subCommandGroup = this.slashCommandOptions.getSubcommandGroup(false);

            if ((subCommandGroup === null || additionalParams.subCommandGroupSet) && additionalParams.subCommand !== null && Object.keys(argModel.choices).includes(subCommand)) {
                args[attr] = subCommand;
            } else if (subCommandGroup !== null && Object.keys(argModel.choices).includes(subCommandGroup)) {
                additionalParams.subCommandGroupSet = true
                args[attr] = subCommandGroup;
            }
        }
    }

    parseCommand(): any {
        if (this.writtenCommand === null) return {};
        let argsObject = {};
        let args = "";
        const commandSplitted = this.writtenCommand.split(" ");
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

    helpAsked(args) {
        return args['--help'] || args['-h'];
    }

    async computeArgs(args,model): Promise<{ success: boolean, result: {[attr: string]: any}|responseResultsType }> {
        if (this.helpAsked(args))
            return this.response(false, this.displayHelp());

        let out: {[attr: string]: any} = {};
        let fails: Array<any> = [];
        let failsExtract: Array<any> = [];
        let argsWithoutKeyDefined = false;

        for (const attr in model) {
            if (attr === "$argsByName") {
                const argsByName = model.$argsByName;
                for (const attr in argsByName) {
                    let found = false;
                    let incorrectField = false;
                    let extractFailed = false;
                    let triedValue;

                    for (let field of argsByName[attr].fields) {
                        let argType: string = argsByName[attr].type;
                        if (args[field] != undefined &&
                            (
                                typeof(argType) == "string" && (
                                    argType == "string" || await checkTypes[argType](args[field])
                                )
                            )
                        ) {
                            if (extractTypes[<string>argType]) {
                                const moreDatas = typeof(argsByName[attr].moreDatas) == "function" ? await argsByName[attr].moreDatas(out,argType, this) : null
                                const data = await extractTypes[<string>argType](args[field],this,moreDatas);
                                if (data !== false) {
                                    if (typeof(argsByName[attr].valid) != "function" || await argsByName[attr].valid(data,out, this))
                                        out[attr] = data;
                                    else {
                                        incorrectField = true;
                                        triedValue = args[field];
                                    }
                                } else {
                                    extractFailed = true;
                                    triedValue = args[field];
                                }
                            } else if (typeof(argsByName[attr].valid) != "function" || await argsByName[attr].valid(args[field],out, this))
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
                    const required = argsByName[attr].required == undefined ||
                        (typeof(argsByName[attr].required) == "boolean" && argsByName[attr].required) ||
                        (typeof(argsByName[attr].required) == "function" && await argsByName[attr].required(out, this));

                    if (!found && !incorrectField && !extractFailed) {
                        const defaultValue = typeof (argsByName[attr].default) == "function" ? argsByName[attr].default(out, this) : argsByName[attr].default;
                        if (defaultValue != undefined) {
                            out[attr] = defaultValue;
                            found = true;
                        }
                    }
                    if (!found) {
                        if (extractFailed) {
                            failsExtract.push({...argsByName[attr], value: triedValue});
                        } else if (incorrectField || required) {
                            fails.push({...argsByName[attr], value: triedValue });
                        }
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
                    let argType: string = argModel.type;
                    let found = false;
                    let incorrectField = false;
                    let triedValue;
                    let extractFailed = false;
                    for (let i=currentIndex;args[i] !== undefined;i++) {
                        if (args[i] != undefined && (
                            typeof(argType) == "string" && (
                                argType == "string" || await checkTypes[argType](args[i]) || (argType == "boolean" && args[i] === argModel.field)
                            )
                        )) {
                            let data = argType == "string" ? args[i].toString() : args[i];
                            if (extractTypes[<string>argType]) {
                                const moreDatas = typeof(argModel.moreDatas) == "function" ? await argModel.moreDatas(out,argType, this) : null
                                data = await extractTypes[<string>argType](data,this,moreDatas);
                                if (data === false) {
                                    failsExtract.push({...argModel, value: args[i]});
                                    extractFailed = true;
                                }
                            }

                            if (!extractFailed &&
                                (typeof(argModel.valid) != "function" || await argModel.valid(data,out, this)) &&
                                (argModel.choices === undefined || Object.keys(argModel.choices).includes(data))
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
                        (typeof(argModel.required) == "function" && await argModel.required(out, this));

                    if (!found && !incorrectField) {
                        const defaultValue = typeof (argModel.default) == "function" ? argModel.default(out, this) : argModel.default;
                        if (defaultValue != undefined) {
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
                    let argType: string = argsByType[attr].type;

                    const required = argsByType[attr].required == undefined ||
                        (typeof(argsByType[attr].required) == "boolean" && argsByType[attr].required) ||
                        (typeof(argsByType[attr].required) == "function" && await argsByType[attr].required(out, this));

                    const displayExtractError = (typeof(argsByType[attr].displayExtractError) == "boolean" && argsByType[attr].displayExtractError) ||
                        (typeof(argsByType[attr].displayExtractError) == "function" && await argsByType[attr].displayExtractError(out, this));

                    const displayValidErrorEvenIfFound = (typeof(argsByType[attr].displayValidErrorEvenIfFound) == "boolean" && argsByType[attr].displayValidErrorEvenIfFound) ||
                        (typeof(argsByType[attr].displayValidErrorEvenIfFound) == "function" && await argsByType[attr].displayValidErrorEvenIfFound(out, this));

                    const displayValidError = (typeof(argsByType[attr].displayValidError) == "boolean" && argsByType[attr].displayValidError) ||
                        (typeof(argsByType[attr].displayValidError) == "function" && await argsByType[attr].displayValidError(out,this)) ||
                        displayValidErrorEvenIfFound;

                    for (let i=0;args[i] !== undefined;i++) {
                        if (alreadyDefineds[i]) {
                            if (found)
                                break;
                            else
                                continue;
                        }

                        if (args[i] !== undefined && (
                            typeof(argType) == "string" && (
                                argType == "string" || checkTypes[argType](args[i]) || (argType == "boolean" && args[i] === attr)
                            ))
                        ) {
                            let data = argType == "string" ? args[i].toString() : args[i];
                            if (extractTypes[<string>argType]) {
                                const moreDatas = typeof(argsByType[attr].moreDatas) == "function" ? await argsByType[attr].moreDatas(out,argType, this) : null
                                data = await extractTypes[<string>argType](data,this,moreDatas);
                                if (data === false) {
                                    extractFailed = true;
                                    triedValue = args[i];
                                }
                            }
                            if (!extractFailed &&
                                (typeof(argsByType[attr].valid) != "function" || await argsByType[attr].valid(data,out, this)) &&
                                (argsByType[attr].choices === undefined || Object.keys(argsByType[attr].choices).includes(data)) ) {
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

                    if (!found) {
                        const defaultValue = typeof (argsByType[attr].default) == "function" ? argsByType[attr].default(out, this) : argsByType[attr].default;
                        if (defaultValue != undefined) {
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
            return {success: false, result: this.displayHelp(false, fails, failsExtract, out)};
        }
        return {success: true, result: out};
    }

    response(success: boolean, result: responseResultsType|string | MessagePayload | InteractionReplyOptions, callback: null|Function = null): responseType {
        return {
            success,
            result: result instanceof Array ? result : [result],
            ...(callback ? {callback}: {})
        };
    }

    help(): EmbedBuilder { // To be overloaded
        return new EmbedBuilder();
    }

    async action(args: any,bot): Promise<responseType> { // To be overloaded
        return this.response(true, 'Hello');
    }
}
