import config from "../config";
import {addMissingZero, splitFieldsEmbed} from "./OtherFunctions";
import History, {IHistory} from "../Models/History";
import {isNumber} from "./OtherFunctions";
import {
    ApplicationCommand,
    CommandInteractionOptionResolver,
    Guild,
    GuildMember,
    TextChannel,
    User, EmbedBuilder, EmbedField, ApplicationCommandPermissions
} from "discord.js";
import {checkTypes} from "./TypeChecker";
import {extractTypes} from "./TypeExtractor";
import {getCustomType, getSlashTypeGetterName} from "../slashCommands";
import CustomError from "../logging/CustomError";
import {
    getCommandTypeArg,
    IArgModel,
    IArgsModel,
    IFailList, IValidatedArgs,
    responseResultsType,
    responseResultType,
    responseType
} from "../interfaces/CommandInterfaces";
import {ApplicationCommandPermissionType} from "discord.js"

const validModelCommands = {};

export default class Command<IArgs = {[key: string]: any}, C extends null|Command = null> {

    static commandName: null|string = null;
    static display: boolean = false;
    static description: null|string = null;
    static argsModel: IArgsModel<any>;

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract: boolean = false;

    static customCommand: boolean = true;

    commandOrigin: 'slash'|'custom';

    commandName: null|string;
    guild: null|Guild;
    channel: TextChannel;
    member: User|GuildMember;
    argsModel: IArgsModel<IArgs, getCommandTypeArg<C>>;

    writtenCommand: null|string = null; // If command called as a custom command, get the message typed by the user
    slashCommandOptions: null|CommandInteractionOptionResolver = null; // If command called as a slash command, get options

