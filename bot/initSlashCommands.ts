import client from "./client";
import {ApplicationCommandDataResolvable, Interaction} from "discord.js";
import {ApplicationCommandOptionTypes} from "discord.js/typings/enums";
import Command from "./Classes/Command";
import {existingCommands} from "./Classes/CommandsDescription";

interface optionCommandType {
    type: ApplicationCommandOptionTypes.BOOLEAN | ApplicationCommandOptionTypes.CHANNEL | ApplicationCommandOptionTypes.INTEGER | ApplicationCommandOptionTypes.MENTIONABLE | ApplicationCommandOptionTypes.NUMBER | ApplicationCommandOptionTypes.ROLE | ApplicationCommandOptionTypes.STRING | ApplicationCommandOptionTypes.SUB_COMMAND | ApplicationCommandOptionTypes.SUB_COMMAND_GROUP | ApplicationCommandOptionTypes.USER;
    name: string;
    description: string;
    required?: boolean;
    noSubCommandGroup?: boolean;
    actionName?: string;
}

export default async function initSlashCommands() {
    console.log("initSlashCommands");

    for (const [,guild] of client.guilds.cache) {
        console.log('Create commandes for ' + guild.name + ' server');

        try {
            const commands = guild.commands;

            //@ts-ignore
            const model = generateSlashCommandFromModel(existingCommands.Vocal);
            console.log(model);

            const vocalSlashCommand = await commands?.create(model);
            console.log({vocalSlashCommand});

            //console.log({commands});
            //console.log(commands?.cache.map(command => command.name));
            /*let res
            res = await commands?.create({
                name: 'ping',
                description: 'Make a ping'
            });
            //console.log({ping: res});
            res = await commands?.create({
                name: 'add',
                description: 'Additionner',
                options: [
                    {
                        type: ApplicationCommandOptionTypes.NUMBER,
                        name: 'num1',
                        description: "Premier nombre",
                        required: true
                    },
                    {
                        type: ApplicationCommandOptionTypes.NUMBER,
                        name: 'num2',
                        description: "Deuxième nombre",
                        required: true
                    }]
            });
            //console.log({add: res});

            res = await commands?.create({
                name: 'test',
                description: 'Test pour les sous commandes',
                options: [
                    {
                        name: 'get',
                        description: 'Get',
                        type: ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                required: true,
                                name: 'user',
                                description: 'wesh',
                                type: ApplicationCommandOptionTypes.USER
                            },
                            {
                                required: false,
                                name: 'emote',
                                description: 'Une emote',
                                type: ApplicationCommandOptionTypes.STRING
                            }
                        ]
                    },
                    {
                        name: 'edit',
                        description: 'Edit',
                        type: ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                required: true,
                                name: 'user',
                                description: 'wesh',
                                type: ApplicationCommandOptionTypes.USER
                            }
                        ]
                    },
                    {
                        name: 'show',
                        description: 'show',
                        type: ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'detailed',
                                description: "bip boup bip",
                                type: ApplicationCommandOptionTypes.BOOLEAN,
                                required: false,
                            }
                        ]
                    },
                    {
                        name: 'list',
                        description: 'List',
                        type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                        options: [
                            {
                                name: 'fully',
                                description: 'Totalement',
                                type: ApplicationCommandOptionTypes.SUB_COMMAND
                            }
                        ]
                    },
                    /*{
                        name: 'truc',
                        description: 'truc',// @ts-ignore
                        type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                        options: [
                            {
                                name: 'machin',
                                description: 'machin',// @ts-ignore
                                type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                                options: [
                                    {
                                        name: 'bidule',
                                        description: 'bidule',// @ts-ignore
                                        type: ApplicationCommandOptionTypes.SUB_COMMAND
                                    }
                                ]
                            }
                        ]
                    }*/
                //]
            //})
            //console.log({test: res})

            //console.log("created");
            //console.log(commands?.cache.map(command => command.name));
        } catch (e) {
            console.error(e)
            console.log("Command can't be created on the '" + guild.name + "' server");
        }
    }
}

