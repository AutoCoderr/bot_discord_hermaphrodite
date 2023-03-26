import {
    GuildChannel,
    GuildMember,
    Role,
    ThreadChannel,
    VoiceChannel,
    ChannelType, EmbedBuilder, EmbedField, CommandInteraction, Message
} from "discord.js";
import {splitFieldsEmbed} from "../Classes/OtherFunctions";
import TextConfig, {
    ITextConfig, 
    minimumLimit as textMinimumLimit,
    maximumLimit as textMaximumLimit,
    defaultLimit as textDefaultLimit
} from "../Models/Text/TextConfig";
import VocalConfig, {
    IVocalConfig,
    minimumLimit as vocalMinimumLimit,
    maximumLimit as vocalMaximumLimit, 
    defaultLimit as vocalDefaultLimit
} from "../Models/Vocal/VocalConfig";
import Command from "../Classes/Command";
import VocalSubscribe from "../Models/Vocal/VocalSubscribe";
import TextSubscribe from "../Models/Text/TextSubscribe";
import config from "../config";
import {extractDurationTime, showTime} from "../Classes/DateTimeManager";
import {IArgModel, IArgsModel} from "../interfaces/CommandInterfaces";

export interface IConfigTextAndVocalArgs {
    action: 'blacklist'|'enable'|'disable'|'defaultlimit',
    subAction: 'add'|'remove'|'clear'|'show',
    blacklistType: string,
    users: GuildMember[],
    roles: Role[],
    channels: VoiceChannel[],
    duration?: number
}

export default abstract class AbstractConfigTextAndVocal<IArgs = IConfigTextAndVocalArgs> extends Command<IArgs> {
    type: null | 'vocal' | 'text' = null;

    static abstract = true;

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static types = {
        vocal: {
            configModel: VocalConfig,
            subscribeModel: VocalSubscribe,
            channelTypes: [ChannelType.GuildVoice],
            minimumLimit: vocalMinimumLimit,
            maximumLimit: vocalMaximumLimit,
            defaultLimit: vocalDefaultLimit
        },
        text: {
            configModel: TextConfig,
            subscribeModel: TextSubscribe,
            channelTypes: [ChannelType.GuildText,ChannelType.GuildPublicThread],
            minimumLimit: textMinimumLimit,
            maximumLimit: textMaximumLimit,
            defaultLimit: textDefaultLimit
        }
    }

