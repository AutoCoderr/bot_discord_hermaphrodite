import client from "./client";
import {
    ApplicationCommand, CommandInteraction,
    Guild,
    MessagePayload,
    ApplicationCommandOptionType
} from "discord.js";
import Command from "./Classes/Command";
import {existingCommands} from "./Classes/CommandsDescription";
import {getterNameBySlashType, slashCommandsTypeDefinitions} from "./Classes/slashCommandsTypeDefinitions";
import CustomError from "./logging/CustomError";
import {IArgModel, ISlashCommandsDefinition, responseType} from "./interfaces/CommandInterfaces";

type IOptionCommandType = ApplicationCommandOptionType.Boolean |
ApplicationCommandOptionType.Channel |
ApplicationCommandOptionType.Integer |
ApplicationCommandOptionType.Mentionable |
ApplicationCommandOptionType.Number |
ApplicationCommandOptionType.Role |
ApplicationCommandOptionType.String |
ApplicationCommandOptionType.Subcommand |
ApplicationCommandOptionType.SubcommandGroup |
ApplicationCommandOptionType.User

interface IOptionCommand<> {
    type?: IOptionCommandType;
    name: string;
    description: string;
    required?: boolean;
    noSubCommandGroup?: boolean;
    args?: { [attr: string]: string };
    options?: IOptionCommand[];
    defaultPermission?: boolean;
    choices?: {name: string, value: string|number}[]
}


let slashCommandsByGuildAndName: { [guildId: string]: { [commandName: string]: ApplicationCommand } } = {};

export async function initSlashCommands() {
    const guilds: Guild[] = [];
    for (const [, guild] of client.guilds.cache)
        guilds.push(guild);

    const slashCommandsDefinition = await getSlashCommandsDefinition();

    return Promise.all(guilds.map(guild => initSlashCommandsOnGuild(guild, slashCommandsDefinition)
        .catch(e => {
            throw new CustomError(e, {guild})
        })
    ));
}

function getSlashCommandsDefinition(): Promise<ISlashCommandsDefinition> {
    return Promise.all(
        (<Array<typeof Command>>Object.values(existingCommands))
            .map(async command =>
                (command.commandName && !command.abstract) ?
                    [command.commandName.toLowerCase(), await generateSlashCommandFromModel(command)] :
                    null
            )
    ).then(computedCommands =>
        computedCommands
            .filter(computedCommand => computedCommand !== null) //@ts-ignore
            .reduce((acc, [name, slashModel]) => ({
                ...acc,
                [name]: slashModel
            }),{})
    )
}

