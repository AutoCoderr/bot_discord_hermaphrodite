import client from "./client";
import {
    ApplicationCommand, ApplicationCommandDataResolvable,
    Guild,
    Interaction, InteractionReplyOptions, MessageOptions, MessagePayload,
    Role
} from "discord.js";
import {ApplicationCommandOptionTypes} from "discord.js/typings/enums";
import Command from "./Classes/Command";
import {existingCommands} from "./Classes/CommandsDescription";
import {getterNameBySlashType, slashCommandsTypeDefinitions} from "./Classes/slashCommandsTypeDefinitions";
import Permissions, {IPermissions} from "./Models/Permissions";
import config from "./config";

interface optionCommandType {
    type?: ApplicationCommandOptionTypes.BOOLEAN | ApplicationCommandOptionTypes.CHANNEL | ApplicationCommandOptionTypes.INTEGER | ApplicationCommandOptionTypes.MENTIONABLE | ApplicationCommandOptionTypes.NUMBER | ApplicationCommandOptionTypes.ROLE | ApplicationCommandOptionTypes.STRING | ApplicationCommandOptionTypes.SUB_COMMAND | ApplicationCommandOptionTypes.SUB_COMMAND_GROUP | ApplicationCommandOptionTypes.USER;
    name: string;
    description: string;
    required?: boolean;
    noSubCommandGroup?: boolean;
    args?: { [attr: string]: string };
    options?: optionCommandType[];
    defaultPermission?: boolean;
}

let slashCommandsByGuildAndName: {[guildId: string]: {[commandName: string]: ApplicationCommand}} = {};

export function initSlashCommands() {

    const guilds: Guild[] = [];
    for (const [,guild] of client.guilds.cache)
        guilds.push(guild);

    Promise.all(guilds.map(initSlashCommandsOnGuild));
}

export async function initSlashCommandsOnGuild(guild: Guild) {
    console.log('Create slash commands for ' + guild.name + ' server');

    const commands = guild.commands;

    const existingSlashCommands = await commands.fetch().then(commands =>
        commands.reduce((acc,command) => ({
            ...acc,
            [command.name]: command
        }), {})
    );

    await Promise.all((<Array<typeof Command>>Object.values(existingCommands)).map(async command => {
        if (command.slashCommand) {

            let createdSlashCommand: null|ApplicationCommand = null
            try {
                createdSlashCommand = await commands?.create(<ApplicationCommandDataResolvable>generateSlashCommandFromModel(command));
            } catch (e) {
                console.log("Can't create command slash '"+command.commandName+"' on server '"+guild.name+"'");
                console.log((<any>e).message)
                return;
            }

            if (slashCommandsByGuildAndName[guild.id] === undefined)
                slashCommandsByGuildAndName[guild.id] = {}
            slashCommandsByGuildAndName[guild.id][<string>command.commandName] = createdSlashCommand;
        } else {
            const foundCommand = existingSlashCommands[(<string>command.commandName).toLowerCase()];
            if (foundCommand)
                foundCommand.delete();
        }
    }))
}

function generateSlashCommandFromModel(command: typeof Command): optionCommandType {
    let slashCommandModel: optionCommandType = {
        name: <string>command.commandName?.toLowerCase(),
        description: <string>command.description,
        defaultPermission: false
    };
    const subCommands = {};
    for (const attr in command.argsModel) {
        if (attr[0] === '$') {
            if (attr === '$argsByOrder') {
                for (const argModel of command.argsModel[attr]) {
                    generateSlashOptionFromModel(argModel.field, argModel, subCommands, slashCommandModel);
                }
            } else {
                for (const [attr2, argModel] of <Array<any>>Object.entries(command.argsModel[attr])) {
                    generateSlashOptionFromModel(attr2, argModel, subCommands, slashCommandModel);
                }
            }
        } else {
            const argModel = command.argsModel[attr];
            generateSlashOptionFromModel(attr, argModel, subCommands, slashCommandModel);
        }
    }
    sortRequiredAndNotRequiredArgumentsInSlashCommand(slashCommandModel);
    return slashCommandModel;
}

function sortRequiredAndNotRequiredArgumentsInSlashCommand(node: optionCommandType) {
    if (node.options === undefined) return;

    let isSubCommandGroup = false;
    const requireds: optionCommandType[] = [];
    const notRequireds: optionCommandType[] = [];

    for (const option of node.options) {
        if (option.type == ApplicationCommandOptionTypes.SUB_COMMAND || option.type == ApplicationCommandOptionTypes.SUB_COMMAND_GROUP) {
            sortRequiredAndNotRequiredArgumentsInSlashCommand(option);
            isSubCommandGroup = true;
        } else if (option.required)
            requireds.push(option);
        else
            notRequireds.push(option);
    }
    if (!isSubCommandGroup) {
        node.options = [
            ...requireds,
            ...notRequireds
        ];
    }
}