    protected constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash' | 'custom', commandName: string, argsModel: any, type: 'vocal' | 'text') {
        super(messageOrInteraction, commandOrigin, commandName, argsModel);
        this.type = type;
    }

    static argsModelFunction: <IArgs = IConfigTextAndVocalArgs>(
        type: 'vocal'|'text', 
        fieldsUpdaters?: {[key: string]: ((argModel: IArgModel<IArgs>) => IArgModel<IArgs>)},
        additionnalFields?: IArgsModel<IArgs>['$argsByType']
    ) => IArgsModel<IArgs> = 
    (type, fieldsUpdaters = {}, additionnalFields = {}) => ({
        $argsByType: {
            ...Object.entries({
                action: {
                    isSubCommand: true,
                    required: true,
                    type: "string",
                    description: "L'action à effectuer : blacklist, enable, disable, defaultLimit",
                    choices: {
                        blacklist: "Gérer la blacklist",
                        enable: "Activer l'écoute " + (type === "vocal" ? "vocale" : "textuelle") + " du serveur",
                        disable: "Désactiver l'écoute " + (type === "vocal" ? "vocale" : "textuelle") + " du serveur",
                        defaultlimit: "Définir ou voir la limite par défaut des écoutes " + (type === 'vocal' ? "vocales" : "textuelles")
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
                    choices: {
                        listener: "Listener",
                        channel: "Channel"
                    },
                    description: "Le type de blacklist: listener, channel"
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
                        ['add', 'remove'].includes(<string>args.subAction) && args.blacklistType == 'listener' && (args.users??[]).length == 0,
                    type: 'role',
                    multi: true,
                    description: "Les roles à ajouter ou retirer de la blacklist",
                    errorMessage: (value, args) => (value === undefined && (args.users??[]).length == 0) ? {
                        name: "Au moins l'un des deux",
                        value: "Vous devez mentioner au moins un utilisateur ou un role à retirer ou à ajouter à la blacklist listener"
                    } : {
                        name: "Rôle pas ou mal renseigné",
                        value: "Les rôles n'ont pas réussi à être récupéré"
                    }
                },
                channels: {
                    referToSubCommands: ['blacklist.add', 'blacklist.remove'],
                    required: (args) => ['add', 'remove'].includes(<string>args.subAction) && args.blacklistType == "channel",
                    type: 'channel',
                    multi: true,
                    displayValidErrorEvenIfFound: true,
                    description: "Le ou les channels vocaux à supprimer ou ajouter",
                    valid: (channels: GuildChannel[] | GuildChannel) =>
                        (channels instanceof Array && !channels.some(channel => !AbstractConfigTextAndVocal.types[type].channelTypes.includes(channel.type))) ||
                        (channels instanceof GuildChannel && AbstractConfigTextAndVocal.types[type].channelTypes.includes(channels.type)),
                    errorMessage: (_) => ({
                        name: "Channels non ou mal renseigné",
                        value: "Ils ne peuvent être que des channels " + (type === "vocal" ? "vocaux" : "textuels")
                    })
                },
                duration: {
                    referToSubCommands: ['defaultlimit'],
                    required: false,
                    type: 'duration',
                    description: "Re définir la limite par défaut (30s, 2h, 2j)",
                    valid: (value: number, args) =>  (
                        args.action === "defaultlimit" && 
                        value >= AbstractConfigTextAndVocal.types[type].minimumLimit && 
                        value <= AbstractConfigTextAndVocal.types[type].maximumLimit
                    ),
                    errorMessage: (value) => ({
                        name: "Vous avez mal rentrez la durée",
                        value: typeof (value) === "number" ?
                                "La limite par défaut doit être située entre "+
                                    ['minimumLimit','maximumLimit'].map(field =>
                                        showTime(extractDurationTime(AbstractConfigTextAndVocal.types[type][field]), 'fr_long')    
                                    ).join(" et ")+" inclus." :
                                "Syntaxe incorrecte"
                    })
                },
                ...additionnalFields
            }).reduce((acc,[field,argModel]) => ({
                ...acc,
                [field]: fieldsUpdaters[field] !== undefined ? fieldsUpdaters[field](<IArgModel>argModel) : argModel
            }), {})
        }
    })
    
    lresponse(...args: Parameters<Command['response']>): {executed: true, configObj: null, response: ReturnType<Command['response']>} {
        return {
            executed: true,
            response: super.response(...args),
            configObj: null
        }
    }

    async mutualizedAction(
        args: IArgs, 
        checkIfEnabled: null|((args: IArgs, configObj: IVocalConfig|ITextConfig) => boolean) = null
    ): Promise<{executed: boolean, configObj: null|IVocalConfig|ITextConfig, response: null|ReturnType<Command['response']>}> {
        const {action, subAction, blacklistType, users, roles, channels, duration} = <IConfigTextAndVocalArgs><unknown>args;

        if (this.type === null || AbstractConfigTextAndVocal.types[this.type] === undefined)
            return this.lresponse(false,
                this.sendErrors({
                    name: "Bad type",
                    value: "Type vocal or text not specified"
                })
            );

        const {configModel, subscribeModel, defaultLimit} = AbstractConfigTextAndVocal.types[this.type];

        if (this.guild == null)
            return this.lresponse(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );

        let configObj = await <Promise<IVocalConfig|ITextConfig>>configModel.findOne({serverId: this.guild.id})

        if (action == "enable" || action == "disable") {
            if (configObj == null) {
                configModel.create({
                    enabled: action === "enable",
                    listenerBlacklist: {users: [], roles: []},
                    channelBlacklist: [],
                    serverId: this.guild.id
                })
            } else {
                configObj.enabled = action === "enable";
                await configObj.save();
            }
            return this.lresponse(true, "L'abonnement " + (this.type === "vocal" ? "vocal" : "textuel") + " a été " + (action == "enable" ? "activé" : "désactivé") + " sur ce serveur");

        }

        // if action is 'blacklist' or 'defaultlimit'
        if (
            (checkIfEnabled !== null && checkIfEnabled(args, configObj)) || 
            (checkIfEnabled === null && (configObj == null || !configObj.enabled))
        )
            return this.lresponse(false,
                this.sendErrors({
                    name: (this.type === "vocal" ? "Vocal" : "Textuel") + " désactivé",
                    value: "Vous devez d'abord activer l'abonnement " + (this.type === "vocal" ? "vocal" : "textuel") + " sur ce serveur avec : \n" + config.command_prefix + this.commandName + " enable"
                })
            );

        if (action === "defaultlimit") {
            if (duration !== undefined) {
                configObj.defaultLimit = duration;
                await configObj.save();
                return this.lresponse(true, {
                    embeds: [
                        new EmbedBuilder().addFields({
                            name: "Valeur changée avec succès!",
                            value: "Vous avez fixé la limite par défaut de l'écoute " +(this.type === "vocal" ? "vocale" : "textuelle") + " à " + showTime(extractDurationTime(duration), "fr_long")
                        })
                    ]
                })
            }
            return this.lresponse(true, {
                embeds: [
                    new EmbedBuilder().addFields({
                        name: "Voici la limite par défaut de l'écoute " +(this.type === "vocal" ? "vocale" : "textuelle"),
                        value: "La limite par défaut est : " +showTime(extractDurationTime(configObj.defaultLimit ?? defaultLimit), "fr_long")
                    })
                ]
            })
        }

        // If action is blacklist
        switch (subAction) {
            case 'add':
                const notFoundUserId: string[] = [];
                const subscribes: Array<typeof subscribeModel> = await subscribeModel.find({
                    serverId: this.guild.id
                });
                if (blacklistType === "channel") {
                    configObj.channelBlacklist = this.addIdsToList(configObj.channelBlacklist, channels.map(channel => channel.id));
                } else {
                    if (users)
                        configObj.listenerBlacklist.users = this.addIdsToList(configObj.listenerBlacklist.users, users.map(user => user.id));
                    if (roles)
                        configObj.listenerBlacklist.roles = this.addIdsToList(configObj.listenerBlacklist.roles, roles.map(role => role.id));
                }
                for (const subscribe of subscribes) {
                    if (blacklistType === "channel") {
                        if (this.type === "text" && channels.some(channel => channel.id === subscribe.channelId))
                            subscribe.remove();
                        continue;
                    }

                    if (users !== undefined && users.some(user => user.id === subscribe.listenerId || user.id === subscribe.listenedId)) {
                        subscribe.remove();
                        continue;
                    }

                    let listener: null | GuildMember = null;
                    try {
                        listener = await this.guild.members.fetch(subscribe.listenerId);
                    } catch (e) {
                        notFoundUserId.push(subscribe.listenerId);
                    }
                    let listened: null | GuildMember = null;
                    try {
                        listened = await this.guild.members.fetch(subscribe.listenedId);
                    } catch (e) {
                        notFoundUserId.push(subscribe.listenedId);
                    }
                    if (listener === null || listened === null ||
                        (roles !== undefined && (
                            listener.roles.cache.some(roleA => roles.some(roleB => roleA.id === roleB.id)) ||
                            listened.roles.cache.some(roleA => roles.some(roleB => roleA.id === roleB.id))
                        ))) {
                        subscribe.remove();
                    }
                }
                let msg = "Les " + (blacklistType == "channel" ? "channels" : "utilisateurs/roles") + " ont été ajouté à la blacklist '" + blacklistType + "'"
                if (notFoundUserId.length > 0) {
                    msg += "\n" + notFoundUserId.map(id => "L'utilisateur avec l'id " + id + " est introuvable, son écoute a été supprimée").join("\n")
                }
                configObj.save();
                return this.lresponse(true, msg);
            case 'remove':
                if (blacklistType == "channel") {
                    configObj.channelBlacklist = this.removeIdsToList(configObj.channelBlacklist, channels.map(channel => channel.id))
                } else {
                    if (users)
                        configObj.listenerBlacklist.users = this.removeIdsToList(configObj.listenerBlacklist.users, users.map(user => user.id));
                    if (roles)
                        configObj.listenerBlacklist.roles = this.removeIdsToList(configObj.listenerBlacklist.roles, roles.map(role => role.id));
                }
                configObj.save();
                return this.lresponse(true,
                    "Les " + (blacklistType == "channel" ? "channels" : "utilisateurs/roles") + " ont été retirés de la blacklist '" + blacklistType + "'"
                );
            case 'clear':
                if (blacklistType == "channel") {
                    configObj.channelBlacklist = [];
                } else {
                    configObj.listenerBlacklist.users = [];
                    configObj.listenerBlacklist.roles = [];
                }
                configObj.save();
                return this.lresponse(true, "La blacklist '" + blacklistType + "' a été vidée");
            case 'show':
                let fields: EmbedField[];
                if (blacklistType == "channel") {
                    fields = await this.createEmbedFieldList([configObj.channelBlacklist], ['channel']);
                } else {
                    fields = await this.createEmbedFieldList([configObj.listenerBlacklist.users, configObj.listenerBlacklist.roles], ['user', 'role']);
                }

                configObj.save();

                const embeds = splitFieldsEmbed(25, fields, (embed: EmbedBuilder, nbPart) => {
                    if (nbPart == 1) {
                        embed.setTitle("Contenu de la blacklist '" + blacklistType + "'");
                    }
                });
                return this.lresponse(true, {embeds});
        }

        return {executed: false, configObj, response: null};
    }

    async createEmbedFieldList(lists, types): Promise<EmbedField[]> {
        let outList: EmbedField[] = [];
        if (lists.length != types.length) return outList;
        for (let i = 0; i < lists.length; i++) {
            const embeds: EmbedField[] = await Promise.all(lists[i].map(async (id: string, j: number) => {
                let member: GuildMember | undefined;
                let role: Role | undefined;
                let channel: GuildChannel | VoiceChannel | ThreadChannel | undefined;

                let found = false;
                let name: string = "introuvable";
                let value: string = "id: " + id;
                if (this.guild) {
                    switch (types[i]) {
                        case 'channel':
                            channel = this.guild.channels.cache.get(id);
                            if (channel) {
                                found = true;
                                name = '#!' + channel.name;
                                value = "<#" + channel.id + ">";
                            }
                            break;
                        case 'user':
                            member = await this.guild?.members.fetch(id);
                            if (member) {
                                found = true;
                                name = '@' + (member.nickname ?? member.user.username);
                                value = "<@" + member.id + ">";
                            }
                            break;
                        case 'role':
                            role = this.guild?.roles.cache.get(id);
                            if (role) {
                                found = true;
                                name = '@&' + role.name;
                                value = "<@&" + role.id + ">";
                            }
                    }
                }
                if (!found)
                    lists[i].splice(j, 1);

                return {
                    name: name + (types.length > 1 ? " (" + types[i] + ")" : ""),
                    value: value
                };
            }));
            outList = [...outList, ...embeds];
        }
        return outList.length > 0 ? outList : [{
            inline: false,
            name: "Aucun élement",
            value: "Il n'y a aucun élement dans cette liste"
        }];
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
        return new EmbedBuilder()
            .setTitle("Exemples :")
            .addFields(<any>[
                {
                    name: "enable",
                    value: "Activer les écoutes " + (this.type === "vocal" ? "vocales" : "textuelles") + " sur ce serveur"
                },
                {
                    name: "disable",
                    value: "Déactiver les écoutes " + (this.type === "vocal" ? "vocales" : "textuelles") + " sur ce serveur"
                },
                {
                    name: "blacklist add listener @user1,@user2",
                    value: "Ajouter @user1 et @user2 dans la blacklist des listeners (ils n'auront plus le droit d'utiliser l'écoute " + (this.type === "vocal" ? "vocales" : "textuelles") + ")"
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