export async function initSlashCommandsOnGuild(guild: Guild, slashCommandsDefinitions: null|ISlashCommandsDefinition = null) {
    console.log(guild.name+" : Creating slash commands");

    slashCommandsDefinitions = slashCommandsDefinitions ?? await getSlashCommandsDefinition();

    const commands = guild.commands;

    const existingSlashCommands = await commands.fetch().then(commands =>
        commands.reduce((acc, command) => ({
            ...acc,
            [command.name]: command
        }), {})
    );

    await Promise.all([
        ...(<Array<typeof Command>>Object.values(existingCommands)).map(async command => {
            if (!command.commandName || !(<ISlashCommandsDefinition>slashCommandsDefinitions)[command.commandName.toLowerCase()])
                return null;

            if (existingSlashCommands[command.commandName.toLowerCase()])
                command.slashCommandIdByGuild[guild.id] = existingSlashCommands[command.commandName.toLowerCase()].id

            let createdSlashCommand: null|ApplicationCommand = null
            try {
                createdSlashCommand = await commands?.create((<ISlashCommandsDefinition>slashCommandsDefinitions)[command.commandName.toLowerCase()]);
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
            !(<ISlashCommandsDefinition>slashCommandsDefinitions)[name] ? (<ApplicationCommand>slashCommand).delete().catch(() => null) : null
        )
    ])
    console.log(guild.name+" : Slash commands created")
}

async function generateSlashCommandFromModel(command: typeof Command): Promise<IOptionCommand> {
    let slashCommandModel: IOptionCommand = {
        name: <string>command.commandName?.toLowerCase(),
        description: <string>command.description,
        defaultPermission: false
    };
    const subCommands = {};
    for (const attr in command.argsModel) {
        if (attr === '$argsByOrder' && command.argsModel.$argsByOrder) {
            for (const argModel of command.argsModel.$argsByOrder) {
                await generateSlashOptionFromModel(argModel.field, argModel, subCommands, slashCommandModel);
            }
        } else {
            for (const [attr2, argModel] of <Array<any>>Object.entries(command.argsModel[attr])) {
                await generateSlashOptionFromModel(attr2, argModel, subCommands, slashCommandModel);
            }
        }
    }
    sortRequiredAndNotRequiredArgumentsInSlashCommand(slashCommandModel);
    return slashCommandModel;
}

function sortRequiredAndNotRequiredArgumentsInSlashCommand(node: IOptionCommand) {
    if (node.options === undefined) return;

    let isSubCommandGroup = false;
    const requireds: IOptionCommand[] = [];
    const notRequireds: IOptionCommand[] = [];

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

async function generateSlashOptionFromModel(attr: string, argModel: IArgModel, subCommands: { [attr: string]: any }, slashCommandModel: IOptionCommand) {
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

            const choices = typeof(argModel.choices) === "function" ? await argModel.choices() : argModel.choices;

            for (const choice of
                choices instanceof Array ?
                    choices :
                        typeof(choices) === "object" ?
                            Object.entries(choices) :
                            []
                ) {
                const name = choice instanceof Array ? choice[0] : choice;
                const description = choice instanceof Array ?
                    typeof(choice[1]) === "function" ?
                        choice[1](chooseSubCommand.args ?? {}, chooseSubCommand.description) :
                        choice[1] :
                    null;

                const option: IOptionCommand = {
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

            const choices = typeof(argModel.choices) === "function" ? await argModel.choices() : argModel.choices;

            const option: IOptionCommand = {
                name: attr.toLowerCase(),
                description: typeof(argModel.description) === "string" ?
                    argModel.description :
                    argModel.description(chooseSubCommand.args ?? {}, null, true),
                type: getSlashType(argModel),
                required:
                    argModel.required === undefined ||
                    (
                        typeof (argModel.required) == "function" &&
                        await argModel.required(chooseSubCommand.args ?? {}, null, true)
                    ) || (
                        typeof (argModel.required) == "boolean" &&
                        argModel.required
                    ),
                choices: (typeof(choices) === "object" && choices !== null) ? 
                            (
                                choices instanceof Array ? 
                                    choices :
                                    Object.entries(choices)
                                )
                            .map(choice => 
                                choice instanceof Array ? 
                                {
                                    name: <string>choice[1],
                                    value: <string|number>choice[0]
                                } :
                                {
                                    name: <string>choice,
                                    value: <string|number>choice
                                }
                            ) :
                                undefined
            }
            chooseSubCommand.options.push(option);
        }
    }
}


async function getAndDisplaySlashCommandsResponse(interaction: CommandInteraction, response: false | Omit<responseType, 'success'>, p = 0) {
    if (!response)
        return interaction.editReply("Aucune réponse");

    if (response.result instanceof Array) {
        if (!interaction.deferred) {
            await interaction.deferReply({
                ephemeral: true
            });
        }
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
        return;
    }

    await interaction.showModal(response.result);
}

export async function listenSlashCommands(interaction: CommandInteraction) {
    const {commandName} = interaction;

    for (const CommandClass of <any[]>Object.values(existingCommands)) {
        if (CommandClass.commandName.toLowerCase() === commandName) {
            const command = <Command>(new CommandClass(interaction, 'slash'));
            try {
                const response = await command.executeCommand(client, true);

                await getAndDisplaySlashCommandsResponse(interaction, response);
                return;
            } catch(e) {
                throw new CustomError(<Error|CustomError>e, {commandRawArguments: (await command.getSlashRawArguments())??undefined})
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
