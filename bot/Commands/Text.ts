import Command from "../Classes/Command";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildChannel,
    GuildMember, MessageActionRow, MessageButton,
    MessageEmbed,
    TextBasedChannels,
    User
} from "discord.js";
import TextConfig, {ITextConfig} from "../Models/Text/TextConfig";
import TextUserConfig, {ITextUserConfig} from "../Models/Text/TextUserConfig";
import TextSubscribe from "../Models/Text/TextSubscribe";
import TextInvite from "../Models/Text/TextInvite";
import {compareKeyWords, removeKeyWords, userBlockingUsOrChannel} from "../Classes/TextAndVocalFunctions";

interface argsType {
    action: 'add' | 'remove' | 'block' | 'unblock' | 'mute' | 'unmute' | 'limit' | 'status',
    users: GuildMember[],
    channels: TextBasedChannels[],
    keyWords: string[],
    time?: number
}

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
                required: (args, _, modelize = false) => !modelize && (args.users === undefined || args.users.length === 0),
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
            }
        }
    };

    static buttonsTimeout = 48 * 60 * 60 * 1000; // 48h pour répondre à une invitation

    constructor(channel: TextBasedChannels, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: 'slash' | 'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, Text.commandName, Text.argsModel);
    }

    async action(args: argsType) {
        const {action, users, channels, keyWords, time} = args;

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
                userId: this.member.id,
                blocking: [],
                limit: 0
            });
        }

        if (["add","remove","block"].includes(action)) {
            const embed = new MessageEmbed()
                .setAuthor("Herma bot");

            const blockedChannelsByUserId: { [userId: string]: string[] } = {};
            const blockedChannelsForEveryoneObj: { [channelId: string]: boolean } = {};
            const usersBlockingMe: string[] = [];
            const hasNotText: string[] = [];

            const invites: Array<{ requested: GuildMember, channels?: TextBasedChannels[] }> = [];
            const alreadyInvited: Array<{ requested: GuildMember, channelsId?: string[], keywords: string[] }> = [];

            const updatedSubscribes: Array<{ listenedId: string, channelId?: string }> = [];
            const deletedSubscribes: Array<{ listenedId: string, channelId?: string, subscribeAllChannelsExists?: boolean }> = [];
            const cantBeDeleteBecauseOfOnlySubscribeAll: Array<{ listenedId: string, channelId: string }> = [];

            const blockeds: Array<{userId?: string, channelId?: string}> = [];
            const alreadyBlockeds: Array<{userId?: string, channelId?: string}> = [];


            switch (action) {
                case "add":
                    await this.add(users, channels, keyWords, textConfig, blockedChannelsByUserId, blockedChannelsForEveryoneObj, usersBlockingMe, hasNotText, invites, alreadyInvited, updatedSubscribes);
                    break;
                case "remove":
                    await this.remove(users, channels, keyWords, textConfig, blockedChannelsByUserId, blockedChannelsForEveryoneObj, usersBlockingMe, updatedSubscribes, deletedSubscribes, cantBeDeleteBecauseOfOnlySubscribeAll);
                    break;
                case "block":
                    await this.block(users, channels, ownUserConfig, blockeds, alreadyBlockeds);
            }

            if (invites.length > 0)
                for (const {requested, channels} of invites) {
                    embed.addFields({
                        name: "Vous avez envoyé une invitation à " + (requested.nickname ?? requested.user.username),
                        value: "À <@" + requested.id + ">" + (channels ? " sur les channels " + channels.map(channel => "<#" + channel.id + ">").join(", ") : " sur tout les channels") + "\n" +
                            (keyWords.length > 0 ? " sur les mot clés " + keyWords.map(w => '"' + w + '"').join(", ") : "")
                    });
                }
            if (updatedSubscribes.length > 0) {
                embed.addFields({
                    name: action === "remove" ?
                        "Les mots clés " + keyWords.map(w => "'" + w + "'").join(", ") + " ont été supprimés des écoutes suivantes :" :
                        (keyWords.length === 0 ?
                            "Les mots clé ont été supprimés sur les écoutes suivantes :" :
                            "Les mots clés " + keyWords.map(w => "'" + w + "'").join(", ") + " ont été ajouté aux écoutes suivantes :"),
                    value: updatedSubscribes.map(({listenedId, channelId}) =>
                        "Sur l'utilisateur <@" + listenedId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels")).join("\n")
                })
            }
            if (alreadyInvited.length > 0)
                for (const {requested, keywords, channelsId} of alreadyInvited) {
                    embed.addFields({
                        name: "Vous avez déjà une invitation en attente de validation pour " + (requested.nickname ?? requested.user.username),
                        value: "À <@" + requested.id + ">" + (channelsId ? " sur les channels " + channelsId.map(channelId => "<#" + channelId + ">").join(", ") : " sur tout les channels") + "\n" +
                            ((keywords && keywords.length > 0) ? " sur les mot clés " + keywords.map(w => '"' + w + '"').join(", ") : "")
                    });
                }
            if (usersBlockingMe.length > 0)
                embed.addFields({
                    name: "Ces utilisateurs vous bloque : ",
                    value: usersBlockingMe.map(userId => "<@" + userId + ">").join("\n")
                });
            if (hasNotText.length > 0)
                embed.addFields({
                    name: "Ces utilisateurs n'ont pas la fonctionnalité de notification textuelle : ",
                    value: hasNotText.map(userId => "<@" + userId + ">").join("\n")
                });
            for (const [userId, blockedChannels] of Object.entries(blockedChannelsByUserId)) {
                embed.addFields({
                    name: "<@" + userId + "> vous a bloqué pour les channels suivants",
                    value: blockedChannels.map(channelId => "<#" + channelId + ">").join("\n")
                });
            }
            const blockedChannelsForEveryone = Object.keys(blockedChannelsForEveryoneObj);
            if (blockedChannelsForEveryone.length > 0) {
                embed.addFields({
                    name: "Les channels suivants sont blacklistés sur ce serveur :",
                    value: blockedChannelsForEveryone.map(channelId => "<#" + channelId + ">").join("\n")
                });
            }
            if (deletedSubscribes.length > 0) {
                embed.addFields({
                    name: "Les écoutes suivantes ont été supprimées",
                    value: deletedSubscribes.map(({listenedId, channelId, subscribeAllChannelsExists}) =>
                        "Sur l'utilisateur <@" + listenedId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels")+
                        (subscribeAllChannelsExists ? "\nUne écoute existe toujours sur l'utilisateur <@"+listenedId+"> sur tout les channels, vous pouvez utiliser la commande block pour bloquer le channel <#"+channelId+"> sur l'utilisateur <@"+listenedId+">\n" : "")).join("\n")
                })
            }

            if (cantBeDeleteBecauseOfOnlySubscribeAll.length > 0) {
                embed.addFields({
                    name: "Les écoutes suivantes n'ont pas put être supprimées, car une écoute sur tout les channels existe déjà",
                    value: cantBeDeleteBecauseOfOnlySubscribeAll.map(({listenedId,channelId}) =>
                        "Sur l'utilisateur <@" + listenedId + "> sur " + (channelId ? "le channel <#" + channelId + ">" : "tout les channels")+"" +
                        "\nVous pouvez utiliser la commande block pour bloquer le channel <#"+channelId+"> sur l'utilisateur <@"+listenedId+">\n"
                    ).join("\n")
                })
            }

            if (blockeds.length > 0) {
                embed.addFields({
                    name: "Vous avez créé les blockages suivant :",
                    value: blockeds.map(({userId, channelId}) =>
                        userId ?
                            "<@"+userId+"> sur "+(channelId ? "le channel <#"+channelId+">" : "tout les channels") :
                            "Sur le channel <#"+channelId+"> sur tout les utilisateurs"
                    ).join("\n")
                })
            }

            if (alreadyBlockeds.length > 0) {
                embed.addFields({
                    name: "Les blockages suivant existent déjà :",
                    value: alreadyBlockeds.map(({userId, channelId}) =>
                        userId ?
                            "<@"+userId+"> sur "+(channelId ? "le channel <#"+channelId+">" : "tout les channels") :
                            "Sur le channel <#"+channelId+"> sur tout les utilisateurs"
                    ).join("\n")
                })
            }

            return this.response(true, {embeds: [embed]});

        }

        return this.response(false, "COUCOU");
    }

    async block(
        users: GuildMember[],
        channels: TextBasedChannels[],
        ownUserConfig: ITextUserConfig | typeof TextUserConfig,
        blockeds: Array<{userId?: string, channelId?: string}>,
        alreadyBlockeds: Array<{userId?: string, channelId?: string}>
    ) {
        if (users.length === 0) {
            for (const channel of channels) {
                if (ownUserConfig.blocking.some(({userId, channelId}) => channelId === channel.id && userId === undefined)) {
                    alreadyBlockeds.push({
                        channelId: channel.id
                    });
                    continue;
                }
                blockeds.push({
                    channelId: channel.id
                });
                ownUserConfig.blocking = [...ownUserConfig.blocking.filter(({channelId}) =>
                    channelId !== channel.id
                ), {channelId: channel.id}]
            }
        } else {
            for (const user of users) {
                if (channels.length === 0) {
                    if (ownUserConfig.blocking.some(({userId, channelId}) => channelId === undefined && userId === user.id)) {
                        alreadyBlockeds.push({
                            userId: user.id
                        });
                        continue;
                    }
                    blockeds.push({
                        userId: user.id
                    });
                    ownUserConfig.blocking = [...ownUserConfig.blocking.filter(({userId}) =>
                        userId !== user.id
                    ), {userId: user.id}]
                    continue;
                }
                for (const channel of channels) {
                    let foundBlocking;
                    if ((foundBlocking = ownUserConfig.blocking.find(({userId, channelId}) =>
                        (channelId === channel.id || channelId === undefined) && (userId === user.id || userId === undefined)
                    ))) {
                        alreadyBlockeds.push(foundBlocking);
                        continue;
                    }
                    blockeds.push({
                        userId: user.id,
                        channelId: channel.id
                    });
                    ownUserConfig.blocking.push({
                        userId: user.id,
                        channelId: channel.id
                    });
                }
            }
        }
        ownUserConfig.save();
    }

    async remove(
        users: GuildMember[],
        channels: TextBasedChannels[],
        keyWords: string[],
        textConfig: typeof TextConfig,
        blockedChannelsByUserId: { [userId: string]: string[] },
        blockedChannelsForEveryoneObj: { [channelId: string]: boolean },
        usersBlockingMe: string[],
        updatedSubscribes: Array<{ listenedId: string, channelId?: string }>,
        deletedSubscribes: Array<{ listenedId: string, channelId?: string, subscribeAllChannelsExists?: boolean }>,
        cantBeDeleteBecauseOfOnlySubscribeAll: Array<{ listenedId: string, channelId: string }>) {

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
            const subscribeAllChannelsByUserId: { [userId: string]: typeof TextSubscribe } =  await TextSubscribe.find({
                serverId: this.guild.id,
                listenerId: this.member.id,
                channelId: {$exists: false}
            }).then(subscribes => subscribes.reduce((acc, subscribe) => ({
                ...acc,
                [subscribe.listenedId]: subscribe
            }), {}));

            for (const channel of channels) {
                if (keyWords.length > 0 && textConfig.channelBlacklist.includes(channel.id)) {
                    blockedChannelsForEveryoneObj[channel.id] = true;
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
                        if (userBlockingUsOrChannel(userConfigById[subscribe.listenedId], subscribe.listenedId, usersBlockingMe, blockedChannelsByUserId, this.member.id, channel.id))
                            continue;

                        updatedSubscribes.push({
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
                    deletedSubscribes.push({
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
                        if (userBlockingUsOrChannel(userConfigById[listenedId], listenedId, usersBlockingMe, blockedChannelsByUserId, this.member.id, channel.id))
                            continue;
                        updatedSubscribes.push({
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
                                keywords: keyWordsAllChannelsUpdated,
                                enabled: subscribeAllChannels.enabled
                            })
                        }
                    } else {
                        cantBeDeleteBecauseOfOnlySubscribeAll.push({
                            listenedId,
                            channelId: channel.id
                        })
                    }
                }
            }
        } else {
            for (const user of users) {
                let requestedConfig: ITextUserConfig|null = await TextUserConfig.findOne({
                    serverId: this.guild.id,
                    userId: user.id
                });
                if (keyWords.length > 0 && userBlockingUsOrChannel(requestedConfig, user.id, usersBlockingMe, blockedChannelsByUserId, this.member.id))
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
                            blockedChannelsByUserId[user.id] = requestedConfig.blocking
                                .filter(({
                                             userId,
                                             channelId
                                         }) => (userId === this.member.id || userId === undefined) && channelId !== undefined)
                                .map(({channelId}) => <string>channelId);

                        for (const channelId of textConfig.channelBlacklist) {
                            blockedChannelsForEveryoneObj[channelId] = true;
                        }
                        if (subscribeOnAllChannels) {
                            updatedSubscribes.push({
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
                                { channelId: { $exists: true } },
                                { channelId: { $nin: blockedChannelsByUserId[user.id] } },
                                { channelId: { $nin: Object.keys(blockedChannelsForEveryoneObj) } }
                            ]
                        });
                        for (const subscribe of subscribes) {
                            subscribe.keywords = removeKeyWords(subscribe.keywords, keyWords);
                            updatedSubscribes.push({
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
                    deletedSubscribes.push({
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
                            blockedChannelsForEveryoneObj[channel.id] = true;
                            channelBlocked = true;
                        }

                        if (userBlockingUsOrChannel(requestedConfig, user.id, usersBlockingMe, blockedChannelsByUserId, this.member.id, channel.id, false))
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
                            updatedSubscribes.push({
                                listenedId: user.id,
                                channelId: channel.id
                            });
                            subscribe.keywords = removeKeyWords(subscribe.keywords, keyWords);
                            if (subscribeOnAllChannels && compareKeyWords(subscribeOnAllChannels.keywords, subscribe.keywords))
                                subscribe.remove();
                            else
                                subscribe.save();
                        } else if (subscribeOnAllChannels && subscribeOnAllChannels.keywords && !compareKeyWords((keyWordsAllChannelsUpdated = removeKeyWords(subscribeOnAllChannels.keywords, keyWords)), subscribeOnAllChannels.keywords)) {
                            updatedSubscribes.push({
                                listenedId: user.id,
                                channelId: channel.id
                            });
                            subscribe = await TextSubscribe.create({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId: user.id,
                                channelId: channel.id,
                                keywords: keyWordsAllChannelsUpdated,
                                enabled: subscribeOnAllChannels.enabled
                            })
                        }
                        continue;
                    }
                    if (subscribe === null) {
                        if (subscribeOnAllChannels) {
                            cantBeDeleteBecauseOfOnlySubscribeAll.push({
                                listenedId: user.id,
                                channelId: channel.id
                            })
                        }
                        continue;
                    }
                    deletedSubscribes.push({
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
        channels: TextBasedChannels[],
        keyWords: string[],
        textConfig: ITextConfig,
        blockedChannelsByUserId: { [userId: string]: string[] },
        blockedChannelsForEveryoneObj: { [channelId: string]: boolean },
        usersBlockingMe: string[],
        hasNotText: string[],
        invites: Array<{ requested: GuildMember, channels?: TextBasedChannels[] }>,
        alreadyInvited: Array<{ requested: GuildMember, channelsId?: string[], keywords: string[] }>,
        updatedSubscribes: Array<{ listenedId: string, channelId?: string }>) {

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
                    blockedChannelsForEveryoneObj[channel.id] = true;
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
                    if (userBlockingUsOrChannel(userConfigById[subscribe.listenedId], subscribe.listenedId, usersBlockingMe, blockedChannelsByUserId, this.member.id, channel.id))
                        continue;
                    updatedSubscribes.push({
                        listenedId: subscribe.listenedId,
                        channelId: channel.id
                    });
                    subscribe.keywords = keyWords.length === 0 ? undefined : [...(subscribe.keywords ?? []), ...keyWords];
                    if (subscribeAllChannelsByUserId[subscribe.listenedId] && compareKeyWords(subscribe.keywords, subscribeAllChannelsByUserId[subscribe.listenedId].keywords)) {
                        subscribe.delete();
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
                    if (userBlockingUsOrChannel(userConfigById[listenedId], listenedId, usersBlockingMe, blockedChannelsByUserId, this.member.id, channel.id))
                        continue;
                    updatedSubscribes.push({
                        listenedId,
                        channelId: channel.id
                    });
                    if (keyWords.length > 0 || (subscribeOnAllChannel.keywords !== undefined && subscribeOnAllChannel.keywords.length > 0)) {
                        await TextSubscribe.create({
                            serverId: this.guild.id,
                            listenerId: this.member.id,
                            listenedId,
                            channelId: channel.id,
                            keywords: keyWords.length > 0 ? [...(subscribeOnAllChannel.keywords ?? []), ...keyWords] : undefined,
                            enabled: subscribeOnAllChannel.enabled
                        })
                    }
                }
            }
        } else {
            for (const user of users) {
                if (!(await Text.staticCheckPermissions(null, user, this.guild, false)) ||
                    textConfig.listenerBlacklist.users.includes(user.id) ||
                    user.roles.cache.some(role => textConfig.listenerBlacklist.roles.includes(role.id))) {

                    hasNotText.push(user.id);
                    continue;
                }

                const requestedConfig: ITextUserConfig = await TextUserConfig.findOne({
                    serverId: this.guild.id,
                    userId: user.id
                });

                if (userBlockingUsOrChannel(requestedConfig, user.id, usersBlockingMe, blockedChannelsByUserId, this.member.id))
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
                    if (requestedConfig)
                        blockedChannelsByUserId[user.id] = requestedConfig.blocking
                            .filter(({
                                         userId,
                                         channelId
                                     }) => (userId === this.member.id || userId === undefined) && channelId !== undefined)
                            .map(({channelId}) => <string>channelId);

                    for (const channelId of textConfig.channelBlacklist) {
                        blockedChannelsForEveryoneObj[channelId] = true;
                    }

                    if (allChannelSubscribe) {
                        if (keyWords.length === 0) {
                            allChannelSubscribe.keywords = undefined;
                            await TextSubscribe.deleteMany({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId: user.id,
                                $and: [
                                    {channelId: { $exists: true }},
                                    {channelId: { $nin: blockedChannelsByUserId[user.id] }},
                                    {channelId: { $nin: Object.keys(blockedChannelsForEveryoneObj)}}
                                ]
                            });
                        } else {
                            allChannelSubscribe.keywords = [...(allChannelSubscribe.keywords ?? []), ...keyWords];
                            const specifiedChannelsSubscribes: typeof TextSubscribe[] = await TextSubscribe.find({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId: user.id,
                                $and: [
                                    {channelId: { $exists: true }},
                                    {channelId: { $nin:  blockedChannelsByUserId[user.id] }},
                                    {channelId: { $nin: Object.keys(blockedChannelsForEveryoneObj)}}
                                ]
                            });
                            for (const subscribe of specifiedChannelsSubscribes) {
                                subscribe.keywords = [...(subscribe.keywords ?? []), ...keyWords];
                                subscribe.save();
                            }
                        }

                        allChannelSubscribe.save();
                        updatedSubscribes.push(allChannelSubscribe);
                        continue;
                    }

                    if (existingInviteForAllChannels) {
                        alreadyInvited.push({
                            requested: user,
                            keywords: existingInviteForAllChannels.keywords
                        });
                        continue;
                    }

                    invites.push({
                        requested: user
                    });

                    Text.sendInvite(this.member, user, this.guild, undefined, keyWords.length > 0 ? keyWords : undefined);

                    continue;
                }

                const channelsToInvite: TextBasedChannels[] = [];

                for (const channel of channels) {
                    let channelBlocked = false;

                    if (userBlockingUsOrChannel(requestedConfig, user.id, usersBlockingMe, blockedChannelsByUserId, this.member.id, channel.id, false))
                        channelBlocked = true;

                    if (textConfig.channelBlacklist.includes(channel.id)) {
                        blockedChannelsForEveryoneObj[channel.id] = true;
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
                        updatedSubscribes.push({
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
                        if (keyWords.length > 0 || (allChannelSubscribe.keywords !== undefined && allChannelSubscribe.keywords.length > 0)) {
                            existingSubscribe = await TextSubscribe.create({
                                serverId: this.guild.id,
                                listenerId: this.member.id,
                                listenedId: user.id,
                                channelId: channel.id,
                                keywords: keyWords.length > 0 ? [...(allChannelSubscribe.keywords ?? []), ...keyWords] : undefined,
                                enabled: allChannelSubscribe.enabled
                            });
                        }
                        updatedSubscribes.push({
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

                        alreadyInvited.push({
                            requested: user,
                            keywords: specifiedChannelExistingInvite ? specifiedChannelExistingInvite.keywords : existingInviteForAllChannels.keywords,
                            channelsId: specifiedChannelExistingInvite ? specifiedChannelExistingInvite.channelsId : undefined
                        });
                        continue;
                    }

                    invites.push({
                        requested: user,
                        channels: channelsToInvite
                    })
                    Text.sendInvite(this.member, user, this.guild, channelsToInvite.map(channel => channel.id), keyWords.length > 0 ? keyWords : undefined);
                }
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
