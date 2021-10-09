import config from "../config";
import Command from "../Classes/Command";
import { existingCommands } from "../Classes/CommandsDescription";
import {Message, MessageEmbed, Role} from "discord.js";
import Permissions, {IPermissions} from "../Models/Permissions";

export default class Perm extends Command {

    argsModel = {
        help: { fields: ['-h','--help'], type: "boolean", required: false, description: "Pour afficher l'aide" },

        $argsByOrder: [
            {
                field: "action",
                type: "string",
                required: args => args.help == undefined,
                description: "'add', 'set' ou 'show', pour ajouter une permission à celle déjà présente, les redéfinir avec set, ou les afficher avec 'show'",
                valid: (value, _) => ['add','set','show'].includes(value)
            },
            {
                field: "commands",
                type: "string",
                required: args => args.help == undefined,
                description: "La ou les commandes sur laquelle ajouter ou définir la permission",
                valid: async (commandList, _) => { // Vérifie si l'utilisateur à le droit d'accéder à cette commande
                    const alreadySpecifiedCommands = {};
                    const commands: typeof Command[] = Object.values(existingCommands);
                    for (let specifiedCommandName of commandList.split(",")) {
                        specifiedCommandName = specifiedCommandName.trim();
                        if (alreadySpecifiedCommands[specifiedCommandName] === undefined) {
                            let commandExists = false
                            for (const command of commands) {
                                if (command.commandName == specifiedCommandName && command.display && await command.staticCheckPermissions(this.message, false)) {
                                    commandExists = true;
                                    break;
                                }
                            }
                            if (!commandExists) return false;
                        } else {
                            return false;
                        }
                    }
                    return true;
                },

                errorMessage: (value, _) => {
                    if (value != undefined) {
                        return {
                            name: "La commande n'existe pas",
                            value: "La commande '" + value + "' n'existe pas, ou vous est inaccessible"
                        };
                    }
                    return {
                        name: "Nom de commande manquant",
                        value: "Nom de la commande non spécifié"
                    };
                }
            },
            {
                field: "roles",
                type: "roles",
                required: args => args.help == undefined && args.action == "add",
                description: "Le ou les rôles autorisés à taper cette commande"
            }
        ]
    };

    static display = true;
    static description = "Pour configurer les permissions.";
    static commandName = "perm";

    constructor(message: Message) {
        super(message, Perm.commandName);
    }

    async action(args: {help: boolean, action: string, commands: string, roles: Array<Role>}, bot) { //%perm set commandName @role
        const {help, action, commands, roles} = args;

        const commandsList = commands.split(",").map(commandName => commandName.trim());

        if (help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild == null) {
            this.sendErrors({
                name: "Guild missing",
                value: "We cannot find the message guild"
            });
            return false;
        }

        if (action == "show") { // Show the roles which are allowed to execute the specified command

            const embeds: MessageEmbed[] = [];

            for (const commandName of commandsList) {
                const permission: IPermissions|null = await Permissions.findOne({command: commandName, serverId: this.message.guild.id});
                let embed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle("Les permissions pour '"+commandName+"' :")
                    .setDescription("Liste des permissions pour '"+commandName+"'")
                    .setTimestamp();
                if (permission == null || permission.roles.length == 0) {
                    embed.addFields({
                        name: "Aucune permission",
                        value: "Il n'y a aucune permission trouvée pour la commande " + commandName
                    });
                } else {
                    let roles: Array<string> = [];
                    for (let roleId of permission.roles) { //@ts-ignore
                        let role = this.message.guild.roles.cache.get(roleId);
                        let roleName: string;
                        if (role == undefined) {
                            roleName = "unknown";
                        } else {
                            roleName = role.name;
                        }
                        roles.push('@'+roleName);
                    }
                    embed.addFields({
                        name: "Les roles :",
                        value: roles.join(", ")
                    });
                }
                embeds.push(embed);
            }

            this.message.channel.send({embeds});
            return true;
        }


        const serverId = this.message.guild.id;

        const rolesId = roles ? roles.map(role => role.id) : [];

        for (const commandName of commandsList) {
            const permission = await Permissions.findOne({serverId: serverId, command: commandName});

            if (permission == null) {
                const permission: IPermissions = {
                    command: commandName,
                    roles: rolesId,
                    serverId: serverId
                }
                Permissions.create(permission);
            } else {
                if (action == "add") {
                    for (let roleId of rolesId) {
                        if (permission.roles.includes(roleId)) {
                            this.sendErrors({
                                name: "Role already added",
                                value: "That role is already attributed for that command"
                            });
                            return false;
                        }
                    }
                    permission.roles = [...permission.roles, ...rolesId]
                } else if (action == "set") {
                    permission.roles = rolesId;
                }
                await permission.save();
            }
            this.message.channel.send("Permission added or setted successfully for the '"+commandName+"' command!");
        }
        return true;
    }

    help(Embed) {
        Embed.addFields({
               name: "Exemples :",
               value: config.command_prefix+"perm add notifyOnReact @Admins\n"+
                    "Ou "+config.command_prefix+"perm set notifyOnReact '@Admins, @Maintainers'\n"+
                    "Ou "+config.command_prefix+"perm show notifyOnReact"
            });
    }
}
