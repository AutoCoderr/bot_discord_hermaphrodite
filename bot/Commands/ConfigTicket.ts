import Command from "../Classes/Command";
import config from "../config";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";
import {extractUserId} from "../Classes/OtherFunctions";
import Discord from "discord.js";
import {getUserFromCache} from "../Classes/Cache";

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
                        value: "You need to specify the id of the category channel which will be user for the tickets"
                    });
                    return false;
                }
                const categoryId = args[1];
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
                let toEnable = false;
                if (ticketConfig == null) {
                    toEnable = true;
                    ticketConfig = {
                        enabled: true,
                        categoryId: categoryId,
                        serverId: message.guild.id,
                        blacklist: [],
                        whitelist: []
                    }
                    TicketConfig.create(ticketConfig);
                } else {
                    if (ticketConfig.categoryId == null)  {
                        toEnable = true;
                        ticketConfig.enabled = true;
                    }
                    ticketConfig.categoryId = categoryId; // @ts-ignore
                    ticketConfig.save();
                }
                message.channel.send("Ce sera dorénavant dans la catégorie '"+category.name+"' que seront gérés les tickets"+
                    (toEnable ?  "\n(La fonctionnalité des tickets a été activée)" : ""));
                return true;
            case "show":
                ticketConfig = await TicketConfig.findOne({serverId: message.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie")
                } else {
                    category = message.guild.channels.cache.get(ticketConfig.categoryId);
                    if (category == undefined) {
                        message.channel.send("On dirait que la catégorie que vous aviez définie n'existe plus, vous pouvez la redéfinir avec : " + config.command_prefix + this.commandName + " set idDeLaCategorie");
                    } else {
                        message.channel.send("Catégorie utilisée pour les tickers : " + category.name);
                    }
                }
                return true;
            case "disable":
                ticketConfig = await TicketConfig.findOne({serverId: message.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie")
                } else {
                    ticketConfig.enabled = false; // @ts-ignore
                    ticketConfig.save();
                    message.channel.send("La fonctionalité des tickets a été désactivée.");
                }
                return true;
            case "enable":
                ticketConfig = await TicketConfig.findOne({serverId: message.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie")
                } else {
                    ticketConfig.enabled = true; // @ts-ignore
                    ticketConfig.save();
                    message.channel.send("La fonctionalité des tickets a été activée. \nFaite '"+config.command_prefix+this.commandName+" show ' pour voir le nom de la catégorie dans laquelle apparaitrons les tickets");
                }
                return true;
        }
        if (args[0] == "whitelist" || args[0] == "blacklist") {
            if (typeof(args[1]) == "undefined") {
                this.sendErrors(message, {
                    name: "Argument missing",
                    value: "Please specify 'add' or 'remove'"
                });
                return false;
            }
            let userId;
            switch(args[1]) {
                case "add":
                    if (typeof(args[2]) == "undefined") {
                        this.sendErrors(message, {
                            name: "Argument missing",
                            value: "You need to specify the user to add"
                        });
                        return false;
                    }
                    userId = extractUserId(args[2]);
                    if (!userId) {
                        this.sendErrors(message, {
                            name: "Bad argument",
                            value: "You haven't correctly mentionned the user to add"
                        });
                        return false;
                    }
                    return this.addUserToList(message,message.guild.id,userId, args[0] == "blacklist");

                case "remove":
                    if (typeof(args[2]) == "undefined") {
                        this.sendErrors(message, {
                            name: "Argument missing",
                            value: "You need to specify the user to remove"
                        });
                        return false;
                    }
                    userId = extractUserId(args[2]);
                    if (!userId) {
                        this.sendErrors(message, {
                            name: "Bad argument",
                            value: "You haven't correctly mentionned the user to remove"
                        });
                        return false;
                    }
                    return this.removeUserFromList(message,message.guild.id,userId, args[0] == "blacklist");

                case "show":
                    return this.showUsersInList(bot, message, message.guild.id, args[0] == "blacklist");
            }
            this.sendErrors(message, {
                name: "Bad argument",
                value: "Please specify 'add', 'remove' or 'show'"
            })
            return false;
        }

        this.sendErrors(message, {
            name: "Bad argument",
            value: "Please specify 'set', 'show', 'enable', 'disable' or 'help'"
        })
        return false;
    }

    static async addUserToList(message, serverId, userId, blacklist = false) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});
        if (ticketConfig == null) {
            ticketConfig = {
                enabled: false,
                categoryId: null,
                blacklist: blacklist ? [userId] : [],
                whitelist: blacklist ? [] : [userId],
                serverId: serverId
            }
            TicketConfig.create(ticketConfig);
        } else {
            if ((blacklist && ticketConfig.blacklist.includes(userId)) ||
                (!blacklist && ticketConfig.whitelist.includes(userId))) {
                message.channel.send("Il semblerait que cet utilisateur se trouve déjà dans la "+(blacklist ? "blacklist" : "whitelist"));
                return true;
            }
            if (blacklist) {
                ticketConfig.blacklist.push(userId);
            } else {
                ticketConfig.whitelist.push(userId);
            } // @ts-ignore
            ticketConfig.save();
        }
        message.channel.send("L'utilisateur a été ajouté avec succès à la "+(blacklist ? "blacklist" : "whitelist")+" !")
        return true;
    }2

    static async removeUserFromList(message, serverId, userId, blacklist = false) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});

        if (ticketConfig == null ||
            (blacklist && !ticketConfig.blacklist.includes(userId)) ||
            (!blacklist && !ticketConfig.whitelist.includes(userId))) {
            message.channel.send("Il semblerait que l'utilisateur ne se trouve pas dans la "+(blacklist ? "blacklist" : "whitelist"));
            return true;
        }
        let list = blacklist ? ticketConfig.blacklist : ticketConfig.whitelist;
        for (let i=0;i<list.length;i++) {
            if (list[i] == userId) {
                list.splice(i,1);
                break;
            }
        } // @ts-ignore
        ticketConfig.save();

        message.channel.send("L'utilisateur a été retiré avec succès de la "+(blacklist ? "blacklist" : "whitelist")+" !")
        return true;
    }

    static async showUsersInList(bot, message, serverId, blacklist = false) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle("Les utilisateurs de la "+(blacklist ? "blacklist" : "whitelist")+" :")
            .setDescription("Liste des utilisateurs de la "+(blacklist ? "blacklist" : "whitelist"))
            .setTimestamp();

        if (ticketConfig == null ||
            (blacklist && ticketConfig.blacklist.length == 0) ||
            (!blacklist && ticketConfig.whitelist.length == 0)) {
            Embed.addFields({
                name: "Aucun utilisateur",
                value: "Il n'y a aucun utilisateur dans la "+(blacklist ? "blacklist" : "whitelist")
            });
        } else {
            const list = blacklist ? ticketConfig.blacklist : ticketConfig.whitelist;
            const users: Array<string> = [];

            for (let userId of list) {
                const user = getUserFromCache(userId,bot);
                users.push("@"+(user != null ? user.username : "unknown"));
            }
            Embed.addFields({
                name: "Les utilisateurs :",
                value: users.join(", ")
            });
        }
        message.channel.send(Embed);
        return true;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "set, définir l'id de la catégorie dans laquelle apparaitrons les tickets\n"+
                   "show, pour voir la catégorie qui a été définie\n"+
                   "enable, pour activer les tickets sur ce serveur\n"+
                   "disable, pour désactiver les tickets sur ce serveur\n"+
                   "whitelist add, pour ajouter un utilisateur à la whitelist\n"+
                   "whitelist remove, pour retirer un utilisateur de la whitelist\n"+
                   "whitelist show, pour visionner les utilisateurs de la whitelist\n"+
                   "blacklist add, pour ajouter un utilisateur à la blacklist\n"+
                   "blacklist remove, pour retirer un utilisateur de la blacklist\n"+
                   "blacklist show, pour visionner les utilisateurs de la blacklist"
        }).addFields({
            name: "Exemples :",
            value: config.command_prefix+this.commandName+" set 475435899654125637\n"+
                   config.command_prefix+this.commandName+" show\n"+
                   config.command_prefix+this.commandName+" enable\n"+
                   config.command_prefix+this.commandName+" disable\n"+
                   config.command_prefix+this.commandName+" whitelist add @unUtilisateur\n"+
                   config.command_prefix+this.commandName+" whitelist remove @unUtilisateur\n"+
                   config.command_prefix+this.commandName+" whitelist show\n"+
                   config.command_prefix+this.commandName+" blacklist add @unUtilisateur\n"+
                   config.command_prefix+this.commandName+" blacklist remove @unUtilisateur\n"+
                   config.command_prefix+this.commandName+" blacklist show"
        })
    }
}
