import client from "./client";
import {
    ApplicationCommand, ApplicationCommandDataResolvable, CommandInteraction,
    Guild,
    MessagePayload,
    ApplicationCommandOptionType
} from "discord.js";
import Command from "./Classes/Command";
import {existingCommands} from "./Classes/CommandsDescription";
import {getterNameBySlashType, slashCommandsTypeDefinitions} from "./Classes/slashCommandsTypeDefinitions";
import CustomError from "./logging/CustomError";
import {IArg, responseType} from "./interfaces/CommandInterfaces";

interface optionCommandType {
    type?: ApplicationCommandOptionType.Boolean |
        ApplicationCommandOptionType.Channel |
        ApplicationCommandOptionType.Integer |
        ApplicationCommandOptionType.Mentionable |
        ApplicationCommandOptionType.Number |
        ApplicationCommandOptionType.Role |
        ApplicationCommandOptionType.String |
        ApplicationCommandOptionType.Subcommand |
        ApplicationCommandOptionType.SubcommandGroup |
        ApplicationCommandOptionType.User;
    name: string;
    description: string;
    required?: boolean;
    noSubCommandGroup?: boolean;
    args?: { [attr: string]: string };
    options?: optionCommandType[];
    defaultPermission?: boolean;
}


let slashCommandsByGuildAndName: { [guildId: string]: { [commandName: string]: ApplicationCommand } } = {};

export function initSlashCommands() {
    const guilds: Guild[] = [];
    for (const [, guild] of client.guilds.cache)
        guilds.push(guild);

    const slashCommandsDefinition = getSlashCommandsDefinition();

    return Promise.all(guilds.map(guild => initSlashCommandsOnGuild(guild, slashCommandsDefinition)
        .catch(e => {
            throw new CustomError(e, {guild})
        })
    ));
}

function getSlashCommandsDefinition() {
    return (<Array<typeof Command>>Object.values(existingCommands)).reduce((acc: Object, command) => ({
        ...acc,
        ...((command.commandName && !command.abstract) ?
                {[command.commandName.toLowerCase()]: generateSlashCommandFromModel(command)} : {}
        )
    }), {})
}

export async function initSlashCommandsOnGuild(guild: Guild, slashCommandsDefinitions = getSlashCommandsDefinition()) {
    console.log('Creating slash commands for ' + guild.name + ' server');

    const commands = guild.commands;

    const existingSlashCommands = await commands.fetch().then(commands =>
        commands.reduce((acc, command) => ({
            ...acc,
            [command.name]: command
        }), {})
    );

    await Promise.all([
        ...(<Array<typeof Command>>Object.values(existingCommands)).map(async command => {
            if (!command.commandName || !slashCommandsDefinitions[command.commandName.toLowerCase()])
                return null;

            if (existingSlashCommands[command.commandName.toLowerCase()])
                command.slashCommandIdByGuild[guild.id] = existingSlashCommands[command.commandName.toLowerCase()].id

            let createdSlashCommand: null|ApplicationCommand = null
            try {
                createdSlashCommand = await commands?.create(<ApplicationCommandDataResolvable>slashCommandsDefinitions[command.commandName.toLowerCase()]);
            } catch (e) {
                console.log("Can't create command slash '"+command.commandName+"' on server '"+guild.name+"'");
                console.log((<any>e).message)
                return null;
            }

            if (slashCommandsByGuildAndName[guild.id] === undefined)
                slashCommandsByGuildAndName[guild.id] = {}
            slashCommandsByGuildAndName[guild.id][<string>command.commandName] = createdSlashCommand;

            command.slashCommandIdByGuild[guild.id] = createdSlashCommand.id;
            return null;
        }),
        ...Object.entries(existingSlashCommands).map(([name, slashCommand]) =>
            !slashCommandsDefinitions[name] ? (<ApplicationCommand>slashCommand).delete().catch(() => null) : null
        )
    ])
}

