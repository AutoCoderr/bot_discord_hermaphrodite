import Command from "../Classes/Command";
import config from "../config";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";
import {getRolesFromList} from "../Classes/OtherFunctions";
import Discord from "discord.js";

export class ConfigTicket extends Command {
    static commandName = "configTicket";

    static async action(message, bot) {
        let args = this.parseCommand(message);
        if (!args) return false;

        if (typeof(args[0]) == "undefined") {
            this.sendErrors(message, {
                name: "Argument missing",
                value: "Please specify 'set', 'show', 'enable', 'disable' or 'help'"
            });
            return false;
        }

        let ticketConfig: ITicketConfig;
        let category;

        switch(args[0]) {
            case "help":
                this.displayHelp(message);
                return false;
            case "set":
                if (typeof(args[1]) == "undefined") {
                    this.sendErrors(message, {
                        name: "Argument missing",
                        value: "You need to specify if you want to set category, or who can access to tickets"
                    });
                    return false;
                }
                switch(args[1]) {
                    case "category":
                        if (typeof(args[2]) == "undefined") {
                            this.sendErrors(message, {
                                name: "Argument missing",
                                value: "You need to specify the id of the category channel which will be user for the tickets"
                            });
                            return false;
                        }
                        const categoryId = args[2];
                        category = message.guild.channels.cache.get(categoryId);
                        if (category == undefined) {
                            this.sendErrors(message, {
                                name: "Bad id",
                                value: "The specified id channel does not exist"
                            });
                            return false;
                        }
                        if (category.type != "category") {
                            this.sendErrors(message, {
                                name: "Bad id",
                                value: "The specified channel is not a category"
                            });
                            return false;
                        }
                        ticketConfig = await TicketConfig.findOne({serverId: message.guild.id});
                        let create = false;
                        if (ticketConfig == null) {
                            create = true;
                            ticketConfig = {
                                enabled: true,
                                categoryId: categoryId,
                                serverId: message.guild.id,
                                roles: []
                            }
                            TicketConfig.create(ticketConfig);
                        } else {
                            ticketConfig.categoryId = categoryId; // @ts-ignore
                            ticketConfig.save();
                        }
                        message.channel.send("Ce sera dorénavant dans la catégorie '"+category.name+"' que seront gérés les tickets"+
                            (create ?  "\n(La fonctionnalité des tickets a été activée)" : ""));
                        return true;
                    case "permissions":
                        const specifiedRoles = args[2].split(",");
                        const rolesResponse: any = getRolesFromList(specifiedRoles, message);
                        if (!rolesResponse.success) {
                            this.sendErrors(message, rolesResponse.errors);
                            return false;
                        }
                        const { rolesId } = rolesResponse;

                        ticketConfig = await TicketConfig.findOne({serverId: message.guild.id});
                        if (ticketConfig == null) {
                            this.sendErrors(message, {
                                name: "Nothing config for the tickets",
                                value: "You need to create a ticket config for this server, with '"+config.command_prefix+"'"
                            });
                            return false;
                        }
                        ticketConfig.roles = rolesId // @ts-ignore
                        ticketConfig.save();

                        message.channel.send("Roles who can access to the tickets defined");
                        return true;
                    default:
                        this.sendErrors(message, {
                            name: "Bad argument",
                            value: "Do you want to set 'category' or 'permissions'"
                        });
                        return false;
                }
            case "show":
                if (typeof(args[1]) == "undefined") {
                    this.sendErrors(message, {
                        name: "Argument missing",
                        value: "You need to specify if you want to show category, or who can access to tickets"
                    });
                    return false;
                }
                ticketConfig = await TicketConfig.findOne({serverId: message.guild.id});
                if (ticketConfig == null) {
                    message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie")
                    return true;
                }
                switch(args[1]) {
                    case "category":
                        category = message.guild.channels.cache.get(ticketConfig.categoryId);
                        if (category == undefined) {
                            message.channel.send("On dirait que la catégorie que vous aviez définie n'existe plus, vous pouvez la redéfinir avec : "+config.command_prefix+this.commandName+" set idDeLaCategorie");
                        } else {
                            message.channel.send("Catégorie utilisée pour les tickers : "+category.name);
                        }
                        return true;
                    case "permissions":
                        const rolesId = ticketConfig.roles;

                        let Embed = new Discord.MessageEmbed()
                            .setColor('#0099ff')
                            .setTitle("Rôles ayant accès aux tickets :")
                            .setDescription("Liste des rôles pour les tickets")
                            .setTimestamp();

                        if (rolesId.length == 0) {
                            Embed.addFields({
                                name: "Aucun rôle",
                                value: "Aucun rôle n'as été parramétré pour avoir accès aux tickets, donc tout le monde y a accès par défaut."
                            })
                        } else {
                            let roles: Array<string> = [];
                            for (let roleId of rolesId) {
                                let role = message.guild.roles.cache.get(roleId);
                                let roleName: string;
                                if (role == undefined) {
                                    roleName = "unknown";
                                } else {
                                    roleName = role.name;
                                }
                                roles.push('@'+roleName);
                            }
                            Embed.addFields({
                                name: "Les roles :",
                                value: roles.join(",")
                            });
                        }
                        message.channel.send(Embed);
                        return true;
                    default:
                        this.sendErrors(message, {
                            name: "Bad argument",
                            value: "Do you want to show 'category' or 'permissions'"
                        });
                        return false;
                }
            case "add":
                if (typeof(args[1]) == "undefined") {
                    this.sendErrors(message, {
                        name: "Argument missing",
                        value: "You need to specify if you want to add some permissions"
                    });
                    return false;
                }
                switch(args[1]) {
                    case "permissions":
                        ticketConfig = await TicketConfig.findOne({serverId: message.guild.id});
                        if (ticketConfig == null) {
                            message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie")
                            return true;
                        }

                        const specifiedRoles = args[2].split(",");
                        const rolesResponse: any = getRolesFromList(specifiedRoles, message);
                        if (!rolesResponse.success) {
                            this.sendErrors(message, rolesResponse.errors);
                            return false;
                        }
                        const { rolesId } = rolesResponse;

                        for (let roleId of rolesId) {
                            if (ticketConfig.roles.includes(roleId)) {
                                this.sendErrors(message, {
                                    name: "Role already added",
                                    value: "That role is already attributed for that command"
                                });
                                return false;
                            }
                        }

                        ticketConfig.roles = [ ...ticketConfig.roles, ...rolesId ]; // @ts-ignore
                        ticketConfig.save();
                        message.channel.send("Roles définits avec succès!");
                        return true;
                    default:
                        this.sendErrors(message, {
                            name: "Bad argument",
                            value: "You need to specify 'permissions'"
                        });
                        return false;
                }
            case "disable":
                ticketConfig = await TicketConfig.findOne({serverId: message.guild.id});
                if (ticketConfig == null) {
                    message.channel.send("Il n'y a pas de categorie définie pour les tickets, vous pouvez la définir avec : "+config.command_prefix+this.commandName+" set idDeLaCategorie");
                } else {
                    ticketConfig.enabled = false; // @ts-ignore
                    ticketConfig.save();
                    message.channel.send("La fonctionalité des tickets a été désactivée.");
                }
                return true;
            case "enable":
                ticketConfig = await TicketConfig.findOne({serverId: message.guild.id});
                if (ticketConfig == null) {
                    message.channel.send("Il n'y a pas de categorie définie pour les tickets, vous pouvez la définir avec : "+config.command_prefix+this.commandName+" set idDeLaCategorie");
                } else {
                    ticketConfig.enabled = true; // @ts-ignore
                    ticketConfig.save();
                    message.channel.send("La fonctionalité des tickets a été activée, faite '"+config.command_prefix+this.commandName+" show' pour voir le nom de la catégorie dans laquelle apparaitrons les tickets");
                }
                return true;

        }

        this.sendErrors(message, {
            name: "Bad argument",
            value: "Please specify 'set', 'show', 'enable', 'disable' or 'help'"
        })
        return false;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "set category, définir l'id de la catégorie dans laquelle apparaitrons les tickets\n"+
                   "set permissions, définir les rôles qui auront accès aux tickets sur ce serveur\n"+
                   "show category, pour voir la catégorie qui a été définie\n"+
                   "show permissions, pour voir les rôles qui ont accès aux tickets\n"+
                   "add permissions, pour ajouter des rôles qui auront accès aux tickets\n"+
                   "enable, pour activer les tickets sur ce serveur\n"+
                   "disable, pour désactiver les tickets sur ce serveur"
        }).addFields({
            name: "Exemples :",
            value: config.command_prefix+this.commandName+" set category 475435899654125637\n"+
                   config.command_prefix+this.commandName+" set permissions '@moderateurs,@admins'\n"+
                   config.command_prefix+this.commandName+" show category\n"+
                   config.command_prefix+this.commandName+" show permissions\n"+
                   config.command_prefix+this.commandName+" add permissions @moderateurs2\n"+
                   config.command_prefix+this.commandName+" enable\n"+
                   config.command_prefix+this.commandName+" disable"
        })
    }
}