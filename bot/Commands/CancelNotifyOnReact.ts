import config from "../config";
import Command from "../Classes/Command";

export class CancelNotifyOnReact extends Command {
    static commandName = "cancelNotifyOnReact";

    static async action(message,bot) {
        this.displayHelp(message);

        return true;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "--channel, Spécifier le channel sur lequel désactifier l'écoute de réaction \n"+
                "\t(si pas de message spécifié, désactive l'écoute sur tout les messages de ce channel sur lesquels il y a une écoute)\n"+
                "--message, Spécifier l'id du message sur lequel désactiver l'écoute (nécessite le champs --channel pour savoir où est le message)\n"+
                "-e, Spécifier l'émote pour laquelle il faut désactiver l'écoute (nécessite --channel et \n--message)\n"+
                "all, à mettre sans rien d'autre, pour désactiver l'écoute sur tout les messages"
        })
            .addFields({
                name: "Exemples :",
                value: config.command_prefix+this.commandName+" -channel #leChannel\n"+
                    config.command_prefix+this.commandName+" -channel #leChannel --message idDuMessage\n"+
                    config.command_prefix+this.commandName+" -channel #leChannel --message idDuMessage -e :emote: \n"+
                    config.command_prefix+this.commandName+" all"
            });
    }
}