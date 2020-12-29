import config from "../config";
import Command from "../Classes/Command";
import WelcomeMessage, {IWelcomeMessage} from "../Models/WelcomeMessage";

export class ConfigWelcome extends Command {
    static commandName = "configWelcome";

    static async action(message,bot) {
        let args = this.parseCommand(message);
        if (!args) return false;

        if (typeof(args[0]) == "undefined") {
            this.sendErrors(message, {
                name: "Argument missing",
                value: "Please specify 'set', 'show', 'enable', 'disable' or 'help'"
            });
            return false;
        }
        let welcomeMessage: IWelcomeMessage;
        switch(args[0]) {
            case "help":
                this.displayHelp(message);
                return false;
            case "set":
                message.channel.send("Veuillez rentrer le message, qui sera envoyé en MP aux nouveaux arrivants sur ce serveur :")
                    .then(sentMessage => {
                        const listener = async response => {
                            if (response.author.id == message.author.id) {
                                let welcomeMessage: IWelcomeMessage = await WelcomeMessage.findOne({serverId: message.guild.id});
                                let create = false;
                                if (welcomeMessage == null) {
                                    create = true;
                                    welcomeMessage = {
                                        enabled: true,
                                        message: response.content,
                                        serverId: message.guild.id
                                    };
                                    WelcomeMessage.create(welcomeMessage);
                                } else {
                                    welcomeMessage.message = response.content; // @ts-ignore
                                    welcomeMessage.save();
                                }
                                message.channel.send("Votre message a été enregistré et sera envoyé en MP aux nouveaux arrivants de ce serveur"+
                                                        (create ?  "\n(L'envoie de MP aux nouveaux a été activé)" : ""));
                                bot.off('message', listener);
                            }
                        };
                        bot.on('message', listener);
                    });
                return true;
            case "show":
                welcomeMessage = await WelcomeMessage.findOne({serverId: message.guild.id});
                if (welcomeMessage == null) {
                    message.channel.send("Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set");
                } else {
                    message.channel.send("Message définit : \n\n---------------------------------\n\n"+welcomeMessage.message);
                }
                return true;
            case "disable":
                welcomeMessage = await WelcomeMessage.findOne({serverId: message.guild.id});
                if (welcomeMessage == null) {
                    message.channel.send("Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set");
                } else {
                    welcomeMessage.enabled = false; // @ts-ignore
                    welcomeMessage.save();
                    message.channel.send("L'envoie de MP aux nouveaux a été désactivé.");
                }
                return true;
            case "enable":
                welcomeMessage = await WelcomeMessage.findOne({serverId: message.guild.id});
                if (welcomeMessage == null) {
                    message.channel.send("Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set");
                } else {
                    welcomeMessage.enabled = true; // @ts-ignore
                    welcomeMessage.save();
                    message.channel.send("L'envoie de MP aux nouveaux a été activé, faite '"+config.command_prefix+this.commandName+" show' pour voir le MP qui sera envoyé aux nouveaux");
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
           name: "Arguments : ",
           value: "Premier argument: \n"+
                  " - disable: pour désactiver l'envoie de MP aux nouveaux arrivants,\n"+
                  " - enable: pour activer l'envoie de MP aux nouveaux arrivants (nécessite d'avoir au préalable définie le dit MP)\n"+
                  " - set: pour définir le MP à envoyer aux nouveaux arrivants, le bot écoutera votre message suivant pour le définir en tant que MP\n"+
                  " - show: pour visionner le message envoyé en MP aux nouveaux"
        }).addFields({
                name: "Exemples : ",
                value: config.command_prefix+this.commandName+" disable\n"+
                       config.command_prefix+this.commandName+" enable\n"+
                       config.command_prefix+this.commandName+" set => Le bot vous demande de rentrer le MP => Rentrez le message et validez\n"+
                       config.command_prefix+this.commandName+" show"
            });
    }
}