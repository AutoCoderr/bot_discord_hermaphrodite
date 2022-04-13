import Command from "../Classes/Command";
import {
    CommandInteractionOptionResolver,
    EmbedFieldData, Guild,
    GuildChannel,
    GuildMember,
    MessageEmbed, Role, TextBasedChannels,
    User, VoiceChannel
} from "discord.js";
import TextConfig from "../Models/Text/TextConfig";
import {splitFieldsEmbed, createEmbedFieldList, removeIdsToList, addIdsToList} from "../Classes/OtherFunctions";
import config from "../config";
import TextSubscribe, {ITextSubscribe} from "../Models/Text/TextSubscribe";

export default class ConfigText extends Command {
    static display = true;
    static description = "Pour configurer l'option d'abonnement textuel";
    static commandName = "configText";

    static slashCommand = true;

    static argsModel = {
        $argsByType: {
            action: {
                isSubCommand: true,
                required: true,
                type: "string",
                description: "L'action à effectuer : blacklist, enable, disable",
                choices: {
                    blacklist: "Gérer la blacklist",
                    enable: "Activer l'écoute vocale du serveur",
                    disable: "Désactiver l'écoute vocal du serveur"
                }
            },
            subAction: {
                referToSubCommands: ['blacklist'],
                isSubCommand: true,
                required: (args) => args.action === "blacklist",
                type: "string",
                description: "L'action à effectuer sur la blacklist: add, remove, clear, show",
                choices: {
                    add: "Ajouter un utilisateur / rôle / channel à la blacklist",
                    remove: "Retirer un utilisateur / rôle / channel de la blacklist",
                    clear: "Vider la blacklist",
                    show: "Afficher la blacklist",
                }
            },
            blacklistType: {
                referToSubCommands: ['blacklist.add', 'blacklist.remove', 'blacklist.clear', 'blacklist.show'],
                required: (args) => args.action === "blacklist",
                type: "string",
                description: "Le type de blacklist: listener, channel",
                valid: field => ['listener', 'channel'].includes(field)
            },
            users: {
                referToSubCommands: ['blacklist.add', 'blacklist.remove'],
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
                referToSubCommands: ['blacklist.add', 'blacklist.remove'],
                displayExtractError: true,
                required: (args, _, modelizeSlashCommand = false) => !modelizeSlashCommand && args.action === "blacklist" &&
                    ['add', 'remove'].includes(args.subAction) && args.blacklistType == 'listener' && args.users.length == 0,
                type: 'role',
                multi: true,
                description: "Les roles à ajouter ou retirer de la blacklist",
                errorMessage: (value, args) => (value === undefined && args.users.length == 0) ? {
                    name: "Au moins l'un des deux",
                    value: "Vous devez mentioner au moins un utilisateur ou un role à retirer ou à ajouter à la blacklist listener"
                } : {
                    name: "Rôle pas ou mal renseigné",
                    value: "Les rôles n'ont pas réussi à être récupéré"
                }
            },
            channels: {
                referToSubCommands: ['blacklist.add', 'blacklist.remove'],
                required: (args) => ['add', 'remove'].includes(args.subAction) && args.blacklistType == "channel",
                type: 'channel',
                multi: true,
                displayValidErrorEvenIfFound: true,
                description: "Le ou les channels vocaux à supprimer ou ajouter",
                valid: (channels: GuildChannel[] | GuildChannel) =>
                    (channels instanceof Array && !channels.some(channel => channel.type != "GUILD_TEXT")) ||
                    (channels instanceof GuildChannel && channels.type == "GUILD_TEXT"),
                errorMessage: (_) => ({
                    name: "Channels non ou mal renseigné",
                    value: "Ils ne peuvent être que des channels textuels"
                })
            }
        }
    }

