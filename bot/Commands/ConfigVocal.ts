import Command from "../Classes/Command";
import {
    EmbedFieldData,
    GuildChannel,
    GuildMember,
    Message,
    MessageEmbed,
    ThreadChannel,
    VoiceChannel
} from "discord.js";
import VocalConfig from "../Models/VocalConfig";
import {splitFieldsEmbed} from "../Classes/OtherFunctions";
import config from "../config";

export default class ConfigVocal extends Command {
    static display = true;
    static description = "Pour s'abonner un ou plusieurs utilisateurs et un ou plusieurs channels vocaux, afin de recevoir un MP à chaque connexion ou déconnexion au vocal";
    static commandName = "configVocal";

    constructor(message: Message) {
        super(message, ConfigVocal.commandName);
    }

    argsModel = {
        help: { fields: ["-h","--help"], type: "boolean", required: false, description: "Pour afficher l'aide" },
        $argsByType: {
            action: {
                required: (args) => args.help == undefined,
                type: "string",
                description: "L'action à effectuer : blacklist, enable, disable",
                valid: field => ['blacklist','enable','disable'].includes(field)
            },
            subAction: {
                required: (args) => args.help == undefined && args.action === "blacklist",
                type: "string",
                description: "L'action à effectuer sur la blacklist: add, remove, clear, show",
                valid: field => ['add','remove','clear', 'show'].includes(field)
            },
            blacklistType: {
                required: (args) => args.help == undefined && args.action === "blacklist",
                type: "string",
                description: "Le type de blacklist: listener, listened, channel",
                valid: field => ['listener','listenable','channel'].includes(field)
            },
            users: {
                required: (args) => args.help == undefined && args.action === "blacklist" &&
                    ['add','remove'].includes(args.subAction) && ['listener','listened'].includes(args.blacklistType),
                type: "users",
                description: "Le ou les utilisateurs à ajouter ou supprimer"
            },
            channels: {
                required: (args) => args.help == undefined && args.action === "blacklist" &&
                    ['add','remove'].includes(args.subAction) && args.blacklistType == "channel",
                type: 'channels',
                description: "Le ou les channels vocaux à supprimer ou ajouter",
                value: (channels: GuildChannel[]) => !channels.some(channel => channel.type != "GUILD_VOICE")
            }
        }
    }

    async action(args: {help: boolean, action: string, subAction: string, blacklistType: string, users: GuildMember[], channels: VoiceChannel[]}) {
        const {help, action, subAction, blacklistType, users, channels} = args;

        if (help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild == null) {
            this.sendErrors( {
                name: "Missing guild",
                value: "We couldn't find the message guild"
            });
            return false;
        }

        let vocalConfig: typeof VocalConfig = await VocalConfig.findOne({server: this.message.guild.id})

        if (action == "enable" || action == "disable") {

            if (vocalConfig == null) {
                VocalConfig.create({
                    enabled: action == "enable",
                    listenerBlacklist: [],
                    listenableBlacklist: [],
                    channelBlacklist: [],
                    userMutes: {},
                    serverId: this.message.guild.id
                })
            } else {
                vocalConfig.enabled = action == "enable";
                vocalConfig.save();
            }
            this.message.channel.send("L'abonnement vocal a été "+(action == "enable" ? "activé" : "désactivé")+" sur ce serveur");

        } else { // if action is 'blacklist'
            if (vocalConfig == null || !vocalConfig.enabled) {
                this.sendErrors( {
                    name: "Vocal désactivé",
                    value: "Vous devez d'abord activer l'abonnement vocal sur ce serveur avec : \n"+config.command_prefix+this.commandName+" enable"
                });
                return false;
            }
            switch (subAction) {
                case 'add':
                    let blacklistedIds = {};
                    for (const id of vocalConfig[blacklistType+"Blacklist"])
                        blacklistedIds[id] = true;

                    for (const id of blacklistType == "channel" ? channels.map(channel => channel.id) : users.map(user => user.id)) {
                        if (!blacklistedIds[id]) {
                            blacklistedIds[id] = true;
                            vocalConfig[blacklistType + "Blacklist"].push(id)
                        }
                    }
                    this.message.channel.send("Les "+(blacklistType == "channel" ? "channels" : "utilisateurs")+" ont été ajouté à la blacklist '"+blacklistType+"'");
                    break;
                case 'remove':
                    vocalConfig[blacklistType+"Blacklist"] = vocalConfig[blacklistType+"Blacklist"]
                        .filter(id =>
                            (blacklistType == "channel" && !channels.some(channel => channel.id == id)) ||
                            (blacklistType != "channel" && !users.some(user => user.id == id))
                        );
                    this.message.channel.send("Les "+(blacklistType == "channel" ? "channels" : "utilisateurs")+" ont été retirés de la blacklist '"+blacklistType+"'");
                    break;
                case 'clear':
                    vocalConfig[blacklistType+"Blacklist"] = [];
                    this.message.channel.send("La blacklist '"+blacklistType+"' a été vidée");
                    break;
                case 'show':
                    const fields: EmbedFieldData[] = vocalConfig[blacklistType+"Blacklist"].length > 0 ?
                        await Promise.all(vocalConfig[blacklistType+"Blacklist"].map(async (id: string) => {
                            let member: GuildMember|undefined;
                            let channel: GuildChannel|VoiceChannel|ThreadChannel|undefined;
                            if (blacklistType != "channel") {
                                member = await this.message.guild?.members.fetch(id)
                            } else {
                                channel = this.message.guild?.channels.cache.get(id);
                            }
                            return {
                                name: blacklistType == "channel" ?
                                    ( channel ? '#!'+channel.name : "introuvale" ) :
                                    ( member ? '@'+(member.nickname??member.user.username) : "introuvable" ),
                                value: "id : "+id
                            };
                        })) : [{
                            name: "Aucun "+(blacklistType == "channel" ? "channel" : "utilisateur")+" dans cette liste",
                            value: "Aucun "+(blacklistType == "channel" ? "channel" : "utilisateur")+" dans cette liste",
                        }];

                    const embeds = splitFieldsEmbed(25,fields,(embed: MessageEmbed,nbPart) => {
                        if (nbPart == 1) {
                            embed.setTitle("Contenu de la blacklist '"+blacklistType+"'");
                        }
                    })
                    this.message.channel.send({embeds});
            }
            if (subAction != 'show')
                vocalConfig.save();

        }

        return true;
    }


    help(Embed: MessageEmbed) {
        Embed.addFields({
            name: "Exemples :",
            value:
                config.command_prefix+this.commandName+" enable\n"+
                config.command_prefix+this.commandName+" disable\n"+
                config.command_prefix+this.commandName+" blacklist add listener @user1,@user2 \n"+
                config.command_prefix+this.commandName+" blacklist remove channel '#channel1, #channel2' \n"+
                config.command_prefix+this.commandName+" blacklist clear listenable \n"+
                config.command_prefix+this.commandName+" blacklist show listenable \n"+
                config.command_prefix+this.commandName+" -h"
        });
    }
}
