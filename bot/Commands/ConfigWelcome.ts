import config from "../config";
import Command from "../Classes/Command";
import WelcomeMessage, {IWelcomeMessage} from "../Models/WelcomeMessage";
import {Message} from "discord.js";

export default class ConfigWelcome extends Command {

    argsModel = {
        help: { fields: ["-h","--help"], type: "boolean", required: false, description: "Pour afficher l'aide" },

        $argsByOrder: [
            {
                field: "action",
                type: "string",
                required: args => args.help == undefined,
                description: "L'action à effectuer: set, show, disable ou enable",
                valid: (elem,_) => {
                    return ["set","show","disable","enable"].includes(elem)
                }
            }
        ]
    }

    static display = true;
    static description = "Pour activer, désactiver, ou définir le message privé à envoyer automatiquement aux nouveaux arrivants."
    static commandName = "configWelcome";

    constructor(message: Message) {
        super(message, ConfigWelcome.commandName);
    }

    async action(args: {help: boolean, action: string}, bot) {
        const {help, action} = args;

        if (this.message.guild == null) {
            this.sendErrors( {
                name: "Missing guild",
                value: "We couldn't find the message guild"
            });
            return false;
        }

        if (help) {
            this.displayHelp();
            return false;
        }

        let welcomeMessage: IWelcomeMessage;
        switch(action) {
            case "set":
                this.message.channel.send("Veuillez rentrer le message, qui sera envoyé en MP aux nouveaux arrivants sur ce serveur :")
                    .then(sentMessage => {
                        const listener = async (response: Message) => {
                            if (response.author.id == this.message.author.id) { // @ts-ignore
                                let welcomeMessage: IWelcomeMessage = await WelcomeMessage.findOne({serverId: this.message.guild.id});
                                let create = false;
                                if (welcomeMessage == null) {
                                    create = true;
                                    welcomeMessage = {
                                        enabled: true,
                                        message: response.content, // @ts-ignore
                                        serverId: this.message.guild.id
                                    };
                                    WelcomeMessage.create(welcomeMessage);
                                } else {
                                    welcomeMessage.message = response.content; // @ts-ignore
                                    welcomeMessage.save();
                                }
                                this.message.channel.send("Votre message a été enregistré et sera envoyé en MP aux nouveaux arrivants de ce serveur"+
                                                        (create ?  "\n(L'envoie de MP aux nouveaux a été activé)" : ""));
                                bot.off('message', listener);
                            }
                        };
                        bot.on('message', listener);
                    });
                return true;
            case "show":
                welcomeMessage = await WelcomeMessage.findOne({serverId: this.message.guild.id});
                if (welcomeMessage == null) {
                    this.message.channel.send("Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set");
                } else {
                    this.message.channel.send("Message définit : \n\n---------------------------------\n\n"+welcomeMessage.message);
                }
                return true;
            case "disable":
                welcomeMessage = await WelcomeMessage.findOne({serverId: this.message.guild.id});
                if (welcomeMessage == null) {
                    this.message.channel.send("Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set");
                } else {
                    welcomeMessage.enabled = false; // @ts-ignore
                    welcomeMessage.save();
                    this.message.channel.send("L'envoie de MP aux nouveaux a été désactivé.");
                }
                return true;
            case "enable":
                welcomeMessage = await WelcomeMessage.findOne({serverId: this.message.guild.id});
                if (welcomeMessage == null) {
                    this.message.channel.send("Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set");
                } else {
                    welcomeMessage.enabled = true; // @ts-ignore
                    welcomeMessage.save();
                    this.message.channel.send("L'envoie de MP aux nouveaux a été activé, faite '"+config.command_prefix+this.commandName+" show' pour voir le MP qui sera envoyé aux nouveaux");
                }
                return true;
        }
        return false;
    }

    help(Embed) {
        Embed.addFields({
                name: "Exemples : ",
                value: config.command_prefix+this.commandName+" disable\n"+
                       config.command_prefix+this.commandName+" enable\n"+
                       config.command_prefix+this.commandName+" set => Le bot vous demande de rentrer le MP => Rentrez le message et validez\n"+
                       config.command_prefix+this.commandName+" show\n"+
                       config.command_prefix+this.commandName+" --help"
            });
    }
}
