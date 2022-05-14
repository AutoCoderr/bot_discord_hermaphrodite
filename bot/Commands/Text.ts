import Command, {responseType} from "../Classes/Command";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildChannel,
    GuildMember, Message, MessageActionRow, MessageButton,
    MessageEmbed,
    TextChannel,
    User
} from "discord.js";
import config from "../config";
import TextConfig, {ITextConfig} from "../Models/Text/TextConfig";
import TextUserConfig, {ITextUserConfig,minimumLimit} from "../Models/Text/TextUserConfig";
import TextSubscribe, {ITextSubscribe} from "../Models/Text/TextSubscribe";
import TextInvite from "../Models/Text/TextInvite";
import {
    compareKeyWords, reEnableTextSubscribesAfterUnblock,
    reEnableTextSubscribesAfterUnmute,
    removeKeyWords,
    userBlockingUsOrChannelText,
    findWordInText
} from "../Classes/TextAndVocalFunctions";
import {extractDate, extractTime, extractUTCTime, showDate, showTime} from "../Classes/DateTimeManager";

interface argsType {
    action: 'add' | 'remove' | 'block' | 'unblock' | 'mute' | 'unmute' | 'limit' | 'status',
    users: GuildMember[],
    channels: TextChannel[],
    keyWords: string[],
    time?: number,
    subs?: boolean
}

interface aggregatedListening {
    channelId?: string;
    keywords?: string[];
    timestamp: Date;
    enabled: boolean
}

interface aggregatedSubscribes extends Array<{_id: string, listens: Array<aggregatedListening> }> {}

export default class Text extends Command {
    static display = true;
    static description = "Pour recevoir des notifications lorsque les personnes abonnées parlent sur un channel textuel";
    static commandName = "text";

    static customCommand = false;
    static slashCommand = true;

    static argsModel = {
        $argsByType: {
            action: {
                isSubCommand: true,
                required: true,
                type: "string",
                description: "L'action à effectuer : add, remove, block, unblock, mute, unmute, limit, status",
                choices: {
                    add: "Envoyer une ou plusieurs demandes d'écoute ou redéfinir leurs mots clés",
                    remove: "Supprimer une ou plusieurs écoute en cours, ou supprimer des mots clés",
                    block: "Bloquer un/des utilisateurs et/ou un/des channels pour les empêcher de vous écouter",
                    unblock: "Débloquer un/des utilisateurs et/ou un/des channels",
                    mute: "Bloquer les notifications pendant un certain temps (exemple de temps: 30s, 5min, 3j) ou indéfiniment",
                    unmute: "Se démuter",
                    limit: "Avoir un répit entre chaque notification (exemple de temps: 30s, 5min, 3j)",
                    status: "Voir ses infos"
                }
            },
            users: {
                referToSubCommands: ['add', 'remove', 'block', 'unblock'],
                required: false,
                displayValidError: true,
                displayValidErrorEvenIfFound: true,
                displayExtractError: true,
                type: 'user',
                multi: true,
                description: "Le ou les users à écouter, ignorer ou bloquer",
                valid: (users: GuildMember | GuildMember[], args, command: Command) => {
                    if (users instanceof GuildMember && (users.id === command.member.id || args.users.some(eachUser => eachUser.id === users.id)))
                        return false;
                    if (users instanceof Array) {
                        let alreadySpecifieds = {};
                        for (const user of users) {
                            if (user.id === command.member.id || alreadySpecifieds[user.id])
                                return false;
                            else
                                alreadySpecifieds[user.id] = true;
                        }
                    }
                    return true;
                },
                errorMessage: () => ({
                    name: "Utilisateurs non ou mal renseigné",
                    value: "Vous n'avez pas ou mal renseigné les utilisateurs.\n" +
                        "Vous ne pouvez pas vous renseignez vous même, ni renseigner plusieurs fois les mêmes personnes"
                })
            },
            channels: {
                referToSubCommands: ['add', 'remove', 'block', 'unblock'],
                required: (args, _, modelize = false) => !modelize && ['add', 'remove', 'block', 'unblock'].includes(args.action) && (args.users === undefined || args.users.length === 0),
                displayValidError: true,
                displayValidErrorEvenIfFound: true,
                displayExtractError: true,
                type: 'channel',
                multi: true,
                description: "Le ou les channels à écouter, ignorer ou bloquer",
                valid: (channels: GuildChannel | GuildChannel[], args) => {
                    if (channels instanceof GuildChannel && (channels.type !== 'GUILD_TEXT' || args.channels.some(eachChannel => eachChannel.id === channels.id)))
                        return false;
                    if (channels instanceof Array) {
                        let alreadySpecifieds = {};
                        for (const channel of channels) {
                            if (channel.type !== 'GUILD_TEXT' || alreadySpecifieds[channel.id])
                                return false;
                            else
                                alreadySpecifieds[channel.id] = true;
                        }
                    }
                    return true;
                },
                errorMessage: (value, args) => (value === undefined && (args.users === undefined || args.users.length === 0)) ?
                    {
                        name: "Rentrez au moins l'un des deux",
                        value: "Vous devez avoir mentionné au moins un utilisateur ou un channel"
                    } : {
                        name: "Channels non ou mal renseignés",
                        value: "Vous n'avez pas ou mal renseigné les channels.\n" +
                            "Vous ne pouvez renseigner que des channels textuels, et vous ne pouvez pas renseigner plusieurs fois le même channel"
                    }
            },
            keyWords: {
                referToSubCommands: ['add', 'remove'],
                required: false,
                type: 'string',
                multi: true,
                description: "Le ou les mots clé à définir, retirer, ou ajoiter"
            },
            time: {
                referToSubCommands: ['limit', 'mute'],
                required: (args) => args.action === 'limit',
                type: "duration",
                description: "Le temps durant lequel on souhaite ne pas recevoir de notif (ex: 30s, 5m, 3h, 2j)",
                valid: (time, args) => args.action === 'limit' || time > 0
            },
            subs: {
                referToSubCommands: ['status'],
                required: false,
                type: "boolean",
                description: "Obtenir plus de détails concernant les écoutes : subs"
            }
        }
    };

    static buttonsTimeout = 48 * 60 * 60 * 1000; // 48h pour répondre à une invitation

    blockedChannelsByUserId: { [userId: string]: string[] } = {};
    blockedChannelsForEveryoneObj: { [channelId: string]: boolean } = {};
    usersBlockingMe: string[] = [];
    hasNotText: string[] = [];
    invites: Array<{ requested: GuildMember, channels?: TextChannel[] }> = [];
    alreadyInvited: Array<{ requested: GuildMember, channelsId?: string[], keywords: string[] }> = [];

