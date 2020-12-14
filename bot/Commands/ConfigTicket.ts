import Command from "../Classes/Command";
import config from "../config";

export class ConfigTicket extends Command {
    static commandName = "configTicket";

    static async action(message, bot) {
        this.displayHelp(message);
        return false;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "set, définir l'id de la catégorie dans laquelle apparaitrons les tickets\n"+
                   "show, pour voir la catégorie qui a été définit\n"+
                   "enable, pour activer les tickets sur ce serveur\n"+
                   "disable, pour désactiver les tickets sur ce serveur"
        }).addFields({
            name: "Exemples :",
            value: config.command_prefix+this.commandName+" set 475435899654125637\n"+
                   config.command_prefix+this.commandName+" show\n"+
                   config.command_prefix+this.commandName+" enable\n"+
                   config.command_prefix+this.commandName+" disable"
        })
    }
}