function generateSlashCommandFromModel(command: typeof Command): optionCommandType {
    let slashCommandModel: optionCommandType = {
        name: <string>command.commandName?.toLowerCase(),
        description: <string>command.description,
        defaultPermission: false
    };
    const subCommands = {};
    for (const attr in command.argsModel) {
        if (attr === '$argsByOrder' && command.argsModel.$argsByOrder) {
            for (const argModel of command.argsModel.$argsByOrder) {
                generateSlashOptionFromModel(argModel.field, argModel, subCommands, slashCommandModel);
            }
        } else {
            for (const [attr2, argModel] of <Array<any>>Object.entries(command.argsModel[attr])) {
                generateSlashOptionFromModel(attr2, argModel, subCommands, slashCommandModel);
            }
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
        if (option.type == ApplicationCommandOptionType.Subcommand || option.type == ApplicationCommandOptionType.SubcommandGroup) {
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

function generateSlashOptionFromModel(attr: string, argModel: IArg, subCommands: { [attr: string]: any }, slashCommandModel: optionCommandType) {
    const chooseSubCommands: any[] = [];
    if (argModel.referToSubCommands instanceof Array)
        for (const referedSubCommand of argModel.referToSubCommands) {
            if (subCommands[referedSubCommand]) {
                chooseSubCommands.push([referedSubCommand, subCommands[referedSubCommand]]);
            }
        }
    else
        chooseSubCommands.push([null, slashCommandModel]);
    for (const [chooseSubCommandName, chooseSubCommand] of chooseSubCommands) {
        if (!(chooseSubCommand.options instanceof Array))
            chooseSubCommand.options = [];
        if (argModel.isSubCommand) {
            if (chooseSubCommand.noSubCommandGroup)
                throw new Error("You cannot blend normal arguments and sub commands in another sub command");

            for (const choice of
                argModel.choices instanceof Array ?
                    argModel.choices :
                        typeof(argModel.choices) === "object" ?
                            Object.entries(argModel.choices) :
                            []
                ) {
                const name = choice instanceof Array ? choice[0] : choice;
                const description = choice instanceof Array ?
                    typeof(choice[1]) === "function" ?
                        choice[1](chooseSubCommand.args ?? {}, chooseSubCommand.description) :
                        choice[1] :
                    null;

                const option: optionCommandType = {
                    name,
                    description: description ?? "Undefined description",
                    type: ApplicationCommandOptionType.Subcommand,
                    args: {...(chooseSubCommand.args ?? {}), [attr]: name}
                };
                chooseSubCommand.options.push(option);
                subCommands[chooseSubCommandName === null ? name : chooseSubCommandName + "." + name] = option;
            }
            if (chooseSubCommand.type == ApplicationCommandOptionType.Subcommand)
                chooseSubCommand.type = ApplicationCommandOptionType.SubcommandGroup;
        } else {
            if (chooseSubCommand.type == ApplicationCommandOptionType.SubcommandGroup)
                throw new Error("You cannot add normal argument to a sub command group");
            if (chooseSubCommand.type == ApplicationCommandOptionType.Subcommand)
                chooseSubCommand.noSubCommandGroup = true;

            const option: optionCommandType = {
                name: attr.toLowerCase(),
                description: argModel.description,
                type: getSlashType(argModel),
                required:
                    argModel.required === undefined ||
                    (
                        typeof (argModel.required) == "function" &&
                        argModel.required(chooseSubCommand.args ?? {}, null, true)
                    ) || (
                        typeof (argModel.required) == "boolean" &&
                        argModel.required
                    )
            }
            chooseSubCommand.options.push(option);
        }
    }
}


async function getAndDisplaySlashCommandsResponse(interaction: CommandInteraction, response: false | Omit<responseType, 'success'>, p = 0) {
    if (response) {
        for (let i = 0; i < response.result.length; i++) {
            const payload = response.result[i];
            if (i == 0 && p == 0)
                await interaction.editReply(payload);
            else
                await interaction.followUp(payload instanceof MessagePayload ? payload : {
                    ephemeral: true,
                    ...(
                        typeof(payload) === "string" ?
                            {content: payload} :
                            payload
                    )
                });
        }
        if (response.callback) {
            await getAndDisplaySlashCommandsResponse(interaction, await response.callback(), p + 1);
        }
    } else {
        await interaction.editReply("Aucune réponse");
    }
}

export async function listenSlashCommands(interaction: CommandInteraction) {
    const {commandName, options} = interaction;

    for (const CommandClass of <any[]>Object.values(existingCommands)) {
        if (CommandClass.commandName.toLowerCase() === commandName) {
            await interaction.deferReply({
                ephemeral: true
            });
            const command = <Command>(new CommandClass(interaction.channel, interaction.member, interaction.guild, options, 'slash'));
            try {
                const response = await command.executeCommand(client, true);

                await getAndDisplaySlashCommandsResponse(interaction, response);
                return;
            } catch(e) {
                throw new CustomError(<Error|CustomError>e, {commandRawArguments: command.getSlashRawArguments()??undefined})
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
        ApplicationCommandOptionType.String
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
