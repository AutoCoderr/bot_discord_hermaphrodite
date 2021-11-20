import Command from "../Classes/Command";
import {
    EmbedFieldData, Guild,
    GuildChannel,
    GuildMember,
    MessageEmbed, Role, TextBasedChannels,
    ThreadChannel, User,
    VoiceChannel
} from "discord.js";
import VocalConfig from "../Models/VocalConfig";
import {splitFieldsEmbed} from "../Classes/OtherFunctions";
import config from "../config";
import VocalSubscribe, {IVocalSubscribe} from "../Models/VocalSubscribe";

export default class ConfigVocal extends Command {
    static display = true;
    static description = "Pour s'abonner un ou plusieurs utilisateurs et un ou plusieurs channels vocaux, afin de recevoir un MP à chaque connexion ou déconnexion au vocal";
    static commandName = "configVocal";

    static argsModel = {
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
                type: "user",
                multi: true,
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
                type: 'role',
                multi: true,
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
                type: 'channel',
                multi: true,
                displayValidErrorEvenIfFound: true,
                description: "Le ou les channels vocaux à supprimer ou ajouter",
                valid: (channel: GuildChannel) => channel.type === "GUILD_VOICE",
                errorMessage: (_) => ({
                    name: "Channels non ou mal renseigné",
                    value: "Ils ne peuvent être que des channels vocaux"
                })
            }
        }
    }

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommand: null|string = null) {
        super(channel, member, guild, writtenCommand, ConfigVocal.commandName, ConfigVocal.argsModel);
    }

    async action(args: {help: boolean, action: string, subAction: string, blacklistType: string, users: GuildMember[], roles: Role[], channels: VoiceChannel[]}) {
        const {help, action, subAction, blacklistType, users, roles, channels} = args;

        if (help)
            return this.response(false, this.displayHelp());

        if (this.guild == null)
            return this.response(false,
                this.sendErrors( {
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );

        let vocalConfig: typeof VocalConfig = await VocalConfig.findOne({serverId: this.guild.id})

        if (action == "enable" || action == "disable") {
            if (vocalConfig == null) {
                VocalConfig.create({
                    enabled: action == "enable",
                    listenerBlacklist: { users: [], roles: [] },
                    channelBlacklist: [],
                    listenableDenies: {},
                    userMutes: {},
                    serverId: this.guild.id
                })
            } else {
                vocalConfig.enabled = action == "enable";
                vocalConfig.save();
            }
            return this.response(true, "L'abonnement vocal a été "+(action == "enable" ? "activé" : "désactivé")+" sur ce serveur");

        } else { // if action is 'blacklist'
            if (vocalConfig == null || !vocalConfig.enabled)
                return this.response(false,
                    this.sendErrors( {
                        name: "Vocal désactivé",
                        value: "Vous devez d'abord activer l'abonnement vocal sur ce serveur avec : \n"+config.command_prefix+this.commandName+" enable"
                    })
                );
            switch (subAction) {
                case 'add':
                    const notFoundUserId: string[] = [];
                    if (blacklistType == "channel") {
                        vocalConfig.channelBlacklist = this.addIdsToList(vocalConfig.channelBlacklist, channels.map(channel => channel.id));
                    } else {
                        if (users)
                            vocalConfig.listenerBlacklist.users = this.addIdsToList(vocalConfig.listenerBlacklist.users, users.map(user => user.id));
                        if (roles)
                            vocalConfig.listenerBlacklist.roles = this.addIdsToList(vocalConfig.listenerBlacklist.roles, roles.map(role => role.id));
                        const vocalSubscribes: Array<IVocalSubscribe|typeof VocalSubscribe> = await VocalSubscribe.find({
                            serverId: this.guild.id
                        });
                        for (const vocalSubscribe of vocalSubscribes) {
                            if (users !== undefined && users.some(user => user.id === vocalSubscribe.listenerId)) {
                                vocalSubscribe.remove();
                                continue;
                            }

                            let member: null|GuildMember = null;
                            try {
                                member = await this.guild.members.fetch(vocalSubscribe.listenerId);
                            } catch (e) {
                                notFoundUserId.push(vocalSubscribe.listenerId);
                            }
                            if (member === null || (roles !== undefined && member.roles.cache.some(roleA => roles.some(roleB => roleA.id === roleB.id)))) {
                                vocalSubscribe.remove();
                            }
                        }
                    }
                    let msg = "Les "+(blacklistType == "channel" ? "channels" : "utilisateurs/roles")+" ont été ajouté à la blacklist '"+blacklistType+"'"
                    if (notFoundUserId.length > 0) {
                        msg += "\n" + notFoundUserId.map(id => "L'utilisateur avec l'id " + id + " est introuvable, son écoute a été supprimée").join("\n")
                    }
                    return this.response(true, msg);
                case 'remove':
                    if (blacklistType == "channel") {
                        vocalConfig.channelBlacklist = this.removeIdsToList(vocalConfig.channelBlacklist, channels.map(channel => channel.id))
                    } else {
                        if (users)
                            vocalConfig.listenerBlacklist.users = this.removeIdsToList(vocalConfig.listenerBlacklist.users, users.map(user => user.id));
                        if (roles)
                            vocalConfig.listenerBlacklist.roles = this.removeIdsToList(vocalConfig.listenerBlacklist.roles, roles.map(role => role.id));
                    }
                    return this.response(true,
                        "Les "+(blacklistType == "channel" ? "channels" : "utilisateurs/roles")+" ont été retirés de la blacklist '"+blacklistType+"'"
                    );
                case 'clear':
                    if (blacklistType == "channel") {
                        vocalConfig.channelBlacklist = [];
                    } else {
                        vocalConfig.listenerBlacklist.users = [];
                        vocalConfig.listenerBlacklist.roles = [];
                    }
                    return this.response(true, "La blacklist '"+blacklistType+"' a été vidée");
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
                    return this.response(true, {embeds});
            }
            if (subAction != 'show')
                vocalConfig.save();
        }
        return this.response(false, "Aucune action spécifiée");
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
                        channel = this.guild?.channels.cache.get(id);
                        if (channel)
                            name = '#!'+channel.name;
                        break;
                    case 'user':
                        member = await this.guild?.members.fetch(id);
                        if (member)
                            name = '@'+(member.nickname??member.user.username);
                        break;
                    case 'role':
                        role = this.guild?.roles.cache.get(id);
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


    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "enable",
                    value: "Activer les écoutes vocales sur ce serveur"
                },
                {
                    name: "disable",
                    value: "Déactiver les écoutes vocales sur ce serveur"
                },
                {
                    name: "blacklist add listener @user1,@user2",
                    value: "Ajouter @user1 et @user2 dans la blacklist des listeners (ils n'auront plus le droit d'utiliser l'écoute vocale)"
                },
                {
                    name: "blacklist add listener @role1,@role2",
                    value: "Ajouter @&role1 et @&role2 dans la blacklist des listeners"
                },
                {
                    name: "blacklist remove listener @user1,@user2 @role1,@role2",
                    value: "Retirer @user1, @user2, @&role1 et @&role2 de la blacklist des listeners"
                },
                {
                    name: "blacklist remove channel '#channel1, #channel2'",
                    value: "Retirer #channel1 et #channel2 de la backlist channels (Les channels présents dans cette liste ne peuvent pas être écoutés)"
                },
                {
                    name: "blacklist clear channel",
                    value: "Vider la blacklist channel"
                },
                {
                    name: "blacklist show listener",
                    value: "Afficher la blacklist listener"
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