    constructor(channel: TextChannel, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom', commandName: null|string, argsModel: IArgsModel<IArgs,getCommandTypeArg<C>>) {
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

    async executeCommand(bot, slashCommand = false): Promise<false| Omit<responseType, "success">> {
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

            if (success && this.commandOrigin === "custom")
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

    async displayHelp(displayHelp = true, fails: null|IFailList = null, failsExtract: null|IFailList = null, args: Partial<IArgs> = {}): Promise<responseResultsType> {
        const commandName = this.commandName;
        let embeds: Array<EmbedBuilder> = [
            new EmbedBuilder()
                .setTitle("Aide pour la commande "+commandName)
                .setColor('#0099ff')
        ];

        if (fails instanceof Array || failsExtract instanceof Array) {
            if (fails instanceof Array && fails.length > 0) {
                const subFields = this.getArgsList(fails, args);
                for (const fail of fails) {
                    if (typeof(fail.errorMessage) == "function") {
                        const errors = await fail.errorMessage(fail.value, args, this)
                        if (errors instanceof Array){
                            for (const error of errors) {
                                subFields.push({...error, inline: false});
                            }
                        } else {
                            subFields.push({...errors, inline: false});
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

                const subFields = this.getArgsList(failsExtract, args);

                for (const failExtract of failsExtract) {
                    if (typeof(failExtract.errorMessage) == "function") {
                        const errors = await failExtract.errorMessage(failExtract.value, args, this)
                        if (errors instanceof Array){
                            for (const error of errors) {
                                subFields.push({...error, inline: false});
                            }
                        } else {
                            subFields.push({...errors, inline: false});
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
            if (this.argsModel.$argsByOrder) {
                for (const arg of this.argsModel.$argsByOrder) {

                    const description = typeof(arg.description) === "string" ?
                        arg.description :
                        arg.description(args, this, false)

                    subFields.push({
                        inline: false,
                        name: arg.field,
                        value: description + " | ( "+(arg.default != undefined ? "Par défaut : "+arg.default+" ; " : "")+"type attendu : " + arg.type + " )"
                    });
                }
            } else if (this.argsModel.$argsByType || this.argsModel.$argsByName) {
                for (const [attr, field] of Object.entries(<{[field: string]: IArgModel<IArgs,getCommandTypeArg<C>>}>this.argsModel.$argsByType??this.argsModel.$argsByName)) {

                    const description = typeof(field.description) === "string" ?
                        field.description :
                        field.description(args, this, false)

                    subFields.push({
                        inline: false,
                        name: attr,
                        value: description + " | ( "+(field.default != undefined ? "Par défaut : "+field.default+" ; " : "")+"type attendu : " + field.type + " )"
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

    getArgsList(fails: IFailList, args: Partial<IArgs>): EmbedField[] {
        return fails
            .filter(arg => typeof(arg.errorMessage) !== "function")
            .map(arg =>
                ({
                    inline: false,
                    name: (arg.fields ? arg.fields.join(", ") : arg.field ?? ""),
                    value: (typeof(arg.description) === "string" ? arg.description : arg.description(args, this, false)) +
                        " | ( "+(arg.default != undefined ? "Par défaut : "+arg.default+" ; " : "")+"type attendu : " + arg.type + " )"
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
            const permissions = (await slashCommand.permissions.fetch({guild}).catch(() => null));
            if (permissions === null)
                return true;

            const everyonePermission = <ApplicationCommandPermissions>permissions.find(({id}) => id === guild.roles.everyone.id);

            return guild.ownerId == member.id ||
                (everyonePermission.permission ?
                    !member.roles.cache.some(role =>
                        permissions.some(({id, permission, type}) =>
                            type === ApplicationCommandPermissionType.Role &&
                            id !== everyonePermission.id &&
                            !permission &&
                            id === role.id
                        )
                    ) &&
                    !permissions.some(({id, permission, type}) =>
                        type === ApplicationCommandPermissionType.User &&
                        !permission &&
                        id === member.id
                    ) :
                        member.roles.cache.some(role =>
                            permissions.some(({id, permission, type}) =>
                                type === ApplicationCommandPermissionType.Role &&
                                id !== everyonePermission.id &&
                                permission &&
                                id === role.id
                            )
                        ) ||
                            permissions.some(({id, permission, type}) =>
                                type === ApplicationCommandPermissionType.User &&
                                permission &&
                                id === member.id
                            )
                )
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
        let args: Partial<IArgs> = {};
        let fails: IFailList = [];
        let failsExtract: IFailList = [];
        const validatedArgs: IValidatedArgs<IArgs> = {}

        const additionalParams = {
            subCommand: null,
            subCommandGroup: null
        };

        for (const attr in this.argsModel) {
            if (attr == '$argsByOrder' && this.argsModel.$argsByOrder) {
                for (const argModel of this.argsModel.$argsByOrder) {
                    await this.getSlashArgFromModel(argModel.field,argModel,args, fails, failsExtract, validatedArgs, additionalParams);
                }
            } else {
                for (const [attr2,argModel] of <[string,IArgModel<IArgs>][]>Object.entries(this.argsModel[attr])) {
                    await this.getSlashArgFromModel(attr2,argModel,args, fails, failsExtract, validatedArgs, additionalParams);
                }
            }
        }
        if (fails.length > 0 || failsExtract.length > 0) {
            return {success: false, result: await this.displayHelp(false, fails, failsExtract, args)};
        }
        return {success: true, result: args};
    }

    async getSlashArgFromModel(attr: string, argModel: IArgModel<IArgs>, args: Partial<IArgs>, fails: IFailList, failsExtract: IFailList, validatedArgs: IValidatedArgs<IArgs>, additionalParams: {subCommand: null|string, subCommandGroup: null|string}) {
        if (this.slashCommandOptions === null) return;
        if (!argModel.isSubCommand) {

            const initialValue = this.slashCommandOptions[getSlashTypeGetterName(argModel)](attr.toLowerCase());

            let failed = false;

            if (initialValue === null) {
                const actionPath = [additionalParams.subCommandGroup,additionalParams.subCommand].filter(v => v !== null).join(".");

                const required = (
                    (actionPath === '' && argModel.referToSubCommands === undefined) ||
                    (actionPath !== '' && argModel.referToSubCommands && argModel.referToSubCommands.includes(actionPath))
                ) && (
                    argModel.required == undefined ||
                    (typeof (argModel.required) == "boolean" && argModel.required) ||
                    (typeof (argModel.required) == "function" && await argModel.required(args, this, false))
                );

                if (required) {
                    fails.push({...argModel, field: attr});
                    return;
                }
                const defaultValue = typeof (argModel.default) == "function" ? argModel.default(args, this) : argModel.default;
                if (defaultValue !== undefined) {
                    validatedArgs[attr] = true;
                    args[attr] = defaultValue;
                } else if (argModel.multi) {
                    args[attr] = [];
                }
            } else {
                const customType = getCustomType(argModel);
                if (customType || argModel.evenCheckForSlash) {
                    const type = customType ?? argModel.type
                    if (checkTypes[type](initialValue)) {
                        if (extractTypes[type]) {
                            const moreDatas = typeof (argModel.moreDatas) == "function" ? await argModel.moreDatas(args, type, this) : null
                            const data = await extractTypes[type](initialValue, this, moreDatas);
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
                if (args[attr] === undefined) {
                    args[attr] = initialValue;
                }
            }

            if (!failed && args[attr] !== undefined && typeof(argModel.valid) == 'function' && !(await argModel.valid(args[attr],args,this,validatedArgs))) {
                fails.push({...argModel, field: attr, value: args[attr]});
            } else {
                validatedArgs[attr] = true;
            }
        } else {
            const subCommand = this.slashCommandOptions.getSubcommand();
            const subCommandGroup = this.slashCommandOptions.getSubcommandGroup(false);

            if (!argModel.choices)
                return;

            const choiceList = argModel.choices instanceof Array ? argModel.choices : Object.keys(argModel.choices);

            if (
                (
                    subCommandGroup === null ||
                    additionalParams.subCommandGroup !== null
                ) &&
                choiceList.includes(subCommand)
            ) {
                additionalParams.subCommand = subCommand;
                args[attr] = subCommand;
                return;
            }


            if (subCommandGroup !== null && choiceList.includes(subCommandGroup)
            ) {
                additionalParams.subCommandGroup = subCommandGroup;
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

    async computeArgs(args,model: IArgsModel<IArgs,C extends Command ? C : Command>): Promise<{ success: boolean, result: {[attr: string]: any}|responseResultsType }> {
        if (this.helpAsked(args))
            return this.response(false, await this.displayHelp());

        let out: Partial<IArgs> = {};
        let fails: IFailList = [];
        let failsExtract: IFailList = [];
        const validatedArgs: IValidatedArgs<IArgs> = {}


        if (model.$argsByName !== undefined) {
            for (const [attr,arg] of Object.entries(model.$argsByName)) {
                let found = false;
                let incorrectField = false;
                let extractFailed = false;
                let triedValue;

                for (let field of arg.fields) {
                    if (args[field] != undefined &&
                        (
                            typeof(arg.type) === "string" && (
                                arg.type === "string" || await checkTypes[arg.type](args[field])
                            )
                        )
                    ) {
                        if (extractTypes[arg.type]) {
                            const moreDatas = typeof(arg.moreDatas) === "function" ? await arg.moreDatas(out,arg.type, this) : null
                            const data = await extractTypes[arg.type](args[field],this,moreDatas);
                            if (data !== false) {
                                if (typeof(arg.valid) != "function" || await arg.valid(data,out, this, validatedArgs)) {
                                    validatedArgs[attr] = true;
                                    out[attr] = data;
                                } else {
                                    incorrectField = true;
                                    triedValue = args[field];
                                }
                            } else {
                                extractFailed = true;
                                triedValue = args[field];
                            }
                        } else if (typeof(arg.valid) != "function" || await arg.valid(args[field],out, this, validatedArgs)) {
                            validatedArgs[attr] = true;
                            out[attr] = arg.type === "string" ? args[field].toString() : args[field];
                        } else {
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
                const required = arg.required == undefined ||
                    (typeof(arg.required) == "boolean" && arg.required) ||
                    (typeof(arg.required) == "function" && await arg.required(out, this, false));

                if (!found && !incorrectField && !extractFailed) {
                    const defaultValue = typeof (arg.default) == "function" ? arg.default(out, this) : arg.default;
                    if (defaultValue != undefined) {
                        out[attr] = defaultValue;
                        found = true;
                    }
                }
                if (!found) {
                    if (extractFailed) {
                        failsExtract.push({...arg, value: triedValue});
                    } else if (incorrectField || required) {
                        fails.push({...arg, value: triedValue });
                    }
                }
            }
        } else if (model.$argsByOrder !== undefined) {
            let currentIndex = 0;
            for (let j=0;j<model.$argsByOrder.length;j++) {
                const arg = model.$argsByOrder[j];
                if (arg.multi)
                    out[arg.field] = [];
                let found = false;
                let incorrectField = false;
                let triedValue;
                let extractFailed = false;
                for (let i=currentIndex;args[i] !== undefined;i++) {
                    if (args[i] != undefined && (
                        typeof(arg.type) === "string" && (
                            arg.type === "string" || await checkTypes[arg.type](args[i]) || (arg.type == "boolean" && args[i] === arg.field)
                        )
                    )) {
                        let data = arg.type == "string" ? args[i].toString() : args[i];
                        if (extractTypes[arg.type]) {
                            const moreDatas = typeof(arg.moreDatas) == "function" ? await arg.moreDatas(out,arg.type, this) : null
                            data = await extractTypes[arg.type](data,this,moreDatas);
                            if (data === false) {
                                failsExtract.push({...arg, value: args[i]});
                                extractFailed = true;
                            }
                        }

                        if (!extractFailed &&
                            (typeof(arg.valid) != "function" || await arg.valid(data,out, this, validatedArgs)) &&
                            (arg.choices === undefined || Object.keys(arg.choices).includes(data))
                        ) {
                            validatedArgs[arg.field] = true;
                            if (arg.type === "boolean" && data === arg.field)
                                data = true;
                            if (arg.multi)
                                out[arg.field].push(data)
                            else
                                out[arg.field] = data
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
                            if (!arg.multi)
                                break;
                        }
                    } else {
                        if (j == model.$argsByOrder.length - 1) {
                            triedValue = args[i];
                            incorrectField = true;
                        }
                        currentIndex = i;
                        break;
                    }
                }
                const required = arg.required == undefined ||
                    (typeof(arg.required) == "boolean" && arg.required) ||
                    (typeof(arg.required) == "function" && await arg.required(out, this, false));

                if (!found && !incorrectField) {
                    const defaultValue = typeof (arg.default) == "function" ? arg.default(out, this) : arg.default;
                    if (defaultValue != undefined) {
                        out[arg.field] = defaultValue;
                        found = true;
                    }
                }
                if (
                    !found && !extractFailed && (incorrectField || required )
                ) {
                    fails.push({...arg, value: triedValue});
                }
            }
        } else if (model.$argsByType !== undefined) {
            const alreadyDefineds = {};

            for (let [attr,arg] of Object.entries(model.$argsByType)) {
                if (arg.multi)
                    out[attr] = [];

                let found = false;
                let extractFailed = false;
                let validFailed = false;
                let triedValue;

                const required = arg.required == undefined ||
                    (typeof(arg.required) == "boolean" && arg.required) ||
                    (typeof(arg.required) == "function" && await arg.required(out, this, false));

                const displayExtractError = (typeof(arg.displayExtractError) == "boolean" && arg.displayExtractError) ||
                    (typeof(arg.displayExtractError) == "function" && arg.displayExtractError(out, this));

                const displayValidErrorEvenIfFound = (typeof(arg.displayValidErrorEvenIfFound) == "boolean" && arg.displayValidErrorEvenIfFound) ||
                    (typeof(arg.displayValidErrorEvenIfFound) == "function" && arg.displayValidErrorEvenIfFound(out, this));

                const displayValidError = (typeof(arg.displayValidError) == "boolean" && arg.displayValidError) ||
                    (typeof(arg.displayValidError) == "function" && arg.displayValidError(out,this)) ||
                    displayValidErrorEvenIfFound;

                for (let i=0;args[i] !== undefined;i++) {
                    if (alreadyDefineds[i]) {
                        if (found)
                            break;
                        else
                            continue;
                    }

                    if (args[i] !== undefined && (
                        typeof(arg.type) === "string" && (
                            arg.type === "string" || checkTypes[arg.type](args[i]) || (arg.type == "boolean" && args[i] === attr)
                        ))
                    ) {
                        let data = arg.type == "string" ? args[i].toString() : args[i];
                        if (extractTypes[<string>arg.type]) {
                            const moreDatas = typeof(arg.moreDatas) == "function" ? await arg.moreDatas(out,arg.type, this) : null
                            data = await extractTypes[<string>arg.type](data,this,moreDatas);
                            if (data === false) {
                                extractFailed = true;
                                triedValue = args[i];
                            }
                        }
                        if (!extractFailed &&
                            (typeof(arg.valid) != "function" || await arg.valid(data,out, this, validatedArgs)) &&
                            (arg.choices === undefined || Object.keys(arg.choices).includes(data)) ) {
                            validatedArgs[attr] = true;
                            if (arg.type === "boolean" && data === attr)
                                data = true
                            if (arg.multi)
                                out[attr].push(data);
                            else
                                out[attr] = data;
                            found = true;
                            alreadyDefineds[i] = true;
                        } else if (!extractFailed) {
                            validFailed = true;
                            triedValue = args[i];
                        }

                        if (found && (!arg.multi || validFailed || extractFailed))
                            break;
                    } else if (found)
                        break;
                }

                if (!found) {
                    const defaultValue = typeof (arg.default) == "function" ? arg.default(out, this) : arg.default;
                    if (defaultValue != undefined) {
                        out[attr] = defaultValue;
                        found = true;
                    }
                }
                if (!found && extractFailed && (required || displayExtractError)) {
                    failsExtract.push({...arg, value: triedValue, field: attr});
                } else if ((!found && (required || (validFailed && displayValidError)) ) || (found && validFailed && displayValidErrorEvenIfFound)) {
                    fails.push({...arg, value: triedValue, field: attr});
                }
            }
        }
        if (fails.length > 0 || failsExtract.length > 0) {
            return {success: false, result: await this.displayHelp(false, fails, failsExtract, out)};
        }
        return {success: true, result: out};
    }

    response(success: boolean, result: responseResultsType|responseResultType, callback: null|(() => false|responseType|Promise<false|responseType>) = null): responseType {
        return {
            success,
            result: result instanceof Array ? result : [result],
            ...(callback !== null ? {callback}: {})
        };
    }

    help(): EmbedBuilder { // To be overloaded
        return new EmbedBuilder();
    }

    async action(args: IArgs,bot): Promise<responseType> { // To be overloaded
        return this.response(true, 'Hello');
    }
}