function generateSlashCommandFromModel(command: typeof Command): ApplicationCommandDataResolvable {
    console.log("generateSlashCommandFromModel");
    let slashCommandModel: ApplicationCommandDataResolvable = {
        name: <string>command.commandName,
        description: <string>command.description
    };
    const subCommands = {};
    console.log("argsModel => ")
    console.log(command.argsModel);
    for (const attr in command.argsModel) {
        console.log({attr});
        if (attr === '$argsByType') {
            for (const [attr,argModel] of <Array<any>>Object.entries(command.argsModel.$argsByType)) {
                console.log({attrType: attr});
                const chooseSubCommands = argModel.referToSubCommands instanceof Array ?
                    argModel.referToSubCommands.reduce((acc,subCommandName) => ([
                        ...acc,
                        ...(subCommands[subCommandName] ? [subCommands[subCommandName]] : [])
                    ]), []) : [slashCommandModel];
                console.log("chooseSubCommands");
                console.log(chooseSubCommands);
                for (const chooseSubCommand of chooseSubCommands) {
                    if (!(chooseSubCommand.options instanceof Array))
                        chooseSubCommand.options = [];
                    if (argModel.isSubCommand) {
                        if (chooseSubCommand.noSubCommandGroup)
                            throw new Error("You cannot blend normal arguments and sub commands in another sub command");

                        for (const choice of argModel.choices ?? []) {
                            const option: optionCommandType = {
                                name: choice,
                                description: 'WESH',
                                type: ApplicationCommandOptionTypes.SUB_COMMAND,
                                actionName: attr
                            };
                            chooseSubCommand.options.push(option);
                            subCommands[choice] = option;
                        }
                        if (chooseSubCommand.type == ApplicationCommandOptionTypes.SUB_COMMAND)
                            chooseSubCommand.type = ApplicationCommandOptionTypes.SUB_COMMAND_GROUP;
                    } else {
                        if (chooseSubCommand.type == ApplicationCommandOptionTypes.SUB_COMMAND_GROUP)
                            throw new Error("You cannot add normal argument to a sub command group");
                        if (chooseSubCommand.type == ApplicationCommandOptionTypes.SUB_COMMAND)
                            chooseSubCommand.noSubCommandGroup = true;
                        const option: optionCommandType = {
                            name: attr,
                            description: "ANANAS",
                            type: ApplicationCommandOptionTypes.STRING,
                            required: //argModel.required === true
                                argModel.required === undefined ||
                                (
                                    typeof(argModel.required) == "function" &&
                                    argModel.required(chooseSubCommand.type == ApplicationCommandOptionTypes.SUB_COMMAND ?
                                        {[chooseSubCommand.actionName]: chooseSubCommand.name} : {})
                                ) || (
                                    typeof(argModel.required) == "boolean" &&
                                    argModel.required
                                )
                        }
                        chooseSubCommand.options.push(option);
                    }
                }
            }
        }
    }
    return slashCommandModel;
}

export async function listenSlashCommands(interaction: Interaction) {
    if (!interaction.isCommand()) return;

    const {commandName, options} = interaction;

    switch (commandName) {
        case 'ping':
            await interaction.deferReply({
                ephemeral: true
            });
            await sleep(1000);
            await interaction.editReply({
                content: 'pong'
            });
            break;
        case 'add':
            await interaction.reply({
                content: options.getNumber('num1')+' + '+options.getNumber('num2')+' = '+((options.getNumber('num1')??0) + (options.getNumber('num2')??0)),
                ephemeral: true
            });
            break;
        case 'test':
            const user = options.getUser('user');
            const subCommand = options.getSubcommand();
            let subCommandGroup: null|string = null;
            try {
                subCommandGroup = options.getSubcommandGroup();
            } catch (_) {}
            const detailed = options.getBoolean('detailed');
            const emote = options.getString('emote');
            console.log({user,subCommand,subCommandGroup,detailed,emote});
            await interaction.reply({
                content: "CECI EST UNE COMMANDE TEST",
                ephemeral: true
            })
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
