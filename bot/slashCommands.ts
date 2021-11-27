import client from "./client";
import {ApplicationCommand, ChatInputApplicationCommandData, Guild, Interaction} from "discord.js";
import {ApplicationCommandOptionTypes} from "discord.js/typings/enums";
import Command from "./Classes/Command";
import {existingCommands} from "./Classes/CommandsDescription";
import {getterNameBySlashType, slashCommandsTypeDefinitions} from "./Classes/slashCommandsTypeDefinitions";
import Permissions, {IPermissions} from "./Models/Permissions";
import config from "./config";

interface optionCommandType {
    type: ApplicationCommandOptionTypes.BOOLEAN | ApplicationCommandOptionTypes.CHANNEL | ApplicationCommandOptionTypes.INTEGER | ApplicationCommandOptionTypes.MENTIONABLE | ApplicationCommandOptionTypes.NUMBER | ApplicationCommandOptionTypes.ROLE | ApplicationCommandOptionTypes.STRING | ApplicationCommandOptionTypes.SUB_COMMAND | ApplicationCommandOptionTypes.SUB_COMMAND_GROUP | ApplicationCommandOptionTypes.USER;
    name: string;
    description: string;
    required?: boolean;
    noSubCommandGroup?: boolean;
    actionName?: string;
}

let slashCommandsByGuildAndName: {[guildId: string]: {[commandName: string]: ApplicationCommand}} = {};

export async function initSlashCommands() {

    for (const [,guild] of client.guilds.cache) {

        console.log('Create slash commands for ' + guild.name + ' server');

        try {
            const commands = guild.commands;

            for (const command of <Array<typeof Command>>Object.values(existingCommands)) {
                if (command.slashCommand) {
                    const createdSlashCommand = await commands?.create(generateSlashCommandFromModel(command));

                    await initSlashCommandPermissions(guild, createdSlashCommand, <string>command.commandName);

                    if (slashCommandsByGuildAndName[guild.id] === undefined)
                        slashCommandsByGuildAndName[guild.id] = {}
                    slashCommandsByGuildAndName[guild.id][<string>command.commandName] = createdSlashCommand;
                }
            }

        } catch (e) {
            console.error(e)
            console.log("Slash commands can't be created on the '" + guild.name + "' server");
        }
    }
}

export async function addRoleToSlashCommandPermission(guild: Guild, commandName: string, rolesId: string[]) {
    if (slashCommandsByGuildAndName[guild.id] === undefined || slashCommandsByGuildAndName[guild.id][commandName] === undefined) return;
    const command = slashCommandsByGuildAndName[guild.id][commandName];

    await command.permissions.add({
        permissions: rolesId.map(roleId => ({
            id: roleId,
            type: 'ROLE',
            permission: true
        }))
    })
}

export async function setRoleToSlashCommandPermission(guild: Guild, commandName: string, rolesId: string[]) {
    if (slashCommandsByGuildAndName[guild.id] === undefined || slashCommandsByGuildAndName[guild.id][commandName] === undefined) return;
    const command = slashCommandsByGuildAndName[guild.id][commandName];

    await command.permissions.set({
        permissions: [
            ...rolesId.map(roleId => ({
                id: roleId,
                type: 'ROLE',
                permission: true
            })),
            ...config.roots.map(id => ({
                id,
                type: 'USER',
                permission: true
            }))
        ]
    })
}

async function initSlashCommandPermissions(guild: Guild, command: ApplicationCommand, commandName: string) {
    const permission: null|IPermissions = await Permissions.findOne({
        command: commandName,
        serverId: guild.id
    });

    await command.permissions.add({
        permissions: [
            ...(permission != null ? permission.roles.map(roleId => ({
                id: roleId,
                type: 'ROLE',
                permission: true
            })) : []),
            ...config.roots.map(id => ({
                id,
                type: 'USER',
                permission: true
            }))
        ]
    });
}

function generateSlashCommandFromModel(command: typeof Command): ChatInputApplicationCommandData {
    console.log("generateSlashCommandFromModel "+command.commandName);
    let slashCommandModel: ChatInputApplicationCommandData = {
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
    return slashCommandModel;
}

function generateSlashOptionFromModel(attr: string, argModel: any, subCommands: {[attr: string]: any}, slashCommandModel: ChatInputApplicationCommandData) {
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
                    actionName: attr
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
                        argModel.required(chooseSubCommand.type == ApplicationCommandOptionTypes.SUB_COMMAND ?
                            {[chooseSubCommand.actionName]: chooseSubCommand.name} : {}, true)
                    ) || (
                        typeof(argModel.required) == "boolean" &&
                        argModel.required
                    )
            }
            chooseSubCommand.options.push(option);
        }
    }
}

export async function listenSlashCommands(interaction: Interaction) {
    if (!interaction.isCommand()) return;

    const {commandName, options} = interaction;

    for (const CommandClass of <any[]>Object.values(existingCommands)) {
        if (CommandClass.slashCommand && CommandClass.commandName === commandName) {
            await interaction.deferReply({
                ephemeral: true
            });
            const command = new CommandClass(interaction.channel, interaction.member, interaction.guild, options);

            const response = await command.executeCommand(client, true);

            if (response) {
                for (const payload of response.result)
                    await interaction.editReply(payload);
            } else {
                await interaction.editReply("Aucune réponse");
            }
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
