import Command from "../Classes/Command";
import config from "../config";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";
import WelcomeMessage from "../Models/WelcomeMessage";

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
                switch(args[1]) {
                    case "category":
                        ticketConfig = await TicketConfig.findOne({serverId: message.guild.id});
                        if (ticketConfig == null) {
                            message.channel.send("Il n'y a pas de categorie définie pour les tickets, vous pouvez la définir avec : "+config.command_prefix+this.commandName+" set idDeLaCategorie");
                        } else {
                            category = message.guild.channels.cache.get(ticketConfig.categoryId);
                            if (category == undefined) {
                                message.channel.send("On dirait que la catégorie que vous aviez définie n'existe plus, vous pouvez la redéfinir avec : "+config.command_prefix+this.commandName+" set idDeLaCategorie");
                            } else {
                                message.channel.send("Catégorie utilisée pour les tickers : "+category.name);
                            }
                        }
                        return true;
                    default:
                        this.sendErrors(message, {
                            name: "Bad argument",
                            value: "Do you want to show 'category' or 'permissions'"
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
                   "show category, pour voir la catégorie qui a été définit\n"+
                   "enable, pour activer les tickets sur ce serveur\n"+
                   "disable, pour désactiver les tickets sur ce serveur"
        }).addFields({
            name: "Exemples :",
            value: config.command_prefix+this.commandName+" set category 475435899654125637\n"+
                   config.command_prefix+this.commandName+" show category\n"+
                   config.command_prefix+this.commandName+" enable\n"+
                   config.command_prefix+this.commandName+" disable"
        })
    }
}