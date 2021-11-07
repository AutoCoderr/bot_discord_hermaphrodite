import Command from "../Classes/Command";
import {
    Guild,
    GuildMember, Interaction,
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    Role, VoiceState
} from "discord.js";
import config from "../config";
import VocalSubscribe, {IVocalSubscribe} from "../Models/VocalSubscribe";
import VocalConfig, {IVocalConfig} from "../Models/VocalConfig";
import VocalUserConfig, {IVocalUserConfig} from "../Models/VocalUserConfig";
import VocalInvite, {IVocalInvite} from "../Models/VocalInvite";
import client from "../client";
import {decomposeMsTime, durationUnits, showTime, splitFieldsEmbed} from "../Classes/OtherFunctions";

export default class Vocal extends Command {
    static display = true;
    static description = "Être alerté quand une ou plusieurs personnes se connectent à un ou plusieurs channels";
    static commandName = "vocal";

    constructor(message: Message) {
        super(message, Vocal.commandName);
    }

    argsModel = {
        help: {fields: ["-h", "--help"], type: "boolean", required: false, description: "Pour afficher l'aide"},

        $argsByType: {
            action: {
                required: (args) => args.help == undefined,
                type: "string",
                description: "L'action à effectuer : add, remove, block, unblock, stop, start, limit, mute, unmute, status",
                valid: (field) => ['add', 'remove', 'block',  'unblock', 'stop', 'start', 'limit', 'mute', 'unmute', 'status'].includes(field)
            },
            subAction: {
                required: false,
                type: "string",
                description: "Obtenir plus de détails concernant les écoutes : subs",
                valid: (field) => ['sub', 'subs'].includes(field)
            },
            roles: {
                required: false,
                displayValidError: true,
                displayExtractError: true,
                type: "role",
                multi: true,
                description: "Le ou les roles à ignorer",
                valid: (role: Role, args) =>
                    !args.roles.some(eachRole => eachRole.id === role.id),
                errorMessage: () => ({
                    name: "Roles mal rentrés",
                    value: "Vous avez mal renseigné vos roles. Vous ne pouvez pas renseigner plus d'une fois le même role"
                })
            },
            users: {
                required: (args) => args.help == undefined &&
                    (['add', 'remove'].includes(args.action) || (['block', 'unblock'].includes(args.action) && args.roles.length == 0)),
                displayValidErrorEvenIfFound: true,
                displayExtractError: true,
                type: "user",
                multi: true,
                description: "Le ou les utilisateurs à ignorer ou écouter quand ils se connectent sur un vocal",
                valid: (user: GuildMember, args) =>
                    user.id !== this.message.author.id && !args.users.some(eachUser => eachUser.id === user.id),
                errorMessage: (value, args) => (value == undefined && args.channels == undefined && ['block', 'unblock'].includes(args.action)) ?
                    {
                        name: "Rentrez au moins l'un des deux",
                        value: "Vous devez avoir mentionné au moins un utilisateur ou un role."
                    } : {
                        name: "Utilisateurs non ou mal renseigné",
                        value: "Vous n'avez pas ou mal renseigné les utilisateurs.\n" +
                            "Vous ne pouvez pas vous renseignez vous même, ni renseigner plusieurs fois les mêmes personnes"
                    }
            },
            time: {
                required: (args) => args.help == undefined && ["limit", "mute"].includes(args.action),
                type: "duration",
                description: "Le temps durant lequel on souhaite ne pas recevoir de notif (ex: 30s, 5m, 3h, 2j)",
                valid: (time, args) => args.action !== 'mute' || time > 0
            }
        }
    }

