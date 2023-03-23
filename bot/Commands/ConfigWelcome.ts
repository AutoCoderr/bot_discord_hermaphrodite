import config from "../config";
import Command from "../Classes/Command";
import WelcomeMessage, {IWelcomeMessage} from "../Models/WelcomeMessage";
import {
    CommandInteraction,
    EmbedBuilder,
    Guild,
    GuildMember,
    Message,
    MessageType,
    PermissionFlagsBits
} from "discord.js";
import {userHasChannelPermissions} from "../Classes/OtherFunctions";
import CustomError from "../logging/CustomError";
import {IArgsModel,responseType} from "../interfaces/CommandInterfaces";
import errorCatcher from "../logging/errorCatcher";

export default class ConfigWelcome extends Command {
    static display = true;
    static description = "Pour activer, désactiver, ou définir le message privé à envoyer aux nouveaux arrivants."
    static commandName = "configWelcome";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel: IArgsModel = {
        $argsByOrder: [
            {
                isSubCommand: true,
                field: "action",
                type: "string",
                required: true,
                description: "L'action à effectuer: set, show, disable ou enable",
                choices: {
                    set: "Définir le message de bienvenue",
                    show: "Afficher le message de bienvenue configuré",
                    disable: "Désactiver le message de bienvenue",
                    enable: "Activer le message de bienvenue"
                }
            }
        ]
    }

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ConfigWelcome.commandName, ConfigWelcome.argsModel);
    }

    getMessageSettingCallback(): (() => Promise<responseType>) {
        return  () => new Promise(resolve =>  {
            let timeout;
            const listener = errorCatcher(async (fnArgs: [Message]) => {
                const [response] = fnArgs
                try {
                    if (response.author.id !== this.member.id || response.channelId !== this.channel.id)
                        return;

                    clearTimeout(timeout);
                    this.client.off('messageCreate', listener);

                    const messageCanBeDeleted = userHasChannelPermissions(<GuildMember>(<Guild>this.guild).members.me, this.channel, PermissionFlagsBits.ManageMessages)

                    const messageCanBeDeletedMessage = 
                        !messageCanBeDeleted ?
                        "(Attention : Herma bot ne dispose pas de la permission pour supprimer automatiquement votre message)\n\n" :
                        ""

                    if (response.content === "CANCEL") {
                        if (messageCanBeDeleted)
                            await response.delete();
                        resolve(this.response(true, messageCanBeDeletedMessage+"Commande annulée"))
                        return;
                    }

                    if (response.content.length > 1945) {
                        if (messageCanBeDeleted)
                            await response.delete();
                        return resolve(this.response(true, messageCanBeDeletedMessage+"Vous ne pouvez pas dépasser 1945 caractères. Vous en avez rentré "+response.content.length+"\nRéessayez :", this.getMessageSettingCallback()));
                    }

                    let welcomeMessage: IWelcomeMessage = await WelcomeMessage.findOne({serverId: (<Guild>this.guild).id});
                    let create = false;
                    if (welcomeMessage == null) {
                        create = true;
                        welcomeMessage = {
                            enabled: true,
                            message: response.content, // @ts-ignore
                            serverId: this.guild.id
                        };
                        WelcomeMessage.create(welcomeMessage);
                    } else {
                        welcomeMessage.message = response.content; // @ts-ignore
                        welcomeMessage.save();
                    }

                    if (messageCanBeDeleted)
                        await response.delete();

                    resolve(
                        this.response(true,
                            messageCanBeDeletedMessage+"Votre message a été enregistré et sera envoyé en MP aux nouveaux arrivants de ce serveur"+
                            (create ?  "\n(L'envoie de MP aux nouveaux a été activé)" : ""))
                    );
                } catch (e) {
                    throw new CustomError(<Error>e, {
                        from: "welcomeMessageSetListener",
                        guild: <Guild>this.guild,
                        user: this.member,
                        message: response
                    })
                }
            }, () => {
                clearTimeout(timeout);
                resolve(this.response(false, "Une erreur est survenue"));
            });


            this.client.on('messageCreate', listener);

            timeout = setTimeout(() => {
                this.client.off('messageCreate', listener);
                resolve(this.response(false, "Délai dépassé"));
            }, 15 * 60 * 1000)
        })
    }

    async action(args: {action: string}, bot) {
        const {action} = args;

        if (this.guild == null)
            return this.response(false,
                this.sendErrors( {
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );

        let resultContent: string;
        let welcomeMessage: IWelcomeMessage;
        switch(action) {
            case "set":
                return this.response(true, "Veuillez rentrer le message, qui sera envoyé en MP aux nouveaux arrivants sur ce serveur (tapez 'CANCEL' pour annuler) :", this.getMessageSettingCallback());
            case "show":
                welcomeMessage = await WelcomeMessage.findOne({serverId: this.guild.id});
                if (welcomeMessage == null) {
                    resultContent = "Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set";
                } else {
                    resultContent = "Message définit : \n\n---------------------------------\n\n"+welcomeMessage.message;
                }
                return this.response(true, resultContent);
            case "disable":
                welcomeMessage = await WelcomeMessage.findOne({serverId: this.guild.id});
                if (welcomeMessage == null) {
                    resultContent = "Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set";
                } else {
                    welcomeMessage.enabled = false; // @ts-ignore
                    welcomeMessage.save();
                    resultContent = "L'envoie de MP aux nouveaux a été désactivé.";
                }
                return this.response(true, resultContent);
            case "enable":
                welcomeMessage = await WelcomeMessage.findOne({serverId: this.guild.id});
                if (welcomeMessage == null) {
                    resultContent = "Il n'y a pas de message définit, vous pouvez le définir avec : "+config.command_prefix+this.commandName+" set";
                } else {
                    welcomeMessage.enabled = true; // @ts-ignore
                    welcomeMessage.save();
                    resultContent = "L'envoie de MP aux nouveaux a été activé, faite '"+config.command_prefix+this.commandName+" show' pour voir le MP qui sera envoyé aux nouveaux";
                }
                return this.response(true, resultContent);
        }
        return this.response(false, "Aucun action mentionnée");
    }

    static async listenJoinsToWelcome(message: Message) {
        if (message.author.bot || message.type !== MessageType.UserJoin || !message.guild)
            return;
        const welcomeMessage: IWelcomeMessage = await WelcomeMessage.findOne({
            serverId: message.guild.id,
            enabled: true
        });
        try {
            if (welcomeMessage != null) {
                await message.author.send(welcomeMessage.message);
            }
        } catch (e) {//@ts-ignore
            if (e.message == "Cannot send messages to this user" && welcomeMessage != null) {
                message.channel.send("<@" + message.author.id + "> \n\n" + welcomeMessage.message);
            } else {
                throw new CustomError(<Error>e, {welcomeMessage});
            }
        }
    }

    help() {
        return new EmbedBuilder()
            .setTitle("Exemples :")
            .addFields(<any>[
                {
                    name: "disable",
                    value: "Désactiver le message de bienvenue"
                },
                {
                    name: "enable",
                    value: "Activer le message de bienvenue"
                },
                {
                    name: "set",
                    value: "Définir le message de bienvenue qui sera envoyé en MP au nouveaux arrivant."
                },
                {
                    name: "show",
                    value: "Afficher le message bienvenue"
                },
                {
                    name: "-h",
                    value: "Afficher l'aide"
                }
            ].map(field => ({
                name: config.command_prefix+this.commandName+" "+field.name,
                value: field.value
            })));
    }
}