function generateSlashOptionFromModel(attr: string, argModel: any, subCommands: {[attr: string]: any}, slashCommandModel: optionCommandType) {
    const chooseSubCommands: any[] = [];
    if (argModel.referToSubCommands instanceof Array)
        for (const referedSubCommand of argModel.referToSubCommands) {
            if (subCommands[referedSubCommand]) {
                chooseSubCommands.push([referedSubCommand, subCommands[referedSubCommand]]);
            }
        }
    else
        chooseSubCommands.push([null,slashCommandModel]);
    for (const [chooseSubCommandName,chooseSubCommand] of chooseSubCommands) {
        if (!(chooseSubCommand.options instanceof Array))
            chooseSubCommand.options = [];
        if (argModel.isSubCommand) {
            if (chooseSubCommand.noSubCommandGroup)
                throw new Error("You cannot blend normal arguments and sub commands in another sub command");

            for (const [choice,description] of argModel.choices ? Object.entries(argModel.choices) : []) {
                const option: optionCommandType = {
                    name: choice.toLowerCase(),
                    description: <string>description,
                    type: ApplicationCommandOptionTypes.SUB_COMMAND,
                    args: {...(chooseSubCommand.args??{}), [attr]: choice}
                };
                chooseSubCommand.options.push(option);
                subCommands[chooseSubCommandName === null ? choice : chooseSubCommandName+"."+choice] = option;
            }
            if (chooseSubCommand.type == ApplicationCommandOptionTypes.SUB_COMMAND)
                chooseSubCommand.type = ApplicationCommandOptionTypes.SUB_COMMAND_GROUP;
        } else {
            if (chooseSubCommand.type == ApplicationCommandOptionTypes.SUB_COMMAND_GROUP)
                throw new Error("You cannot add normal argument to a sub command group");
            if (chooseSubCommand.type == ApplicationCommandOptionTypes.SUB_COMMAND)
                chooseSubCommand.noSubCommandGroup = true;

            const option: optionCommandType = {
                name: attr.toLowerCase(),
                description: argModel.description,
                type: getSlashType(argModel),
                required:
                    argModel.required === undefined ||
                    (
                        typeof(argModel.required) == "function" &&
                        argModel.required(chooseSubCommand.args ?? {}, null, true)
                    ) || (
                        typeof(argModel.required) == "boolean" &&
                        argModel.required
                    )
            }
            chooseSubCommand.options.push(option);
        }
    }
}

async function getAndDisplaySlashCommandsResponse(interaction: Interaction, response: false| { result: Array<string | MessagePayload | InteractionReplyOptions>, callback?: Function }, p = 0) {
    if (!interaction.isCommand()) return;
    if (response) {
        for (let i=0;i<response.result.length;i++) {
            const payload = response.result[i];
            if (i == 0 && p == 0)
                await interaction.editReply(payload);
            else
                await interaction.followUp(payload);
        }
        if (response.callback) {
            await getAndDisplaySlashCommandsResponse(interaction, await response.callback(), p+1);
        }
    } else {
        await interaction.editReply("Aucune réponse");
    }
}

export async function listenSlashCommands(interaction: Interaction) {
    if (!interaction.isCommand()) return;

    const {commandName, options} = interaction;

    for (const CommandClass of <any[]>Object.values(existingCommands)) {
        if (CommandClass.slashCommand && CommandClass.commandName.toLowerCase() === commandName) {
            await interaction.deferReply({
                ephemeral: true
            });
            const command = new CommandClass(interaction.channel, interaction.member, interaction.guild, options, 'slash');

            const response = await command.executeCommand(client, true);

            await getAndDisplaySlashCommandsResponse(interaction, response);
        }
    }
}

function getSlashTypeDefinition(argModel) {
    let typeDefinition: any = null;
    if (slashCommandsTypeDefinitions[argModel.type]) {
        typeDefinition = slashCommandsTypeDefinitions[argModel.type];
        if (typeDefinition.mono || typeDefinition.multi)
            typeDefinition = typeDefinition[argModel.multi ? 'multi' : 'mono'];
    }
    return typeDefinition
}

function getSlashType(argModel) {
    const slashTypeDefinition = getSlashTypeDefinition(argModel);
    return (slashTypeDefinition && slashTypeDefinition.commandType == 'slash')
        ? slashTypeDefinition.type :
        ApplicationCommandOptionTypes.STRING
}

export function getCustomType(argModel) {
    const slashTypeDefinition = getSlashTypeDefinition(argModel);

    if (slashTypeDefinition && slashTypeDefinition.commandType == 'slash')
        return null;

    if (slashTypeDefinition && slashTypeDefinition.commandType == 'custom')
        return slashTypeDefinition.type

    return argModel.type;
}

export function getSlashTypeGetterName(argModel) {
    return getterNameBySlashType[getSlashType(argModel)]
}

const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
