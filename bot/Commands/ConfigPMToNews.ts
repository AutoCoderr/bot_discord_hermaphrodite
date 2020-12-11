import config from "../config";
import Command from "../Classes/Command";

export class ConfigPMToNews extends Command {
    static commandName = "configPMToNews";

    static async action(message,bot) {
        let args = this.parseCommand(message);
        if (!args) return false;

        this.displayHelp(message);

        return false;
    }

    static help(Embed) {
        Embed.addFields({
           name: "Arguments : ",
           value: "Premier argument: \n"+
                  " - disable: pour désactiver l'envoie de MP aux nouveaux arrivants,\n"+
                  " - enable: pour activer l'envoie de MP aux nouveaux arrivants (nécessite d'avoir au préalable définie le dit MP)\n"+
                  " - set: pour définir le MP à envoyer aux nouveaux arrivants, le bot écoutera votre message suivant pour le définir en tant que MP"
        }).addFields({
                name: "Exemples : ",
                value: config.command_prefix+this.commandName+" disable\n"+
                       config.command_prefix+this.commandName+" enable\n"+
                       config.command_prefix+this.commandName+" set => Le bot vous demander de rentrer le MP => Rentrez le message et validez\n"
            });
    }
}