    constructor(channel: TextBasedChannels, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: string) {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, ConfigText.commandName, ConfigText.argsModel);
    }

    async action(args: { action: string, subAction: string, blacklistType: string, users: GuildMember[], roles: Role[], channels: VoiceChannel[] }) {
        const {action, subAction, blacklistType, users, roles, channels} = args;

        if (this.guild == null)
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );

        let textConfig: typeof TextConfig = await TextConfig.findOne({serverId: this.guild.id})

        if (action == "enable" || action == "disable") {
            if (textConfig == null) {
                TextConfig.create({
                    enabled: action === "enable",
                    listenerBlacklist: {users: [], roles: []},
                    channelBlacklist: [],
                    serverId: this.guild.id
                })
            } else {
                textConfig.enabled = action === "enable";
                textConfig.save();
            }
            return this.response(true, "L'abonnement textuel a été " + (action == "enable" ? "activé" : "désactivé") + " sur ce serveur");

        } else { // if action is 'blacklist'
            if (textConfig == null || !textConfig.enabled)
                return this.response(false,
                    this.sendErrors({
                        name: "Textuel désactivé",
                        value: "Vous devez d'abord activer l'abonnement textuel sur ce serveur avec : \n" + config.command_prefix + this.commandName + " enable"
                    })
                );
            switch (subAction) {
                case 'add':
                    const notFoundUserId: string[] = [];
                    const textSubscribes: Array<ITextSubscribe | typeof TextSubscribe> = await TextSubscribe.find({
                        serverId: this.guild.id
                    });
                    if (blacklistType === "channel") {
                        textConfig.channelBlacklist = addIdsToList(textConfig.channelBlacklist, channels.map(channel => channel.id));
                    } else {
                        if (users)
                            textConfig.listenerBlacklist.users = addIdsToList(textConfig.listenerBlacklist.users, users.map(user => user.id));
                        if (roles)
                            textConfig.listenerBlacklist.roles = addIdsToList(textConfig.listenerBlacklist.roles, roles.map(role => role.id));
                    }
                    for (const textSubscribe of textSubscribes) {
                        if (blacklistType === "channel") {
                            if (channels.some(channel => channel.id === textSubscribe.channelId))
                                textSubscribe.remove();
                            continue;
                        }

                        if (users !== undefined && users.some(user => user.id === textSubscribe.listenerId)) {
                            textSubscribe.remove();
                            continue;
                        }

                        let member: null | GuildMember = null;
                        try {
                            member = await this.guild.members.fetch(textSubscribe.listenerId);
                        } catch (e) {
                            notFoundUserId.push(textSubscribe.listenerId);
                        }
                        if (member === null || (roles !== undefined && member.roles.cache.some(roleA => roles.some(roleB => roleA.id === roleB.id)))) {
                            textSubscribe.remove();
                        }
                    }
                    let msg = "Les " + (blacklistType == "channel" ? "channels" : "utilisateurs/roles") + " ont été ajouté à la blacklist '" + blacklistType + "'"
                    if (notFoundUserId.length > 0) {
                        msg += "\n" + notFoundUserId.map(id => "L'utilisateur avec l'id " + id + " est introuvable, son écoute a été supprimée").join("\n")
                    }
                    textConfig.save();
                    return this.response(true, msg);
                case 'remove':
                    if (blacklistType == "channel") {
                        textConfig.channelBlacklist = removeIdsToList(textConfig.channelBlacklist, channels.map(channel => channel.id))
                    } else {
                        if (users)
                            textConfig.listenerBlacklist.users = removeIdsToList(textConfig.listenerBlacklist.users, users.map(user => user.id));
                        if (roles)
                            textConfig.listenerBlacklist.roles = removeIdsToList(textConfig.listenerBlacklist.roles, roles.map(role => role.id));
                    }
                    textConfig.save();
                    return this.response(true,
                        "Les " + (blacklistType == "channel" ? "channels" : "utilisateurs/roles") + " ont été retirés de la blacklist '" + blacklistType + "'"
                    );
                case 'clear':
                    if (blacklistType == "channel") {
                        textConfig.channelBlacklist = [];
                    } else {
                        textConfig.listenerBlacklist.users = [];
                        textConfig.listenerBlacklist.roles = [];
                    }
                    textConfig.save();
                    return this.response(true, "La blacklist '" + blacklistType + "' a été vidée");
                case 'show':
                    let fields: EmbedFieldData[];
                    if (blacklistType == "channel") {
                        fields = await createEmbedFieldList([textConfig.channelBlacklist], ['channel'], this.guild);
                    } else {
                        fields = await createEmbedFieldList([textConfig.listenerBlacklist.users, textConfig.listenerBlacklist.roles], ['user', 'role'], this.guild);
                    }

                    const embeds = splitFieldsEmbed(25, fields, (embed: MessageEmbed, nbPart) => {
                        if (nbPart == 1) {
                            embed.setTitle("Contenu de la blacklist '" + blacklistType + "'");
                        }
                    });
                    return this.response(true, {embeds});
            }
        }
        return this.response(false, "Aucune action spécifiée");
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "enable",
                    value: "Activer les écoutes textuelles sur ce serveur"
                },
                {
                    name: "disable",
                    value: "Déactiver les écoutes textuelles sur ce serveur"
                },
                {
                    name: "blacklist add listener @user1,@user2",
                    value: "Ajouter @user1 et @user2 dans la blacklist des listeners (ils n'auront plus le droit d'utiliser l'écoute textuelles)"
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
                name: config.command_prefix + this.commandName + " " + field.name,
                value: field.value
            })));
    }
}