    async action(args: { help: boolean, action: string, subAction: string, users: GuildMember[], roles: Role[], time: number }) {
        const {help, action, subAction, roles, users, time} = args;

        if (help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild === null) {
            this.sendErrors({
                name: "Missing guild",
                value: "We couldn't find the message guild"
            });
            return false;
        }

        const vocalConfig: IVocalConfig = await VocalConfig.findOne({serverId: this.message.guild.id, enabled: true});
        if (vocalConfig == null) {
            this.sendErrors({
                name: "Vocal désactivé",
                value: "Vous ne pouvez pas executer cette commande car l'option d'abonnement vocal n'est pas activée sur ce serveur"
            });
            return false;
        }
        if (['add', 'remove'].includes(action) &&
            (vocalConfig.listenerBlacklist.users.includes(this.message.author.id) ||
                vocalConfig.listenerBlacklist.roles.some(roleId => this.message.member && this.message.member.roles.cache.some(role => role.id === roleId)))) {
            this.sendErrors({
                name: "Accès interdit",
                value: "Vous n'avez visiblement pas le droit d'utiliser l'option d'abonnement vocal sur ce serveur"
            });
            return false;
        }

        let ownUserConfig: IVocalUserConfig | typeof VocalUserConfig = await VocalUserConfig.findOne({
            serverId: this.message.guild.id,
            userId: this.message.author.id
        });

        if (ownUserConfig === null) {
            ownUserConfig = await VocalUserConfig.create({
                serverId: this.message.guild.id,
                userId: this.message.author.id,
                blocked: {users: [], roles: []},
                listening: true,
                limit: 0
            });
        }

        const embed = new MessageEmbed()
            .setAuthor("Herma bot");

        if (action == 'add') {
            const forbiddens: GuildMember[] = [];
            const inviteds: GuildMember[] = [];
            const alreadyInviteds: GuildMember[] = [];
            const alreadySubscribeds: GuildMember[] = [];
            const usersCantBeDM: GuildMember[] = [];

            for (const user of users) {
                const subscribe = await VocalSubscribe.findOne({
                    listenerId: this.message.author.id,
                    listenedId: user.id,
                    serverId: this.message.guild.id
                });

                if (subscribe !== null) {
                    alreadySubscribeds.push(user);
                    continue;
                }

                const invite = await VocalInvite.findOne({
                    serverId: this.message.guild.id,
                    requesterId: this.message.author.id,
                    requestedId: user.id
                });

                if (invite !== null) {
                    alreadyInviteds.push(user);
                    continue;
                }

                const userConfig: null | IVocalUserConfig = await VocalUserConfig.findOne({
                    serverId: this.message.guild.id,
                    userId: user.id
                });
                if (userConfig !== null &&
                    (
                        userConfig.blocked.users.includes(this.message.author.id) ||
                        userConfig.blocked.roles.some(roleId => this.message.member && this.message.member.roles.cache.some(role => role.id === roleId))
                    )) {
                    forbiddens.push(user);
                    continue;
                }
                const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "a";
                const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "d";

                try {
                    await user.send({
                        content: (this.message.member?.nickname ?? this.message.author.username) + " souhaite pouvoir écouter vos connexions vocales sur le serveur '" + this.message.guild.name + "'",
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
                    usersCantBeDM.push(user);
                    continue;
                }

                VocalInvite.create({
                    buttonId: acceptButtonId,
                    requesterId: this.message.author.id,
                    requestedId: user.id,
                    accept: true,
                    serverId: this.message.guild.id
                });
                VocalInvite.create({
                    buttonId: denyButtonId,
                    requesterId: this.message.author.id,
                    requestedId: user.id,
                    accept: false,
                    serverId: this.message.guild.id
                });

                inviteds.push(user);
            }
            if (forbiddens.length > 0)
                embed.addFields({
                    name: "Vous êtes bloqués par :",
                    value: forbiddens.map(user => "<@" + user.id + ">").join("\n")
                });
            if (alreadySubscribeds.length > 0)
                embed.addFields({
                    name: "Déjà écoutés  :",
                    value: alreadySubscribeds.map(user => "<@" + user.id + ">").join("\n")
                });
            if (alreadyInviteds.length > 0)
                embed.addFields({
                    name: "Déjà invités :",
                    value: alreadyInviteds.map(user => "<@" + user.id + ">").join("\n")
                });
            if (inviteds.length > 0)
                embed.addFields({
                    name: "Invités avec succès :",
                    value: inviteds.map(user => "<@" + user.id + ">").join("\n")
                });
            if (usersCantBeDM.length > 0)
                embed.addFields({
                    name: "Ces utilisateurs refusent les messages privés :",
                    value: usersCantBeDM.map(user => "<@" + user.id + ">").join("\n")
                })
            if (!ownUserConfig.listening) {
                embed.addFields({
                    name: "Votre écoute est désactivée",
                    value: "Vous avez désactivé votre écoute, donc vous ne recevrez pas de notif"
                });
            }

            this.message.channel.send({embeds: [embed]});
            return true;

        }

        if (action == 'remove') {
            const doesntExist: GuildMember[] = [];
            const deleted: GuildMember[] = [];

            for (const user of users) {
                const vocalSubscribe: typeof VocalSubscribe = await VocalSubscribe.findOne({
                    serverId: this.message.guild.id,
                    listenerId: this.message.author.id,
                    listenedId: user.id
                });

                if (vocalSubscribe === null) {
                    doesntExist.push(user);
                    continue;
                }

                vocalSubscribe.remove();
                deleted.push(user);
            }

            if (doesntExist.length > 0)
                embed.addFields({
                    name: "Vous n'avez pas d'écoute sur :",
                    value: doesntExist.map(user => "<@" + user.id + ">").join("\n")
                });
            if (deleted.length > 0)
                embed.addFields({
                    name: "Supprimés avec succès :",
                    value: deleted.map(user => "<@" + user.id + ">").join("\n")
                });

            this.message.channel.send({embeds: [embed]});
            return true;
        }


        if (action == 'block') {
            const alreadyBlocked: Array<GuildMember | Role> = [];
            const blocked: Array<GuildMember | Role> = [];
            const notFoundUsersId: string[] = [];

            for (const [name, list] of Object.entries({users, roles})) {
                if (list !== undefined) {
                    for (const elem of list) {
                        if (ownUserConfig.blocked[name].includes(elem.id)) {
                            alreadyBlocked.push(elem);
                            continue;
                        }

                        blocked.push(elem);

                        ownUserConfig.blocked[name].push(elem.id);
                    }
                }
            }

            const vocalSubscribes: Array<typeof VocalSubscribe | IVocalSubscribe> = await VocalSubscribe.find({
                serverId: this.message.guild.id,
                listenedId: this.message.author.id,
                enabled: true
            });

            for (const vocalSubscribe of vocalSubscribes) {
                if (ownUserConfig.blocked.users.includes(vocalSubscribe.listenerId)) {
                    vocalSubscribe.enabled = false;
                    vocalSubscribe.save();
                    continue;
                }

                let listener: GuildMember;
                try {
                    listener = await this.message.guild.members.fetch(vocalSubscribe.listenerId);
                } catch (e) {
                    vocalSubscribe.remove();
                    notFoundUsersId.push(vocalSubscribe.listenerId);
                    continue;
                }

                if (listener.roles.cache.some(role => ownUserConfig.blocked.roles.some(roleId => role.id === roleId))) {
                    vocalSubscribe.enabled = false;
                    vocalSubscribe.save();
                }
            }

            ownUserConfig.save();

            if (notFoundUsersId.length > 0)
                embed.addFields({
                    name: "Utilisateurs introuvables : ",
                    value: notFoundUsersId.map(userId => "<@" + userId + ">").join("\n")
                });
            if (alreadyBlocked.length > 0)
                embed.addFields({
                    name: "Déjà bloqués :",
                    value: alreadyBlocked.map(elem => "<@" + (elem instanceof Role ? "&" : "") + elem.id + "> (" + (elem instanceof Role ? 'role' : 'user') + ")").join("\n")
                });
            if (blocked.length > 0)
                embed.addFields({
                    name: "Bloqués avec succès : ",
                    value: blocked.map(elem => "<@" + (elem instanceof Role ? "&" : "") + elem.id + "> (" + (elem instanceof Role ? 'role' : 'user') + ")").join("\n")
                });

            this.message.channel.send({embeds: [embed]});

            return true;
        }

        if (action == 'unblock') {
            const unBlocked: Array<GuildMember | Role> = [];
            const alreadyUnblocked: Array<GuildMember | Role> = [];
            const notFoundUsersId: string[] = [];

            for (const [name, list] of Object.entries({users, roles})) {
                if (list !== undefined) {
                    for (const elem of list) {
                        let blockedIndex;
                        if ((blockedIndex = ownUserConfig.blocked[name].indexOf(elem.id)) == -1) {
                            alreadyUnblocked.push(elem);
                            continue;
                        }

                        ownUserConfig.blocked[name].splice(blockedIndex, 1);
                        unBlocked.push(elem);
                    }
                }
            }

            const vocalSubscribes: Array<typeof VocalSubscribe | IVocalSubscribe> = await VocalSubscribe.find({
                serverId: this.message.guild.id,
                listenedId: this.message.author.id,
                enabled: false
            });

            for (const vocalSubscribe of vocalSubscribes) {
                if (ownUserConfig.blocked.users.includes(vocalSubscribe.listenerId))
                    continue;

                const listenerConfig: null | IVocalUserConfig = await VocalUserConfig.findOne({
                    serverId: this.message.guild.id,
                    listenerId: vocalSubscribe.listenerId
                });
                if (listenerConfig != null && !listenerConfig.listening)
                    continue;

                let listener: GuildMember;
                try {
                    listener = await this.message.guild.members.fetch(vocalSubscribe.listenerId);
                } catch (e) {
                    vocalSubscribe.remove();
                    notFoundUsersId.push(vocalSubscribe.listenerId);
                    continue;
                }

                if (listener.roles.cache.some(role => ownUserConfig.blocked.roles.some(roleId => roleId === role.id)))
                    continue;

                vocalSubscribe.enabled = true;
                vocalSubscribe.save();
            }
            ownUserConfig.save();

            if (notFoundUsersId.length > 0)
                embed.addFields({
                    name: "Utilisateurs introuvables : ",
                    value: notFoundUsersId.map(userId => "<@" + userId + ">").join("\n")
                });
            if (alreadyUnblocked.length > 0)
                embed.addFields({
                    name: "Non bloqués :",
                    value: alreadyUnblocked.map(elem => "<@" + (elem instanceof Role ? "&" : "") + elem.id + "> (" + (elem instanceof Role ? 'role' : 'user') + ")").join("\n")
                });
            if (unBlocked.length > 0)
                embed.addFields({
                    name: "débloqués avec succès : ",
                    value: unBlocked.map(elem => "<@" + (elem instanceof Role ? "&" : "") + elem.id + "> (" + (elem instanceof Role ? 'role' : 'user') + ")").join("\n")
                });
            if (!ownUserConfig.listening)
                embed.addFields({
                    name: "Votre écoute est désactivée",
                    value: "Vous avez désactivé votre écoute, donc vous ne recevrez pas de notif"
                });

            this.message.channel.send({embeds: [embed]});

            return true;
        }

        if (action === "stop") {
            ownUserConfig.listening = false;
            ownUserConfig.save();

            await VocalSubscribe.updateMany({
                serverId: this.message.guild.id,
                listenerId: this.message.author.id,
                enabled: true
            }, {
                enabled: false
            });

            embed.addFields({
                name: "Ecoute désactivée",
                value: "Ecoute désactivée avec succès"
            });

            this.message.channel.send({embeds: [embed]});
            return true;
        }

        if (action === "start") {
            ownUserConfig.listening = true;
            ownUserConfig.save();

            const vocalSubscribes: Array<typeof VocalSubscribe | IVocalSubscribe> = await VocalSubscribe.find({
                serverId: this.message.guild.id,
                listenerId: this.message.author.id,
                enabled: false
            });

            for (const vocalSubscribe of vocalSubscribes) {
                const listenedConfig: null | IVocalUserConfig = await VocalUserConfig.findOne({
                    serverId: this.message.guild.id,
                    userId: vocalSubscribe.listenedId
                });

                if (listenedConfig !== null && (listenedConfig.blocked.users.includes(this.message.author.id) ||
                    (
                        this.message.member &&
                        this.message.member.roles.cache.some(role => listenedConfig.blocked.roles.some(roleId => roleId === role.id))
                    ))
                ) continue

                vocalSubscribe.enabled = true;
                vocalSubscribe.save();
            }

            embed.addFields({
                name: "Ecoute activée",
                value: "Ecoute activée avec succès"
            });

            this.message.channel.send({embeds: [embed]});
            return true;
        }

        if (action === "mute") {
            ownUserConfig.lastMute = new Date(Math.floor(Date.now() / 1000) * 1000);
            ownUserConfig.mutedFor = time

            this.message.channel.send("Vous ne recevrez plus de notification pendant" + showTime(decomposeMsTime(time)));

            ownUserConfig.save();
            return true;
        }

        if (action == 'unmute') {
            if (
                typeof (ownUserConfig.mutedFor) === "number" &&
                ownUserConfig.lastMute instanceof Date &&
                Date.now() - ownUserConfig.lastMute.getTime() < ownUserConfig.mutedFor
            ) {
                ownUserConfig.lastMute = null;
                ownUserConfig.mutedFor = null;

                this.message.channel.send("Vous pouvez de nouveau recevoir des notifications");

                ownUserConfig.save();
                return true;
            }

            this.message.channel.send("Vous n'êtes pas mute");
        }

        if (action == 'limit') {
            ownUserConfig.limit = time;

            this.message.channel.send((time == 0) ?
                "Il n'y aura maintenant aucun répit entre les notifications" :
                "Il y aura maintenant un répit de" + showTime(decomposeMsTime(time)) + " entre chaque notification"
            );
            ownUserConfig.save();

            return true;
        }

        if (action == "status") {
            let embeds: MessageEmbed[] = [embed];

            if (["sub", 'subs'].includes(subAction)) {

                const subscribings: Array<IVocalSubscribe|typeof VocalSubscribe> = await VocalSubscribe.find({
                    serverId: this.message.guild.id,
                    listenerId: this.message.author.id
                })

                if (subscribings.length > 0) {
                    const subscribingsEmbeds = splitFieldsEmbed(15, await Promise.all(subscribings.map(async subscribe => {
                        let member: null | GuildMember = null;
                        try {
                            member = (await this.message.guild?.members.fetch(subscribe.listenedId)) ?? null;
                        } catch (_) {
                            subscribe.remove();
                        }
                        return {
                            name: member ? (member.nickname ?? member.user.username) : 'Not found user ('+subscribe.listenedId+')',
                            value: member ?
                                "Vous écoutez <@" + subscribe.listenedId + ">" + (!subscribe.enabled ? " (écoute désactivée)" : "") :
                                "N'est plus présent sur le serveur, écoute supprimée"
                        }
                    })), (embed: MessageEmbed, nbPart) => {
                        if (nbPart == 1)
                            embed.setTitle("Vous écoutez " + subscribings.length + " personnes");
                    });
                    embeds = [...embeds, ...subscribingsEmbeds]
                } else {
                    embed.addFields({
                        name: "Vous n'écoutez personnes",
                        value: "Vous n'écoutez personnes",
                    })
                }

                const subscribeds: Array<IVocalSubscribe|typeof VocalSubscribe> = await VocalSubscribe.find({
                    serverId: this.message.guild.id,
                    listenedId: this.message.author.id
                })

                if (subscribeds.length > 0) {
                    const subscribedsEmbeds = splitFieldsEmbed(15, await Promise.all(subscribeds.map(async subscribe => {
                        let member: null | GuildMember = null;
                        try {
                            member = (await this.message.guild?.members.fetch(subscribe.listenerId)) ?? null;
                        } catch (_) {
                            subscribe.remove();
                        }
                        let muted = false;
                        if (member) {
                            const userConfig: IVocalUserConfig = await VocalUserConfig.findOne({
                                serverId: (<Guild>this.message.guild).id,
                                userId: subscribe.listenerId
                            })
                            muted = userConfig != null &&
                                typeof(userConfig.mutedFor) == "number" &&
                                userConfig.lastMute instanceof Date &&
                                Date.now()-userConfig.lastMute.getTime() < userConfig.mutedFor;
                        }
                        return {
                            name: member ? (member.nickname ?? member.user.username) : 'Not found user ('+subscribe.listenerId+')',
                            value: member ? "<@" + subscribe.listenerId + "> vous écoute" +
                                (!subscribe.enabled ? " (écoute désactivée)" :
                                    muted ? " (il/elle est mute)" : ""
                                ) : "N'est plus présent sur le serveur, écoute supprimée"
                        }
                    })), (embed: MessageEmbed, nbPart) => {
                        if (nbPart == 1)
                            embed.setTitle("Vous êtes écouté par " + subscribeds.length + " personnes");
                    });
                    embeds = [...embeds, ...subscribedsEmbeds]
                } else {
                    embed.addFields({
                        name: "Vous n'êtes écouté par personne",
                        value: "Vous n'êtes écouté par personne",
                    })
                }
            } else {
                let fieldLines: string[] = [];

                const now = Math.floor(Date.now() / 1000) * 1000;

                const muted = typeof (ownUserConfig.mutedFor) == "number" &&
                    ownUserConfig.lastMute instanceof Date &&
                    now - ownUserConfig.lastMute.getTime() < ownUserConfig.mutedFor;

                let sinceTimeMuted;
                let remaningTimeMuted;
                if (muted) {
                    sinceTimeMuted = decomposeMsTime(now - ownUserConfig.lastMute.getTime());
                    remaningTimeMuted = decomposeMsTime(ownUserConfig.mutedFor - now + ownUserConfig.lastMute.getTime());
                }

                fieldLines.push(muted ? "Vous êtes mute depuis" + showTime(sinceTimeMuted) +
                    ".\nIl reste" + showTime(remaningTimeMuted) + "." : "Vous n'êtes pas mute");

                fieldLines.push((ownUserConfig.limit > 0 ? "Vous avez" + showTime(decomposeMsTime(ownUserConfig.limit)) : "Vous n'avez pas") +
                    " de répit entre chaque notification");

                fieldLines.push("L'écoute est " + (ownUserConfig.listening ? "activée" : "désactivée"));



                const nbSubscribings: number = await VocalSubscribe.count({
                    serverId: this.message.guild.id,
                    listenerId: this.message.author.id
                })

                fieldLines.push(nbSubscribings == 0 ?
                    "Vous n'écoutez personne" :
                    "Vous écoutez " + nbSubscribings + " personnes, faites '" + config.command_prefix + this.commandName + " status subs' pour plus de détails");

                const nbSubscribeds: number = await VocalSubscribe.count({
                    serverId: this.message.guild.id,
                    listenedId: this.message.author.id
                })

                fieldLines.push(nbSubscribeds == 0 ?
                    "Personne ne vous écoute" :
                    "Vous êtes écouteé par " + nbSubscribeds + " personnes, faites '" + config.command_prefix + this.commandName + " status subs' pour plus de détails");

                if (ownUserConfig.blocked.users.length + ownUserConfig.blocked.roles.length == 0) {
                    fieldLines.push("Vous n'avez bloqué aucun utilisateur ni aucun role");
                }

                embed.addFields({
                    name: "Status :",
                    value: '\n'+fieldLines.join("\n\n")
                })

                if (ownUserConfig.blocked.users.length > 0) {
                    embed.addFields({
                        name: "Les utilisateurs que vous avez bloqué",
                        value: ownUserConfig.blocked.users.map(userId => "<@" + userId + ">").join("\n")
                    });
                }
                if (ownUserConfig.blocked.roles.length > 0) {
                    embed.addFields({
                        name: "Les roles que vous avez bloqué",
                        value: ownUserConfig.blocked.roles.map(userId => "<@&" + userId + ">").join("\n")
                    });
                }
            }


            this.message.channel.send({embeds});
            return true;
        }

        return false;
    }

    static async listenVoiceChannelsConnects(oldState: VoiceState, newState: VoiceState) {
        if (oldState.channelId !== newState.channelId && newState.channelId !== null && newState.channel !== null && newState.member !== null) {
            const vocalConfig: IVocalConfig = await VocalConfig.findOne({serverId: newState.guild.id, enabled: true});
            if (vocalConfig === null) return;

            if (vocalConfig.channelBlacklist.includes(newState.channelId)) return;

            const vocalSubscribes: IVocalSubscribe[] = await VocalSubscribe.find({
                serverId: newState.guild.id,
                listenedId: newState.member.id,
                enabled: true
            });

            for (const vocalSubscribe of vocalSubscribes) {
                let listenerConfig: IVocalUserConfig | typeof VocalUserConfig = await VocalUserConfig.findOne({
                    serverId: newState.guild.id,
                    userId: vocalSubscribe.listenerId
                });

                if (listenerConfig === null) {
                    listenerConfig = await VocalUserConfig.create({
                        serverId: newState.guild.id,
                        userId: vocalSubscribe.listenerId,
                        blocked: {users: [], roles: []},
                        listening: true,
                        limit: 0
                    });
                }

                if (
                    listenerConfig.lastMute instanceof Date &&
                    typeof (listenerConfig.mutedFor) == "number" &&
                    Date.now() - listenerConfig.lastMute.getTime() < listenerConfig.mutedFor
                ) continue;

                let listener: null | GuildMember = null;
                try {
                    listener = await newState.guild.members.fetch(vocalSubscribe.listenerId);
                } catch (_) {
                }

                if (listener === null) {
                    VocalSubscribe.deleteMany({
                        serverId: newState.guild.id,
                        listenerId: vocalSubscribe.listenerId
                    });
                    listenerConfig.remove()
                    continue;
                }
                try {
                    await listener.send("'" + (newState.member.nickname ?? newState.member.user.username) + "' s'est connecté sur le channel vocal '#" + newState.channel.name + "' sur le serveur '" + newState.guild.name + "'");
                } catch (_) {
                    continue;
                }

                if (listenerConfig.limit > 0) {
                    listenerConfig.lastMute = new Date(Math.floor(Date.now() / 1000) * 1000);
                    listenerConfig.mutedFor = listenerConfig.limit;
                    listenerConfig.save();
                }
            }

        }
    }

    static async listenInviteButtons(interaction: Interaction) {
        if (interaction.isButton()) {
            const invite: IVocalInvite = await VocalInvite.findOne({
                buttonId: interaction.customId
            })

            let server;

            if (invite !== null) {
                await interaction.deferReply();
                if ((server = client.guilds.cache.get(invite.serverId)) === undefined) {
                    await interaction.editReply({content: "Le serveur associé à cette invitation semble inaccessible au bot"});
                } else {
                    let requested: null | GuildMember = null;
                    try {
                        requested = await server.members.fetch(invite.requestedId);
                    } catch (_) {
                        await interaction.editReply("Vous ne vous trouvez visiblement plus sur le serveur " + server.name);
                    }
                    let requester: null | GuildMember = null;
                    if (requested !== null) {
                        try {
                            requester = await server.members.fetch(invite.requesterId);
                        } catch (_) {
                            await interaction.editReply("L'envoyeur de cette invitation est introuvable sur le serveur " + server.name);
                        }
                    }

                    if (requested !== null && requester !== null) {
                        if (invite.accept) {
                            const listenerConfig: IVocalUserConfig = await VocalUserConfig.findOne({
                                serverId: server.id,
                                listenerId: invite.requesterId
                            });
                            await VocalSubscribe.create({
                                serverId: invite.serverId,
                                listenerId: invite.requesterId,
                                listenedId: invite.requestedId,
                                enabled: listenerConfig.listening
                            });
                            try {
                                await requester.send((requested.nickname ?? requested.user.username) + " a accepté(e) votre invitation sur '" + server.name + "'" + (!listenerConfig.listening ? " (Attention votre écoute n'est pas activée sur ce serveur)" : ""));
                            } catch (_) {
                            }
                            await interaction.editReply({content: "Invitation acceptée"});
                        } else {
                            try {
                                await requester.send((requested.nickname ?? requested.user.username) + " a refusé(e) votre invitation sur '" + server.name + "'");
                            } catch (_) {
                            }
                            await interaction.editReply({content: "Invitation refusée"});
                        }
                    }
                }
                await VocalInvite.deleteMany({
                    serverId: invite.serverId,
                    requesterId: invite.requesterId,
                    requestedId: invite.requestedId
                });
            }
        }
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "add @user",
                    value: "Demander à @user si on peut écouter ses connexions vocales"
                },
                {
                    name: "add '@user1, @user2'",
                    value: "Demander à @user1 et @user2 si ou peut écouter leurs connexions vocales"
                },
                {
                    name: "remove @user1",
                    value: "Se désabonner de @user1"
                },
                {
                    name: "block @user",
                    value: "Ignorer les invitations de @user et l'empêcher de nous écouter"
                },
                {
                    name: "block @&role",
                    value: "Ignorer les invitations des membres du role @&role et les empêcher de nous écouter"
                },
                {
                    name: "unblock '@user1, @user2' @&role",
                    value: "Permettre à nouveau à @user1, @user2 et aux membdre du role @&role de nous écouter"
                },
                {
                    name: "stop",
                    value: "Cesser d'écouter les connexions au vocal"
                },
                {
                    name: "start",
                    value: "De nouveau écouter les connexions au vocal"
                },
                {
                    name: "limit 30sec",
                    value: "Attendre 30 secondes entre chaque notif (limit 0 pour remettre ce temps à 0) \nexemples pour time: 30s, 1h, 5m (unitées possibles : "+
                        Object.values(durationUnits).reduce((acc,units) => [
                            ...acc,
                            ...units
                        ], []).join(", ")+")"
                },
                {
                    name: "mute",
                    value: "Ne plus recevoir de notif pendant x temps"
                },
                {
                    name: "unmute",
                    value: "De nouveaux recevoir les notifs"
                },
                {
                    name: "status",
                    value: "Afficher toutes les infos vous concernant"
                },
                {
                    name: "status subs",
                    value: "Afficher les écoutes vous concernant"
                },
                {
                    name: "-h",
                    value: "Pour afficher l'aide"
                }
            ].map(field => ({
                name: config.command_prefix+this.commandName+" "+field.name,
                value: field.value
            })));
    }
}