    updatedSubscribes: Array<{ listenedId: string, channelId?: string }> = [];
    deletedSubscribes: Array<{ listenedId: string, channelId?: string, subscribeAllChannelsExists?: boolean }> = [];
    cantBeDeleteBecauseOfOnlySubscribeAll: Array<{ listenedId: string, channelId: string }> = [];

    blockeds: Array<{ userId?: string, channelId?: string }> = [];
    alreadyBlockeds: Array<{ userId?: string, channelId?: string }> = [];

    unblockeds: Array<{ userId?: string, channelId?: string }> = [];

    constructor(channel: TextChannel, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: 'slash' | 'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, Text.commandName, Text.argsModel);
    }

    async action(args: argsType) {
        const {action, users, channels, keyWords, time, subs} = args;

        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        const textConfig: ITextConfig = await TextConfig.findOne({serverId: this.guild.id, enabled: true});

        if (textConfig === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Textuel désactivé",
                    value: "Vous ne pouvez pas executer cette commande car l'option d'abonnement textuel n'est pas activée sur ce serveur"
                })
            );
        }

        if ((textConfig.listenerBlacklist.users.includes(this.member.id) ||
            textConfig.listenerBlacklist.roles.some(roleId => this.member instanceof GuildMember && this.member.roles.cache.some(role => role.id === roleId)))) {
            return this.response(false,
                this.sendErrors({
                    name: "Accès interdit",
                    value: "Vous n'avez visiblement pas le droit d'utiliser l'option d'abonnement textuel sur ce serveur"
                })
            );
        }

        let ownUserConfig: ITextUserConfig | typeof TextUserConfig = await TextUserConfig.findOne({
            serverId: this.guild.id,
            userId: this.member.id
        });

        if (ownUserConfig === null) {
            ownUserConfig = await TextUserConfig.create({
                serverId: this.guild.id,
                userId: this.member.id
            });
        }


        const embed = new MessageEmbed()
            .setAuthor("Herma bot");


        switch (action) {
            case "add":
                await this.add(users, channels, keyWords, textConfig);
                break;
            case "remove":
                await this.remove(users, channels, keyWords, textConfig);
                break;
            case "block":
                await this.block(users, channels, ownUserConfig);
                break;
            case "unblock":
                await this.unblock(users, channels, ownUserConfig);
                break;
            case "mute":
                await this.mute(time, ownUserConfig, embed);
                break;
            case "unmute":
                await this.unmute(ownUserConfig, embed);
                break;
            case "limit":
                await this.limit(<number>time, ownUserConfig, embed);
                break;
            case "status":
                return this.status(ownUserConfig, textConfig, subs??false);
        }

        return this.showMessages(embed,keyWords,action);
    }

    async showMessages(embed: MessageEmbed, keyWords: string[], action: 'add' | 'remove' | 'block' | 'unblock' | 'mute' | 'unmute' | 'limit' | 'status') {
        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        if (this.invites.length > 0)
            for (const {requested, channels} of this.invites) {
                embed.addFields({
                    name: "Vous avez envoyé une invitation à " + (requested.nickname ?? requested.user.username),
                    value: "À <@" + requested.id + ">" + (channels ? " sur les channels " + channels.map(channel => "<#" + channel.id + ">").join(", ") : " sur tout les channels") + "\n" +
                        (keyWords.length > 0 ? " sur les mot clés " + keyWords.map(w => '"' + w + '"').join(", ") : "")
                });
            }
        if (this.updatedSubscribes.length > 0) {
            embed.addFields({
                name: action === "remove" ?
                    "Les mots clés " + keyWords.map(w => "'" + w + "'").join(", ") + " ont été supprimés des écoutes suivantes :" :
                    (keyWords.length === 0 ?
                        "Les mots clé ont été supprimés sur les écoutes suivantes :" :
                        "Les mots clés " + keyWords.map(w => "'" + w + "'").join(", ") + " ont été ajouté aux écoutes suivantes :"),
                value: this.updatedSubscribes.map(({listenedId, channelId}) =>
                    "Sur l'utilisateur <@" + listenedId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels")).join("\n")
            })
        }
        if (this.alreadyInvited.length > 0)
            for (const {requested, keywords, channelsId} of this.alreadyInvited) {
                embed.addFields({
                    name: "Vous avez déjà une invitation en attente de validation pour " + (requested.nickname ?? requested.user.username),
                    value: "À <@" + requested.id + ">" + (channelsId ? " sur les channels " + channelsId.map(channelId => "<#" + channelId + ">").join(", ") : " sur tout les channels") + "\n" +
                        ((keywords && keywords.length > 0) ? " sur les mot clés " + keywords.map(w => '"' + w + '"').join(", ") : "")
                });
            }
        if (this.usersBlockingMe.length > 0)
            embed.addFields({
                name: "Ces utilisateurs vous bloque : ",
                value: this.usersBlockingMe.map(userId => "<@" + userId + ">").join("\n")
            });
        if (this.hasNotText.length > 0)
            embed.addFields({
                name: "Ces utilisateurs n'ont pas la fonctionnalité de notification textuelle : ",
                value: this.hasNotText.map(userId => "<@" + userId + ">").join("\n")
            });
        for (const [userId, blockedChannels] of Object.entries(this.blockedChannelsByUserId)) {
            let member: GuildMember | null = null;
            try {
                member = await this.guild.members.fetch(userId);
            } catch (e) {
            }
            embed.addFields({
                name: (member ? (member.nickname ?? member.user.username) : "invalid-user") + " vous a bloqué pour les channels suivants",
                value: blockedChannels.map(channelId => "<#" + channelId + ">").join("\n")
            });
        }
        const blockedChannelsForEveryone = Object.keys(this.blockedChannelsForEveryoneObj);
        if (blockedChannelsForEveryone.length > 0) {
            embed.addFields({
                name: "Les channels suivants sont blacklistés sur ce serveur :",
                value: blockedChannelsForEveryone.map(channelId => "<#" + channelId + ">").join("\n")
            });
        }
        if (this.deletedSubscribes.length > 0) {
            embed.addFields({
                name: "Les écoutes suivantes ont été supprimées",
                value: this.deletedSubscribes.map(({listenedId, channelId, subscribeAllChannelsExists}) =>
                    "Sur l'utilisateur <@" + listenedId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels") +
                    (subscribeAllChannelsExists ? "\nUne écoute existe toujours sur l'utilisateur <@" + listenedId + "> sur tout les channels, vous pouvez utiliser la commande block pour bloquer le channel <#" + channelId + "> sur l'utilisateur <@" + listenedId + ">\n" : "")).join("\n")
            })
        }
        if (this.cantBeDeleteBecauseOfOnlySubscribeAll.length > 0) {
            embed.addFields({
                name: "Les écoutes suivantes n'ont pas put être supprimées, car une écoute sur tout les channels existe déjà",
                value: this.cantBeDeleteBecauseOfOnlySubscribeAll.map(({listenedId, channelId}) =>
                    "Sur l'utilisateur <@" + listenedId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels") + "" +
                    "\nVous pouvez utiliser la commande block pour bloquer le channel <#" + channelId + "> sur l'utilisateur <@" + listenedId + ">\n"
                ).join("\n")
            })
        }
        if (this.blockeds.length > 0) {
            embed.addFields({
                name: "Vous avez créé les blockages suivant :",
                value: this.blockeds.map(({userId, channelId}) =>
                    userId ?
                        "<@" + userId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels") :
                        "Sur le channel <#" + channelId + "> sur tout les utilisateurs"
                ).join("\n")
            })
        }
        if (this.alreadyBlockeds.length > 0) {
            embed.addFields({
                name: "Les blockages suivant existent déjà :",
                value: this.alreadyBlockeds.map(({userId, channelId}) =>
                    userId ?
                        "<@" + userId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels") :
                        "Sur le channel <#" + channelId + "> sur tout les utilisateurs"
                ).join("\n")
            })
        }
        if (this.unblockeds.length > 0) {
            embed.addFields({
                name: "Vous avez supprimé les blockages suivant :",
                value: this.unblockeds.map(({userId, channelId}) =>
                    userId ?
                        "<@" + userId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels") :
                        "Sur le channel <#" + channelId + "> sur tout les utilisateurs"
                ).join("\n")
            })
        }

        return this.response(true, {embeds: [embed]});
    }

    async showSubscribes(type: 'listener'|'listened', textConfig: ITextConfig): Promise<MessageEmbed> {
        const embed = new MessageEmbed()
            .setTitle(type === 'listener' ? "Qui vous écoutez" : "Qui vous écoutez");
        if (!this.guild)
            return embed;

        const otherType = type === 'listener' ? 'listened' : 'listener';

        const subscribes: aggregatedSubscribes = await TextSubscribe.aggregate([
            { $match: { [type+'Id']: this.member.id, serverId: this.guild?.id } },
            { $group: {
                    _id: '$'+otherType+'Id', listens: {
                        $push: { channelId: "$channelId", keywords: "$keywords", timestamp: "$timestamp", enabled: "$enabled" }
                    }
                }
            }
        ]);

        if (subscribes.length === 0) {
            embed.addFields({
                name: "Aucune écoute en cours",
                value: type === 'listener' ? "Vous n'écoutez personne" : "Personne ne vous écoute"
            })
        }

        for (const {_id, listens} of subscribes) {
            let otherMember: GuildMember | null | undefined;
            try {
                otherMember = await this.guild?.members.fetch(_id);
            } catch (e) {
            }

            if (!otherMember) {
                embed.addFields({
                    name: "Membre introuvable sur ce serveur (id: " + _id + ")",
                    value: "Suppression des abonnements textuels"
                });
                await TextSubscribe.deleteMany({
                    serverId: this.guild.id,
                    $or: [
                        { listenerId: _id },
                        { listenedId: _id }
                    ]
                });
                await TextUserConfig.deleteMany({
                    serverId: this.guild.id,
                    userId: _id
                })
                continue;
            }

            const listener = type === 'listener' ? this.member : otherMember;
            const listened = type === 'listened' ? this.member : otherMember;
            const listenedConfig = await TextUserConfig.findOne({
                serverId: this.guild.id,
                userId: listened.id
            })

            const blockedChannelsHere: string[] = Object.keys(listenedConfig ?
                listenedConfig.blocking
                    .filter(({
                                 userId,
                                 channelId
                    }) => (userId === listener.id || userId === undefined) && channelId !== undefined)
                    .reduce((acc,{channelId}) => ({
                        ...acc,
                        [channelId]: true
                    }), this.blockedChannelsForEveryoneObj) :
                this.blockedChannelsForEveryoneObj
            )

            for (const {channelId} of listens) {
                if (channelId === undefined)
                    continue;
                const channel = this.guild?.channels.cache.get(channelId);
                if (channel === undefined) {
                    await TextSubscribe.deleteMany({
                        serverId: this.guild?.id,
                        channelId
                    })
                }
            }


            embed.addFields({
                name: (type === 'listener' ? "Vous écoutez " : "Vous êtes écouté(e) par ") + (otherMember.nickname ?? otherMember.user.username) + " sur les channels/mots clés suivants :",
                value: listens.map(({keywords, channelId, timestamp, enabled}) =>
                    "Sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels") +
                    ((channelId === undefined && blockedChannelsHere.length > 0) ? "\nSauf ceux ci : "+blockedChannelsHere.map(channelId => '<#'+channelId+'>').join(", ") : "")+
                    ((keywords !== undefined && keywords.length > 0) ? "\nSur les mot clés : " + keywords.map(w => "'" + w + "'").join(", ") : "") +
                    (!enabled ? "\n(écoute inactive)" : "") +
                    "\n" + showDate(extractDate(timestamp), 'fr') + " à " + showTime(extractTime(timestamp), 'fr')
                ).join("\n\n")
            })
        }
        return embed;
    }

    async status(
        ownUserConfig: ITextUserConfig | typeof TextUserConfig,
        textConfig: ITextConfig,
        subs: boolean
    ): Promise<responseType> {

        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        if (subs) {
            for (const channelId of textConfig.channelBlacklist) {
                this.blockedChannelsForEveryoneObj[channelId] = true;
            }
            return this.response(true, {embeds: await Promise.all(['listener', 'listened'].map(t => this.showSubscribes(<'listener' | 'listened'>t, textConfig)))});
        }

        const embed = new MessageEmbed().setAuthor("Herma bot");

        let fieldLines: string[] = [];

        const now = Math.floor(Date.now() / 1000) * 1000;

        const muted = ownUserConfig.lastMute instanceof Date &&
            (
                (
                    ownUserConfig.mutedFor &&
                    now - ownUserConfig.lastMute.getTime() < ownUserConfig.mutedFor
                ) || !ownUserConfig.mutedFor
            )

        let sinceTimeMuted;
        let remainingTimeMuted;
        if (muted && ownUserConfig.mutedFor) {
            sinceTimeMuted = extractUTCTime(now - ownUserConfig.lastMute.getTime());
            remainingTimeMuted = extractUTCTime(ownUserConfig.mutedFor - now + ownUserConfig.lastMute.getTime());
        }

        fieldLines.push(muted ? "Vous êtes mute "+(
            ownUserConfig.mutedFor ? "depuis "+showTime(sinceTimeMuted, 'fr_long')+
                    ".\nIl reste" + showTime(remainingTimeMuted, 'fr_long') + "." :
                    "pour une durée inderterminée"
            ) : "Vous n'êtes pas mute");

        fieldLines.push("Vous avez" + showTime(extractUTCTime(ownUserConfig.limit), 'fr_long') +
            " de répit entre chaque notification");


        const nbSubscribings: number = await TextSubscribe.aggregate([
            {$match: {listenerId: this.member.id}},
            {$group : {_id:"$listenedId"}}
        ]).then((res) => res.length);

        const commandPrefix = this.commandOrigin === "custom" ? config.command_prefix : "/";

        fieldLines.push(nbSubscribings == 0 ?
            "Vous n'écoutez personne" :
            "Vous écoutez " + nbSubscribings + " personne(s), faites '" + commandPrefix + this.commandName + " status subs' pour plus de détails");

        const nbSubscribeds: number = await TextSubscribe.aggregate([
            {$match: {listenedId: this.member.id}},
            {$group : {_id:"$listenerId"}}
        ]).then((res) => res.length);


        fieldLines.push(nbSubscribeds == 0 ?
            "Personne ne vous écoute" :
            "Vous êtes écouté par " + nbSubscribeds + " personne(s), faites '" + commandPrefix + this.commandName + " status subs' pour plus de détails");

        if (ownUserConfig.blocking.length === 0) {
            fieldLines.push("Vous n'avez bloqué aucun utilisateur sur aucun channel");
        }

        embed.addFields({
            name: "Statut :",
            value: '\n' + fieldLines.join("\n\n")
        })

        if (ownUserConfig.blocking.length > 0) {
            embed.addFields({
                name: "Vous avez effectué les blockages suivants :",
                value: ownUserConfig.blocking.map(({userId, channelId}) =>
                    userId ?
                        "<@"+userId+"> sur "+(channelId ? "le channel <#"+channelId+">" : "tout les channels") :
                        "Sur le channel <#"+channelId+"> sur tout les utilisateurs"
                ).join("\n")
            });
        }

        return this.response(true, { embeds: [embed] })
    }

    async mute(
        time: number | undefined,
        ownUserConfig: ITextUserConfig | typeof TextUserConfig,
        embed: MessageEmbed
    ) {
        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        const wasAlreadyMute = ownUserConfig.lastMute !== undefined;

        ownUserConfig.lastMute = new Date(Math.floor(Date.now() / 1000) * 1000);
        if (time === undefined) {
            ownUserConfig.mutedFor = undefined;
            await TextSubscribe.updateMany({
                serverId: this.guild.id,
                listenerId: this.member.id,
                enabled: true
            }, {enabled: false})
        } else {
            if (wasAlreadyMute && ownUserConfig.mutedFor === undefined)
                await reEnableTextSubscribesAfterUnmute(this.member.id, this.guild.id)
            ownUserConfig.mutedFor = time
        }

        ownUserConfig.save();

        embed.addFields({
            name: "Vous vous êtes mute",
            value: "Vous vous êtes mute pour " + (time ? showTime(extractUTCTime(time), 'fr_long') : "une durée indéterminée")
        })
    }

    async unmute(ownUserConfig: ITextUserConfig | typeof TextUserConfig, embed: MessageEmbed) {
        if (ownUserConfig.lastMute && ownUserConfig.mutedFor === undefined) //@ts-ignore
            await reEnableTextSubscribesAfterUnmute(this.member.id, this.guild.id)
        ownUserConfig.lastMute = undefined;
        ownUserConfig.mutedFor = undefined;

        ownUserConfig.save();

        embed.addFields({
            name: "Vous vous êtes démuté",
            value: "Vous vous êtes démuté"
        })
    }

    async limit(
        time: number,
        ownUserConfig: ITextUserConfig | typeof TextUserConfig,
        embed: MessageEmbed
    ) {
        embed.addFields({
            name: <number>time < minimumLimit ?
                "Changement impossible" :
                "Vous avez changé votre limite",
            value: <number>time < minimumLimit ?
                "Vous ne pouvez pas mettre de limite inférieure à "+showTime(extractUTCTime(minimumLimit), 'fr_long') :
                "Il y aura maintenant un répit de" + showTime(extractUTCTime(<number>time), 'fr_long') + " entre chaque notification"
        })

        if (time < minimumLimit)
            return;
        ownUserConfig.limit = time;
        ownUserConfig.save();

    }

    async block(
        users: GuildMember[],
        channels: TextChannel[],
        ownUserConfig: ITextUserConfig | typeof TextUserConfig
    ) {
        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        if (users.length === 0) {
            for (const channel of channels) {
                if (ownUserConfig.blocking.some(({
                                                     userId,
                                                     channelId
                                                 }) => channelId === channel.id && userId === undefined)) {
                    this.alreadyBlockeds.push({
                        channelId: channel.id
                    });
                    continue;
                }
                this.blockeds.push({
                    channelId: channel.id
                });
                ownUserConfig.blocking = [...ownUserConfig.blocking.filter(({channelId}) =>
                    channelId !== channel.id
                ), {channelId: channel.id}]
                await TextSubscribe.updateMany({
                    serverId: this.guild.id,
                    listenedId: this.member.id,
                    channelId: channel.id
                }, {enabled: false});
            }
        } else {
            for (const user of users) {
                if (channels.length === 0) {
                    if (ownUserConfig.blocking.some(({
                                                         userId,
                                                         channelId
                                                     }) => channelId === undefined && userId === user.id)) {
                        this.alreadyBlockeds.push({
                            userId: user.id
                        });
                        continue;
                    }
                    this.blockeds.push({
                        userId: user.id
                    });
                    ownUserConfig.blocking = [...ownUserConfig.blocking.filter(({userId}) =>
                        userId !== user.id
                    ), {userId: user.id}]
                    await TextSubscribe.updateMany({
                        serverId: this.guild.id,
                        listenedId: this.member.id,
                        listenerId: user.id
                    }, {enabled: false});
                    continue;
                }
                for (const channel of channels) {
                    let foundBlocking;
                    if ((foundBlocking = ownUserConfig.blocking.find(({userId, channelId}) =>
                        (channelId === channel.id || channelId === undefined) && (userId === user.id || userId === undefined)
                    ))) {
                        this.alreadyBlockeds.push(foundBlocking);
                        continue;
                    }
                    this.blockeds.push({
                        userId: user.id,
                        channelId: channel.id
                    });
                    ownUserConfig.blocking.push({
                        userId: user.id,
                        channelId: channel.id
                    });
                    await TextSubscribe.updateMany({
                        serverId: this.guild.id,
                        listenedId: this.member.id,
                        listenerId: user.id,
                        channelId: channel.id
                    }, {enabled: false});
                }
            }
        }
        ownUserConfig.save();
    }

    async unblock(
        users: GuildMember[],
        channels: TextChannel[],
        ownUserConfig: ITextUserConfig | typeof TextUserConfig
    ) {
        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        if (users.length === 0) {
            for (const channel of channels) {
                ownUserConfig.blocking = ownUserConfig.blocking.filter(({channelId}) => channelId !== channel.id);
                this.unblockeds.push({
                    channelId: channel.id
                })
                await reEnableTextSubscribesAfterUnblock(this.member.id, this.guild.id, null, channel.id);
            }
        } else {
            for (const user of users) {
                if (channels.length === 0) {
                    ownUserConfig.blocking = ownUserConfig.blocking.filter(({userId}) => userId !== user.id);
                    this.unblockeds.push({
                        userId: user.id
                    });
                    await reEnableTextSubscribesAfterUnblock(this.member.id, this.guild.id, user.id);
                    continue;
                }
                for (const channel of channels) {
                    ownUserConfig.blocking = ownUserConfig.blocking.filter(({userId, channelId}) => userId !== user.id || channelId !== channel.id);
                    this.unblockeds.push({
                        userId: user.id,
                        channelId: channel.id
                    });
                    await reEnableTextSubscribesAfterUnblock(this.member.id, this.guild.id, user.id, channel.id);
                }
            }
        }
        ownUserConfig.save();
    }

    async remove(
        users: GuildMember[],
        channels: TextChannel[],
        keyWords: string[],
        textConfig: typeof TextConfig) {

        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        if (users.length === 0) {
            const userConfigById: { [userId: string]: typeof TextUserConfig } = {};
            const subscribeAllChannelsByUserId: { [userId: string]: typeof TextSubscribe } = await TextSubscribe.find({
                serverId: this.guild.id,
                listenerId: this.member.id,
                channelId: {$exists: false}
            }).then(subscribes => subscribes.reduce((acc, subscribe) => ({
                ...acc,
                [subscribe.listenedId]: subscribe
            }), {}));

            for (const channel of channels) {
                if (keyWords.length > 0 && textConfig.channelBlacklist.includes(channel.id)) {
                    this.blockedChannelsForEveryoneObj[channel.id] = true;
                    continue;
                }
                const listenedsOnThisChannel: string[] = [];
                const subscribes: typeof TextSubscribe[] = await TextSubscribe.find({
                    serverId: this.guild.id,
                    listenerId: this.member.id,
                    channelId: channel.id
                })
                for (const subscribe of subscribes) {
                    listenedsOnThisChannel.push(subscribe.listenedId);

                    if (keyWords.length > 0) {
                        if (userConfigById[subscribe.listenedId] === undefined)
                            userConfigById[subscribe.listenedId] = await TextUserConfig.findOne({userId: subscribe.listenedId});
                        if (userBlockingUsOrChannelText(userConfigById[subscribe.listenedId], subscribe.listenedId, this.usersBlockingMe, this.blockedChannelsByUserId, this.member.id, channel.id))
                            continue;

                        this.updatedSubscribes.push({
                            listenedId: subscribe.listenedId,
                            channelId: channel.id
                        });
                        subscribe.keywords = removeKeyWords(subscribe.keywords, keyWords);
                        if (subscribeAllChannelsByUserId[subscribe.listenedId] && compareKeyWords(subscribeAllChannelsByUserId[subscribe.listenedId].keywords, subscribe.keywords))
                            subscribe.remove();
                        else
                            subscribe.save()
                        continue;
                    }
                    this.deletedSubscribes.push({
                        listenedId: subscribe.listenedId,
                        channelId: channel.id,
                        subscribeAllChannelsExists: subscribeAllChannelsByUserId[subscribe.listenedId] !== undefined
                    });
                    subscribe.remove();
                }
                for (const [listenedId, subscribeAllChannels] of Object.entries(subscribeAllChannelsByUserId)) {
                    if (listenedsOnThisChannel.includes(listenedId))
                        continue;
                    if (keyWords.length > 0) {
                        if (userConfigById[listenedId] === undefined)
                            userConfigById[listenedId] = await TextUserConfig.findOne({userId: listenedId});
                        if (userBlockingUsOrChannelText(userConfigById[listenedId], listenedId, this.usersBlockingMe, this.blockedChannelsByUserId, this.member.id, channel.id))
                            continue;
                        this.updatedSubscribes.push({
                            listenedId,
                            channelId: channel.id
                        });
                        let keyWordsAllChannelsUpdated;
                        if (subscribeAllChannels.keywords && !compareKeyWords((keyWordsAllChannelsUpdated = removeKeyWords(subscribeAllChannels.keywords, keyWords)), subscribeAllChannels.keywords)) {
                            await TextSubscribe.create({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId,
                                channelId: channel.id,
                                keywords: keyWordsAllChannelsUpdated
                            })
                        }
                    } else {
                        this.cantBeDeleteBecauseOfOnlySubscribeAll.push({
                            listenedId,
                            channelId: channel.id
                        })
                    }
                }
            }
        } else {
            for (const user of users) {
                const requestedConfig: ITextUserConfig | null = await TextUserConfig.findOne({
                    serverId: this.guild.id,
                    userId: user.id
                });
                if (keyWords.length > 0 && userBlockingUsOrChannelText(requestedConfig, user.id, this.usersBlockingMe, this.blockedChannelsByUserId, this.member.id))
                    continue;

                const subscribeOnAllChannels: typeof TextSubscribe = await TextSubscribe.findOne({
                    serverId: this.guild.id,
                    listenerId: this.member.id,
                    listenedId: user.id,
                    channelId: {$exists: false}
                })
                if (channels.length === 0) {
                    if (keyWords.length > 0) {
                        if (requestedConfig)
                            this.blockedChannelsByUserId[user.id] = requestedConfig.blocking
                                .filter(({
                                             userId,
                                             channelId
                                         }) => (userId === this.member.id || userId === undefined) && channelId !== undefined)
                                .map(({channelId}) => <string>channelId);

                        for (const channelId of textConfig.channelBlacklist) {
                            this.blockedChannelsForEveryoneObj[channelId] = true;
                        }
                        if (subscribeOnAllChannels) {
                            this.updatedSubscribes.push({
                                listenedId: user.id
                            });
                            subscribeOnAllChannels.keywords = removeKeyWords(subscribeOnAllChannels.keywords, keyWords);
                            subscribeOnAllChannels.save();
                        }
                        const subscribes: typeof TextSubscribe[] = await TextSubscribe.find({
                            serverId: this.guild.id,
                            listenerId: this.member.id,
                            listenedId: user.id,
                            $and: [
                                {channelId: {$exists: true}},
                                {channelId: {$nin: this.blockedChannelsByUserId[user.id]}},
                                {channelId: {$nin: Object.keys(this.blockedChannelsForEveryoneObj)}}
                            ]
                        });
                        for (const subscribe of subscribes) {
                            subscribe.keywords = removeKeyWords(subscribe.keywords, keyWords);
                            this.updatedSubscribes.push({
                                listenedId: user.id,
                                channelId: subscribe.channelId
                            });
                            if (subscribeOnAllChannels && compareKeyWords(subscribeOnAllChannels.keywords, subscribe.keywords))
                                subscribe.remove();
                            else
                                subscribe.save();
                        }
                        continue;
                    }
                    this.deletedSubscribes.push({
                        listenedId: user.id
                    });
                    await TextSubscribe.deleteMany({
                        serverId: this.guild.id,
                        listenerId: this.member.id,
                        listenedId: user.id
                    });
                    continue;
                }
                for (const channel of channels) {

                    if (keyWords.length > 0) {
                        let channelBlocked = false;

                        if (textConfig.channelBlacklist.includes(channel.id)) {
                            this.blockedChannelsForEveryoneObj[channel.id] = true;
                            channelBlocked = true;
                        }

                        if (userBlockingUsOrChannelText(requestedConfig, user.id, this.usersBlockingMe, this.blockedChannelsByUserId, this.member.id, channel.id, false))
                            channelBlocked = true;

                        if (channelBlocked)
                            continue;
                    }

                    let subscribe: typeof TextSubscribe = await TextSubscribe.findOne({
                        serverId: this.guild.id,
                        listenerId: this.member.id,
                        listenedId: user.id,
                        channelId: channel.id
                    });
                    if (keyWords.length > 0) {
                        let keyWordsAllChannelsUpdated;
                        if (subscribe) {
                            this.updatedSubscribes.push({
                                listenedId: user.id,
                                channelId: channel.id
                            });
                            subscribe.keywords = removeKeyWords(subscribe.keywords, keyWords);
                            if (subscribeOnAllChannels && compareKeyWords(subscribeOnAllChannels.keywords, subscribe.keywords))
                                subscribe.remove();
                            else
                                subscribe.save();
                        } else if (subscribeOnAllChannels && subscribeOnAllChannels.keywords && !compareKeyWords((keyWordsAllChannelsUpdated = removeKeyWords(subscribeOnAllChannels.keywords, keyWords)), subscribeOnAllChannels.keywords)) {
                            this.updatedSubscribes.push({
                                listenedId: user.id,
                                channelId: channel.id
                            });
                            subscribe = await TextSubscribe.create({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId: user.id,
                                channelId: channel.id,
                                keywords: keyWordsAllChannelsUpdated
                            })
                        }
                        continue;
                    }
                    if (subscribe === null) {
                        if (subscribeOnAllChannels) {
                            this.cantBeDeleteBecauseOfOnlySubscribeAll.push({
                                listenedId: user.id,
                                channelId: channel.id
                            })
                        }
                        continue;
                    }
                    this.deletedSubscribes.push({
                        listenedId: user.id,
                        channelId: channel.id,
                        subscribeAllChannelsExists: subscribeOnAllChannels !== null
                    })
                    subscribe.remove();
                }

            }
        }
    }

    async add(
        users: GuildMember[],
        channels: TextChannel[],
        keyWords: string[],
        textConfig: ITextConfig) {

        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        if (users.length === 0) {
            const userConfigById: { [userId: string]: typeof TextUserConfig } = {};
            const subscribeAllChannelsByUserId: { [userId: string]: typeof TextSubscribe } = await TextSubscribe.find({
                serverId: this.guild.id,
                listenerId: this.member.id,
                channelId: {$exists: false}
            }).then(subscribes => subscribes.reduce((acc, subscribe) => ({
                ...acc,
                [subscribe.listenedId]: subscribe
            }), {}));

            for (const channel of channels) {
                const listenedsOnThisChannel: string[] = [];

                if (textConfig.channelBlacklist.includes(channel.id)) {
                    this.blockedChannelsForEveryoneObj[channel.id] = true;
                    continue;
                }
                const existingSubscribes: typeof TextSubscribe[] = await TextSubscribe.find({
                    serverId: this.guild.id,
                    listenerId: this.member.id,
                    channelId: channel.id
                });
                for (const subscribe of existingSubscribes) {
                    listenedsOnThisChannel.push(subscribe.listenedId);
                    if (userConfigById[subscribe.listenedId] === undefined)
                        userConfigById[subscribe.listenedId] = await TextUserConfig.findOne({userId: subscribe.listenedId});
                    if (userBlockingUsOrChannelText(userConfigById[subscribe.listenedId], subscribe.listenedId, this.usersBlockingMe, this.blockedChannelsByUserId, this.member.id, channel.id))
                        continue;
                    this.updatedSubscribes.push({
                        listenedId: subscribe.listenedId,
                        channelId: channel.id
                    });
                    subscribe.keywords = keyWords.length === 0 ? undefined : [...(subscribe.keywords ?? []), ...keyWords];
                    if (subscribeAllChannelsByUserId[subscribe.listenedId] && compareKeyWords(subscribe.keywords, subscribeAllChannelsByUserId[subscribe.listenedId].keywords)) {
                        subscribe.remove();
                    } else {
                        subscribe.save();
                    }
                }
                for (const [listenedId, subscribeOnAllChannel] of Object.entries(subscribeAllChannelsByUserId)) {
                    if (listenedsOnThisChannel.includes(listenedId))
                        continue;
                    if (userConfigById[listenedId] === undefined) {
                        userConfigById[listenedId] = await TextUserConfig.findOne({userId: listenedId});
                    }
                    if (userBlockingUsOrChannelText(userConfigById[listenedId], listenedId, this.usersBlockingMe, this.blockedChannelsByUserId, this.member.id, channel.id))
                        continue;
                    this.updatedSubscribes.push({
                        listenedId,
                        channelId: channel.id
                    });
                    if (!compareKeyWords(keyWords,subscribeOnAllChannel.keywords)) {
                        await TextSubscribe.create({
                            serverId: this.guild.id,
                            listenerId: this.member.id,
                            listenedId,
                            channelId: channel.id,
                            keywords: keyWords.length > 0 ? keyWords : undefined
                        })
                    }
                }
            }
        } else {
            for (const user of users) {
                if (!(await Text.staticCheckPermissions(null, user, this.guild, false)) ||
                    textConfig.listenerBlacklist.users.includes(user.id) ||
                    user.roles.cache.some(role => textConfig.listenerBlacklist.roles.includes(role.id))) {

                    this.hasNotText.push(user.id);
                    continue;
                }

                const requestedConfig: ITextUserConfig = await TextUserConfig.findOne({
                    serverId: this.guild.id,
                    userId: user.id
                });

                if (userBlockingUsOrChannelText(requestedConfig, user.id, this.usersBlockingMe, this.blockedChannelsByUserId, this.member.id))
                    continue;

                const existingInviteForAllChannels: typeof TextInvite = await TextInvite.findOne({
                    serverId: this.guild.id,
                    requesterId: this.member.id,
                    requestedId: user.id,
                    accept: true,
                    'channelsId.0': {$exists: false}
                })

                const allChannelSubscribe: typeof TextSubscribe = await TextSubscribe.findOne({
                    serverId: this.guild.id,
                    listenerId: this.member.id,
                    listenedId: user.id,
                    channelId: {$exists: false}
                });

                if (channels.length === 0) {
                    if (requestedConfig) {
                        const blockedChannelIds = requestedConfig.blocking
                            .filter(({
                                         userId,
                                         channelId
                                     }) => (userId === this.member.id || userId === undefined) && channelId !== undefined)
                            .map(({channelId}) => <string>channelId)
                        if (blockedChannelIds.length > 0)
                            this.blockedChannelsByUserId[user.id] = blockedChannelIds;
                    }

                    for (const channelId of textConfig.channelBlacklist) {
                        this.blockedChannelsForEveryoneObj[channelId] = true;
                    }

                    if (allChannelSubscribe) {
                        if (keyWords.length === 0) {
                            allChannelSubscribe.keywords = undefined;
                            await TextSubscribe.deleteMany({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId: user.id,
                                channelId: {$exists: true},
                                $or: [
                                    { keywords: { $exists: false } },
                                    { $and: [
                                            {channelId: {$nin: this.blockedChannelsByUserId[user.id]}},
                                            {channelId: {$nin: Object.keys(this.blockedChannelsForEveryoneObj)}}
                                        ] }
                                ]
                            });
                        } else {
                            allChannelSubscribe.keywords = [...(allChannelSubscribe.keywords ?? []), ...keyWords];
                            const specifiedChannelsSubscribes: typeof TextSubscribe[] = await TextSubscribe.find({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId: user.id,
                                $and: [
                                    {channelId: {$exists: true}},
                                    {channelId: {$nin: this.blockedChannelsByUserId[user.id]}},
                                    {channelId: {$nin: Object.keys(this.blockedChannelsForEveryoneObj)}}
                                ]
                            });
                            for (const subscribe of specifiedChannelsSubscribes) {
                                if (compareKeyWords(subscribe.keywords,allChannelSubscribe.keywords)) {
                                    subscribe.remove();
                                }
                            }
                        }

                        allChannelSubscribe.save();
                        this.updatedSubscribes.push(allChannelSubscribe);
                        continue;
                    }

                    if (existingInviteForAllChannels) {
                        this.alreadyInvited.push({
                            requested: user,
                            keywords: existingInviteForAllChannels.keywords
                        });
                        continue;
                    }

                    this.invites.push({
                        requested: user
                    });

                    Text.sendInvite(this.member, user, this.guild, undefined, keyWords.length > 0 ? keyWords : undefined);

                    continue;
                }

                const channelsToInvite: TextChannel[] = [];

                for (const channel of channels) {
                    let channelBlocked = false;

                    if (userBlockingUsOrChannelText(requestedConfig, user.id, this.usersBlockingMe, this.blockedChannelsByUserId, this.member.id, channel.id, false))
                        channelBlocked = true;

                    if (textConfig.channelBlacklist.includes(channel.id)) {
                        this.blockedChannelsForEveryoneObj[channel.id] = true;
                        channelBlocked = true;
                    }

                    if (channelBlocked) continue;

                    let existingSubscribe: typeof TextSubscribe = await TextSubscribe.findOne({
                        serverId: this.guild.id,
                        listenerId: this.member.id,
                        listenedId: user.id,
                        channelId: channel.id
                    });
                    if (existingSubscribe) {
                        if (keyWords.length === 0) {
                            existingSubscribe.keywords = undefined
                        } else {
                            existingSubscribe.keywords = [...(existingSubscribe.keywords ?? []), ...keyWords]
                        }
                        this.updatedSubscribes.push({
                            listenedId: existingSubscribe.listenedId,
                            channelId: existingSubscribe.channelId
                        });
                        if (allChannelSubscribe && compareKeyWords(existingSubscribe.keywords, allChannelSubscribe.keywords)) {
                            existingSubscribe.remove();
                        } else {
                            existingSubscribe.save();
                        }
                        continue;
                    }
                    if (allChannelSubscribe) {
                        if (!compareKeyWords(keyWords,allChannelSubscribe.keywords)) {
                            existingSubscribe = await TextSubscribe.create({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId: user.id,
                                channelId: channel.id,
                                keywords: keyWords.length > 0 ? keyWords : undefined
                            });
                        }
                        this.updatedSubscribes.push({
                            listenedId: user.id,
                            channelId: channel.id
                        });
                        continue;
                    }
                    channelsToInvite.push(channel);
                }
                if (channelsToInvite.length > 0) {
                    let specifiedChannelExistingInvite;
                    if (existingInviteForAllChannels || (
                        specifiedChannelExistingInvite = await TextInvite.findOne({
                            serverId: this.guild.id,
                            requesterId: this.member.id,
                            requestedId: user.id,
                            accept: true,
                            channelsId: {$all: channelsToInvite.map(channel => channel.id)}
                        })
                    )) {

                        this.alreadyInvited.push({
                            requested: user,
                            keywords: specifiedChannelExistingInvite ? specifiedChannelExistingInvite.keywords : existingInviteForAllChannels.keywords,
                            channelsId: specifiedChannelExistingInvite ? specifiedChannelExistingInvite.channelsId : undefined
                        });
                        continue;
                    }

                    this.invites.push({
                        requested: user,
                        channels: channelsToInvite
                    })
                    Text.sendInvite(this.member, user, this.guild, channelsToInvite.map(channel => channel.id), keyWords.length > 0 ? keyWords : undefined);
                }
            }
        }
    }

    static async listenTextMessages(message: Message) {
        if (!message.guild || !message.member)
            return;

        const serverConfig: ITextConfig = await TextConfig.findOne({
           serverId: message.guild.id,
           enabled: true
        });
        if (!serverConfig || serverConfig.channelBlacklist.includes(message.channel.id))
            return;

        const listened: GuildMember = message.member;

        if (!(await Text.staticCheckPermissions(null, listened, message.guild, false))) {
            await TextSubscribe.deleteMany({
                serverId: message.guild.id,
                $or: [
                    { listenedId: listened.id },
                    { listenerId: listened.id}
                ]
            })
            return;
        }

        const listenedConfig: null|ITextUserConfig|typeof TextUserConfig = await TextUserConfig.findOne({
            serverId: message.guild.id,
            userId: listened.id
        });

        if (listenedConfig &&
            listenedConfig.blocking.some(({channelId, userId}) =>
                channelId === message.channel.id && userId === undefined))
            return;

        const textSubscribes: aggregatedSubscribes =
            await TextSubscribe.aggregate([
            {
                $match: {
                    serverId: message.guild.id,
                    listenedId: listened.id,
                    $or: [
                        {channelId: {$exists: false}},
                        {channelId: message.channel.id}
                    ]
                }
            },
            {
                $group: {
                    _id: "$listenerId",
                    listens: {
                        $push: {
                            channelId: "$channelId",
                            keywords: "$keywords",
                            enabled: "$enabled"
                        }
                    }
                }
            }
        ]);

        if (textSubscribes.length === 0)
            return;

        for (const {_id: listenerId, listens} of textSubscribes) {

            let listener: null|GuildMember = null;
            try {
                listener = await message.guild.members.fetch(listenerId);
            } catch (_) {
            }

            if (listener === null || !(await Text.staticCheckPermissions(null, listener, message.guild, false))) {
                await Promise.all([
                    TextSubscribe.deleteMany({
                        serverId: message.guild.id,
                        $or : [
                            {listenerId: listenerId},
                            {listenedId: listenerId}
                        ]
                    }),
                    ...(listener === null ? [TextUserConfig.deleteMany({
                        serverId: message.guild.id,
                        userId: listenerId
                    })] : [])
                ])
                continue;
            }

            const acc: {[key: string]: aggregatedListening} = {};
            const {listeningAllChannels, listening}: {listeningAllChannels: aggregatedListening, listening: aggregatedListening} =
                    <{listeningAllChannels: aggregatedListening, listening: aggregatedListening}>
                        listens.reduce((acc,listen) => ({
                            ...acc,
                            ...(acc.listening === undefined || listen.channelId !== undefined ? { listening: listen }: {}),
                            ...(listen.channelId === undefined ? {listeningAllChannels: listen}: {})
                        }), acc)

            if (!listening.enabled)
                continue;

            if (listening.channelId === undefined &&
                listenedConfig &&
                userBlockingUsOrChannelText(listenedConfig, message.author.id, null, null, listenerId, message.channel.id, false)
            )
                continue;

            let listenerConfig: ITextUserConfig|typeof TextUserConfig|null = await TextUserConfig.findOne({
                serverId: message.guild.id,
                userId: listenerId
            });

            if (
                listenerConfig &&
                listenerConfig.lastMute &&
                listenerConfig.mutedFor &&
                Date.now() < listenerConfig.lastMute.getTime()+listenerConfig.mutedFor
            )
                continue;

            const keywords = [
                ...listening.keywords??[],
                ...((listening.channelId !== undefined && listeningAllChannels) ? listeningAllChannels.keywords??[] : [])
            ]

            if (
                keywords.length > 0 &&
                !keywords.some(word => findWordInText(word,message.content))
            )
                continue;

            if (listenerConfig === null)
                listenerConfig = await TextUserConfig.create({
                    serverId: message.guild.id,
                    userId: listenerId
                })

            listenerConfig.lastMute = new Date();
            listenerConfig.mutedFor = listenerConfig.limit;
            listenerConfig.save();

            try {
                await (<GuildMember>listener).send("'" + (listened.nickname ?? listened.user.username) + "' a écrit un message sur le channel <#" + message.channel.id + "> sur le serveur '" + message.guild.name + "'");
            } catch (_) {
            }
        }
    }

    static async sendInvite(requester: GuildMember | User, requested: GuildMember, guild: Guild, channelsId: undefined | string[], keywords: undefined | string[]): Promise<boolean> {
        const inviteId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "i";

        const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "a";
        const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "d";

        try {
            await requested.send({
                content: (requester instanceof GuildMember ? (requester.nickname ?? requester.user.username) : requester.username) + " souhaite pouvoir écouter vos messages textuels sur le serveur '" + guild.name + "'",
                ...((channelsId || keywords) ? {
                    embeds: [
                        new MessageEmbed()
                            .setAuthor("Herma bot")
                            .addFields([
                                ...(channelsId ? [{
                                    name: "Sur les channels suivants :",
                                    value: channelsId.map(channelId => "<#" + channelId + ">").join("\n")
                                }] : []),
                                ...(keywords ? [{
                                    name: "Sur les mots clés suivants :",
                                    value: keywords.map(w => '"' + w + '"').join("\n")
                                }] : [])
                            ])
                    ],
                } : {}),
                components: [
                    new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId(acceptButtonId)
                            .setLabel("Accepter")
                            .setStyle("SUCCESS"),
                        new MessageButton()
                            .setCustomId(denyButtonId)
                            .setLabel("Refuser")
                            .setStyle("DANGER"),
                    )
                ]
            })
        } catch (_) {
            return false;
        }

        TextInvite.create({
            inviteId,
            buttonId: acceptButtonId,
            requesterId: requester.id,
            requestedId: requested.id,
            channelsId,
            keywords,
            timestamp: new Date(),
            accept: true,
            serverId: guild.id
        });
        TextInvite.create({
            inviteId,
            buttonId: denyButtonId,
            requesterId: requester.id,
            requestedId: requested.id,
            timestamp: new Date(),
            accept: false,
            serverId: guild.id
        });
        return true;
    }
}
