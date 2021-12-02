import config from "../config";
import Command from "../Classes/Command";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildMember,
    MessageEmbed,
    Role,
    TextBasedChannels,
    User
} from "discord.js";
import Permissions, {IPermissions} from "../Models/Permissions";
import {
    addRoleToSlashCommandPermission,
    removeRoleFromSlashCommandPermission,
    setRoleToSlashCommandPermission
} from "../slashCommands";

export default class Perm extends Command {
    static display = true;
    static description = "Pour configurer les permissions.";
    static commandName = "perm";

    static slashCommand = true;

    static argsModel = {

        $argsByOrder: [
            {
                isSubCommand: true,
                field: "action",
                type: "string",
                required: true,
                description: "'add', 'remove', 'set', 'clear' ou 'show'",
                choices: {
                    add: 'Ajouter un ou des rôles à une commande',
                    remove: 'Retirer un ou des rôles d\'une commande',
                    set: 'Définir un ou des rôles sur une commande',
                    clear: 'Retirer tout les rôles autorisés à utiliser une commande',
                    show: "Afficher les rôles d'une commande"
                }
            },
            {
                referToSubCommands: ['add','remove','set','clear','show'],
                field: "commands",
                type: "command",
                multi: true,
                required: true,
                description: "La ou les commandes sur laquelle ajouter ou définir la permission",
                valid: async (commands: typeof Command|Array<typeof Command>, args) => { // Vérifie si une commande n'a pas été tapée plusieurs fois
                    if (!(commands instanceof Array) && args.commands.some(eachCommand => eachCommand.commandName == commands.commandName))
                        return false;
                    if (commands instanceof Array) {
                        let alreadySpecifieds = {};
                        for (const command of commands) {
                            if (alreadySpecifieds[<string>command.commandName])
                                return false;
                            else
                                alreadySpecifieds[<string>command.commandName] = true;
                        }
                    }
                    return true;
                },
                errorMessage: (value, _) => {
                    if (value != undefined) {
                        return {
                            name: "Liste de commandes invalide",
                            value: value+" : Une de ces commandes n'existe pas, vous est inaccesible, ou a été spécifiée plusieurs fois"
                        };
                    }
                    return {
                        name: "Nom de commande manquant",
                        value: "Nom de la commande non spécifié"
                    };
                }
            },
            {
                referToSubCommands: ['add','set','remove'],
                field: "roles",
                type: "role",
                multi: true,
                required: args => ["add","set","remove"].includes(args.action),
                description: "Le ou les rôles autorisés à taper cette commande"
            }
        ]
    };

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: string) {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, Perm.commandName, Perm.argsModel);
    }

    async action(args: {action: string, commands: typeof Command[], roles: Array<Role>}, bot) { //%perm set commandName @role
        const {action, commands, roles} = args;

        if (this.guild == null) {
            return this.response(false,
                this.sendErrors({
                    name: "Guild missing",
                    value: "We cannot find the guild"
                })
            );
        }

        if (action == "show") { // Show the roles which are allowed to execute the specified command

            const embeds: MessageEmbed[] = [];

            for (const command of commands) {
                const permission: IPermissions|null = await Permissions.findOne({command: command.commandName, serverId: this.guild.id});
                let embed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle("Les permissions pour '"+command.commandName+"' :")
                    .setDescription("Liste des permissions pour '"+command.commandName+"'")
                    .setTimestamp();
                if (permission == null || permission.roles.length == 0) {
                    embed.addFields({
                        name: "Aucune permission",
                        value: "Il n'y a aucune permission trouvée pour la commande " + command.commandName
                    });
                } else {
                    let roles: Array<string> = [];
                    for (let roleId of permission.roles) { //@ts-ignore
                        let role = this.guild.roles.cache.get(roleId);
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

            return this.response(true, {embeds});
        }


        const serverId = this.guild.id;

        const rolesId = roles ? roles.map(role => role.id) : [];

        const responses: string[] = [];
        for (const command of commands) {
            const permission = await Permissions.findOne({serverId: serverId, command: command.commandName});

            if (permission == null) {
                const permission: IPermissions = {
                    command: <string>command.commandName,
                    roles: rolesId,
                    serverId: serverId
                }
                Permissions.create(permission);
            } else {
                if (action == "add") {
                    for (let roleId of rolesId) {
                        if (permission.roles.includes(roleId)) {
                            return this.response(false,
                                this.sendErrors({
                                    name: "Role already added",
                                    value: "That role is already attributed for that command"
                                })
                            );
                        }
                    }
                    permission.roles = [...permission.roles, ...rolesId];
                    await addRoleToSlashCommandPermission(this.guild, <string>command.commandName, rolesId);
                    responses.push("Permission added successfully for the '"+command.commandName+"' command!");
                } else if (action == "set") {
                    permission.roles = rolesId;
                    await setRoleToSlashCommandPermission(this.guild, <string>command.commandName, rolesId);
                    responses.push("Permission setted successfully for the '"+command.commandName+"' command!");
                } else if (action == "clear") {
                    permission.roles = [];
                    await setRoleToSlashCommandPermission(this.guild, <string>command.commandName, []);
                    responses.push("Permission cleared successfully for the '"+command.commandName+"' command!");
                } else if (action == "remove") {
                    permission.roles = permission.roles.filter(roleId => !roles.some(role => role.id == roleId))
                    await removeRoleFromSlashCommandPermission(this.guild, <string>command.commandName, roles);
                    responses.push("Permission removed successfully for the '"+command.commandName+"' command!");
                }
                await permission.save();
            }
        }
        return this.response(true, responses.join('\n'));
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "add notifyOnReact @Admins",
                    value: "Ajouter le role @&Admins dans la liste des rôles autoriser à utiliser la commande notifyOnReact"
                },
                {
                    name: "set notifyOnReact @Admins @Maintainers",
                    value: "Définir @Admins et @Maintainers comme les rôles autorisés à utiliser la commande notifyOnReact"
                },
                {
                    name: "clear notifyOnReact",
                    value: "Retirer toutes les permissions de la commande notifyOnReact"
                },
                {
                    name: "remove notifyOnReact @role1 @role2",
                    value: "Retirer les roles @role1 et @role2 de la commande notifyOnReact"
                },
                {
                    name: "show notifyOnReact",
                    value: "Afficher les rôles autorisés à utiliser la commande notifyOnReact"
                }
            ].map(field => ({
                name: config.command_prefix+this.commandName+" "+field.name,
                value: field.value
            })));
    }
}
