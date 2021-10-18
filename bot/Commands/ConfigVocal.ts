import Command from "../Classes/Command";
import {
    EmbedFieldData,
    GuildChannel,
    GuildMember,
    Message,
    MessageEmbed, Role,
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
                description: "Le type de blacklist: listener, channel",
                valid: field => ['listener','channel'].includes(field)
            },
            users: {
                required: false,
                displayExtractError: true,
                type: "users",
                description: "Le ou les utilisateurs à ajouter ou supprimer",
                errorMessage: (_) => ({
                    name: "Utilisateurs pas ou mal renseignés",
                    value: "Les utilisateurs n'ont pas réussi à être récupéré"
                })
            },
            roles: {
                displayExtractError: true,
                required: (args) => args.help == undefined && args.action === "blacklist" &&
                    ['add','remove'].includes(args.subAction) && args.blacklistType == 'listener' && args.users === undefined,
                type: 'roles',
                description: "Les roles à ajouter ou retirer de la blacklist",
                errorMessage: (value, args) => (value === undefined && args.users === undefined) ? {
                    name: "Au moins l'un des deux",
                    value: "Vous devez mentioner au moins un utilisateur ou un role à retirer ou à ajouter à la blacklist listener"
                } : {
                    name: "Rôle pas ou mal renseigné",
                    value: "Les rôles n'ont pas réussi à être récupéré"
                }
            },
            channels: {
                required: (args) => args.help == undefined && args.action === "blacklist" &&
                    ['add','remove'].includes(args.subAction) && args.blacklistType == "channel",
                type: 'channels',
                description: "Le ou les channels vocaux à supprimer ou ajouter",
                valid: (channels: GuildChannel[]) => !channels.some(channel => channel.type != "GUILD_VOICE"),
                errorMessage: (_) => ({
                    name: "Channels non ou mal renseigné",
                    value: "Ils ne peuvent être que des channels vocaux"
                })
            }
        }
    }

    async action(args: {help: boolean, action: string, subAction: string, blacklistType: string, users: GuildMember[], roles: Role[], channels: VoiceChannel[]}) {
        const {help, action, subAction, blacklistType, users, roles, channels} = args;

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

        let vocalConfig: typeof VocalConfig = await VocalConfig.findOne({serverId: this.message.guild.id})

        if (action == "enable" || action == "disable") {

            if (vocalConfig == null) {
                VocalConfig.create({
                    enabled: action == "enable",
                    listenerBlacklist: { users: [], roles: [] },
                    channelBlacklist: [],
                    listenableDenies: {},
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
                    if (blacklistType == "channel") {
                        vocalConfig.channelBlacklist = this.addIdsToList(vocalConfig.channelBlacklist, channels.map(channel => channel.id));
                    } else {
                        if (users)
                            vocalConfig.listenerBlacklist.users = this.addIdsToList(vocalConfig.listenerBlacklist.users, users.map(user => user.id));
                        if (roles)
                            vocalConfig.listenerBlacklist.roles = this.addIdsToList(vocalConfig.listenerBlacklist.roles, roles.map(role => role.id));
                    }
                    this.message.channel.send("Les "+(blacklistType == "channel" ? "channels" : "utilisateurs/roles")+" ont été ajouté à la blacklist '"+blacklistType+"'");
                    break;
                case 'remove':
                    if (blacklistType == "channel") {
                        vocalConfig.channelBlacklist = this.removeIdsToList(vocalConfig.channelBlacklist, channels.map(channel => channel.id))
                    } else {
                        if (users)
                            vocalConfig.listenerBlacklist.users = this.removeIdsToList(vocalConfig.listenerBlacklist.users, users.map(user => user.id));
                        if (roles)
                            vocalConfig.listenerBlacklist.roles = this.removeIdsToList(vocalConfig.listenerBlacklist.roles, roles.map(role => role.id));
                    }
                    this.message.channel.send("Les "+(blacklistType == "channel" ? "channels" : "utilisateurs")+" ont été retirés de la blacklist '"+blacklistType+"'");
                    break;
                case 'clear':
                    if (blacklistType == "channel") {
                        vocalConfig.channelBlacklist = [];
                    } else {
                        vocalConfig.listenerBlacklist.users = [];
                        vocalConfig.listenerBlacklist.roles = [];
                    }
                    this.message.channel.send("La blacklist '"+blacklistType+"' a été vidée");
                    break;
                case 'show':
                    let fields: EmbedFieldData[];
                    if (blacklistType == "channel") {
                        fields = await this.createEmbedFieldList([vocalConfig.channelBlacklist],['channel']);
                    } else {
                        fields = await this.createEmbedFieldList([vocalConfig.listenerBlacklist.users,vocalConfig.listenerBlacklist.roles],['user','role']);
                    }

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

    async createEmbedFieldList(lists, types): Promise<EmbedFieldData[]> {
        let outList: EmbedFieldData[] = [];
        if (lists.length != types.length) return outList;
        for (let i=0;i<lists.length;i++) {
            const embeds: EmbedFieldData[] = await Promise.all(lists[i].map(async (id: string) => {
                let member: GuildMember|undefined;
                let role: Role|undefined;
                let channel: GuildChannel|VoiceChannel|ThreadChannel|undefined;

                let name: string = "introuvable";
                switch (types[i]) {
                    case 'channel':
                        channel = this.message.guild?.channels.cache.get(id);
                        if (channel)
                            name = '#!'+channel.name;
                        break;
                    case 'user':
                        member = await this.message.guild?.members.fetch(id);
                        if (member)
                            name = '@'+(member.nickname??member.user.username);
                        break;
                    case 'role':
                        role = this.message.guild?.roles.cache.get(id);
                        if (role)
                            name = '@&'+role.name;
                }
                return {
                    name: name+(types.length > 1 ? " ("+types[i]+")" : ""),
                    value: "id : "+id
                };
            }));
            outList = [ ...outList, ...embeds ];
        }
        return outList.length > 0 ? outList : [{name: "Aucun élement", value: "Il n'y a aucun élement dans cette liste"}];
    }

    removeIdsToList(sourceList, listToRemove) {
        return sourceList.filter(id => !listToRemove.some(idToRemove => idToRemove == id));
    }

    addIdsToList(sourceList, listToAdd) {
        let listedIds = {};
        for (const id of sourceList)
            listedIds[id] = true;

        for (const id of listToAdd) {
            if (!listedIds[id]) {
                listedIds[id] = true;
                sourceList.push(id)
            }
        }
        return sourceList;
    }


    help(Embed: MessageEmbed) {
        Embed.addFields({
            name: "Exemples :",
            value:
                config.command_prefix+this.commandName+" enable\n"+
                config.command_prefix+this.commandName+" disable\n"+
                config.command_prefix+this.commandName+" blacklist add listener @user1,@user2 \n"+
                config.command_prefix+this.commandName+" blacklist add listener @role1,@role2 \n"+
                config.command_prefix+this.commandName+" blacklist remove listener @user1,@user2 @role1,@role2 \n"+
                config.command_prefix+this.commandName+" blacklist remove channel '#channel1, #channel2' \n"+
                config.command_prefix+this.commandName+" blacklist clear channel \n"+
                config.command_prefix+this.commandName+" blacklist show listener \n"+
                config.command_prefix+this.commandName+" -h"
        });
    }
}
