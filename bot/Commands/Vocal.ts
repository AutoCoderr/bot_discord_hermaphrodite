import Command from "../Classes/Command";
import {
    ActionRowBuilder, ButtonBuilder, EmbedBuilder,
    Guild,
    GuildMember,
    Role, StageChannel, User, VoiceChannel, VoiceState,
    ButtonStyle, PermissionFlagsBits, CommandInteraction, Message
} from "discord.js";
import config from "../config";
import VocalSubscribe, {IVocalSubscribe} from "../Models/Vocal/VocalSubscribe";
import VocalConfig, {defaultDelay, IVocalConfig, minimumLimit} from "../Models/Vocal/VocalConfig";
import VocalUserConfig, {IVocalUserConfig} from "../Models/Vocal/VocalUserConfig";
import VocalInvite, { VocalInviteTimeoutWithoutMessageId } from "../Models/Vocal/VocalInvite";
import {splitFieldsEmbed} from "../Classes/OtherFunctions";
import {
    extractUTCTime,
    extractTime,
    extractDate,
    durationUnits,
    showTime,
    showDate
} from "../Classes/DateTimeManager";
import {IArgsModel} from "../interfaces/CommandInterfaces";
import CustomError from "../logging/CustomError";
import reportError from "../logging/reportError";

export default class Vocal extends Command {
    static display = true;
    static description = "Être alerté quand une ou plusieurs personnes se connectent à un ou plusieurs channels";
    static commandName = "vocal";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel: IArgsModel = {
        $argsByType: {
            action: {
                isSubCommand: true,
                required: true,
                type: "string",
                description: "L'action à effectuer : add, remove, block, unblock, stop, start, limit, mute, unmute, status",
                choices: {
                    add: "Envoyer une demande d'écoute",
                    remove: "Supprimer une écoute en cours",
                    block: "Bloquer un/des utilisateurs et/ou un/des rôles pour les empêcher de vous écouter",
                    unblock: "Débloquer un/des utilisateurs et/ou un/des rôles",
                    stop: "Désactiver les notifications d'écoute",
                    start: "Réactiver les notification d'écoute",
                    limit: "Avoir un répit entre chaque notification (exemple de temps: 30s, 5min, 3j)",
                    mute: "Bloquer les notifications pendant un certain temps (exemple de temps: 30s, 5min, 3j)",
                    unmute: "Se démuter",
                    status: "Voir ses infos"
                }
            },
            subs: {
                referToSubCommands: ['status'],
                required: false,
                type: "boolean",
                description: "Obtenir plus de détails concernant les écoutes : subs"
            },
            roles: {
                referToSubCommands: ['block', 'unblock'],
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
                referToSubCommands: ['block', 'unblock', 'add', 'remove'],
                required: (args) =>
                    (['add', 'remove'].includes(args.action) || (['block', 'unblock'].includes(args.action) && args.roles instanceof Array && args.roles.length == 0)),
                displayValidErrorEvenIfFound: true,
                displayExtractError: true,
                type: "user",
                multi: true,
                description: "Le ou les utilisateurs à ignorer ou écouter quand ils se connectent sur un vocal",
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
                referToSubCommands: ['limit', 'mute'],
                required: (args) => ["limit", "mute"].includes(args.action),
                type: 'duration',
                description: "Le temps durant lequel on souhaite ne pas recevoir de notif (ex: 30s, 5m, 3h, 2j)",
                valid: (time, args) => (args.action === 'mute' && time > 0) ||
                    (args.action === 'limit' && time >= minimumLimit),
                errorMessage: (value,args) => ({
                    name: "Vous avez mal rentrez le temps",
                    ...(typeof(value) === "number" ?
                            {value: "Êtes vous sur qu'il est supérieur "+(args.action === 'limit' ? "ou égal à "+showTime(extractUTCTime(minimumLimit), 'fr') : "à 0")+" ?"} :
                            {value: "Vous n'avez pas respecté la syntaxe"}
                    )
                })
            }
        }
    }

    static usersWhoAreOnVocal: { [id: string]: {channel: VoiceChannel|StageChannel, timeout: null|NodeJS.Timeout} } = {};

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, Vocal.commandName, Vocal.argsModel);
    }

    async action(args: { action: string, subs: boolean, users: GuildMember[], roles: Role[], time: number }) {
        const {action, subs, roles, users, time} = args;

        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }


        const vocalConfig: IVocalConfig = await VocalConfig.findOne({serverId: this.guild.id, enabled: true});
        if (vocalConfig == null) {
            return this.response(false,
                this.sendErrors({
                    name: "Vocal désactivé",
                    value: "Vous ne pouvez pas executer cette commande car l'option d'abonnement vocal n'est pas activée sur ce serveur"
                })
            );
        }
        if ((vocalConfig.listenerBlacklist.users.includes(this.member.id) ||
                vocalConfig.listenerBlacklist.roles.some(roleId => this.member instanceof GuildMember && this.member.roles.cache.some(role => role.id === roleId)))) {
            return this.response(false,
                this.sendErrors({
                    name: "Accès interdit",
                    value: "Vous n'avez visiblement pas le droit d'utiliser l'option d'abonnement vocal sur ce serveur"
                })
            );
        }

        let ownUserConfig: IVocalUserConfig | typeof VocalUserConfig = await VocalUserConfig.findOne({
            serverId: this.guild.id,
            userId: this.member.id
        });

        if (ownUserConfig === null) {
            ownUserConfig = await VocalUserConfig.create({
                serverId: this.guild.id,
                userId: this.member.id,
                blocked: {users: [], roles: []},
                listening: true,
                limit: vocalConfig.defaultLimit
            });
        }

        const embed = new EmbedBuilder();

        if (action == 'add') {
            const hasNotVocal: GuildMember[] = [];
            const forbiddens: GuildMember[] = [];
            const inviteds: GuildMember[] = [];
            const alreadyInviteds: GuildMember[] = [];
            const alreadySubscribeds: GuildMember[] = [];
            const usersCantBeDM: GuildMember[] = [];

            for (const user of users) {
                const subscribe = await VocalSubscribe.findOne({
                    listenerId: this.member.id,
                    listenedId: user.id,
                    serverId: this.guild.id
                });

                if (subscribe !== null) {
                    alreadySubscribeds.push(user);
                    continue;
                }

                if (!(await Vocal.staticCheckPermissions(user, this.guild)) ||
                    vocalConfig.listenerBlacklist.users.includes(user.id) ||
                    user.roles.cache.some(role => vocalConfig.listenerBlacklist.roles.includes(role.id))) {

                    hasNotVocal.push(user);
                    continue;
                }

                const currentDate = new Date();
                await VocalInvite.deleteMany({
                    serverId: this.guild.id,
                    requesterId: this.member.id,
                    requestedId: user.id,
                    timestamp: {$lte: new Date(currentDate.getTime() - VocalInviteTimeoutWithoutMessageId)}
                });

                const invite = await VocalInvite.findOne({
                    serverId: this.guild.id,
                    requesterId: this.member.id,
                    requestedId: user.id
                });

                if (invite !== null) {
                    alreadyInviteds.push(user);
                    continue;
                }

                const userConfig: null | IVocalUserConfig = await VocalUserConfig.findOne({
                    serverId: this.guild.id,
                    userId: user.id
                });
                if (userConfig !== null &&
                    (
                        userConfig.blocked.users.includes(this.member.id) ||
                        userConfig.blocked.roles.some(roleId => this.member instanceof GuildMember && this.member.roles.cache.some(role => role.id === roleId))
                    )) {
                    forbiddens.push(user);
                    continue;
                }

                if (await Vocal.sendInvite(this.member, user, this.guild))
                    inviteds.push(user);
                else
                    usersCantBeDM.push(user);

            }
            if (forbiddens.length > 0)
                embed.addFields({
                    name: "Vous êtes bloqués par :",
                    value: forbiddens.map(user => "<@" + user.id + ">").join("\n")
                });
            if (hasNotVocal.length > 0)
                embed.addFields({
                    name: "Ces utilisateurs n'ont pas accès à la fonction vocal :",
                    value: hasNotVocal.map(user => "<@" + user.id + ">").join("\n")
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

            return this.response(true, {embeds: [embed]});
        }

        if (action == 'remove') {
            const doesntExist: GuildMember[] = [];
            const deleted: GuildMember[] = [];

            for (const user of users) {
                const vocalSubscribe: typeof VocalSubscribe = await VocalSubscribe.findOne({
                    serverId: this.guild.id,
                    listenerId: this.member.id,
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

            return this.response(true, {embeds: [embed]});
        }


        if (action == 'block') {
            const alreadyBlocked: Array<GuildMember | Role> = [];
            const blocked: Array<GuildMember | Role> = [];
            const notFoundUsersId: string[] = [];

            for (const [name, list] of Object.entries({users, roles})) {
                for (const elem of list) {
                    if (ownUserConfig.blocked[name].includes(elem.id)) {
                        alreadyBlocked.push(elem);
                        continue;
                    }

                    blocked.push(elem);

                    ownUserConfig.blocked[name].push(elem.id);
                }
            }

            const vocalSubscribes: Array<typeof VocalSubscribe | IVocalSubscribe> = await VocalSubscribe.find({
                serverId: this.guild.id,
                listenedId: this.member.id,
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
                    listener = await this.guild.members.fetch(vocalSubscribe.listenerId);
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

            return this.response(true, {embeds: [embed]});
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
                serverId: this.guild.id,
                listenedId: this.member.id,
                enabled: false
            });

            for (const vocalSubscribe of vocalSubscribes) {
                if (ownUserConfig.blocked.users.includes(vocalSubscribe.listenerId))
                    continue;

                const listenerConfig: null | IVocalUserConfig = await VocalUserConfig.findOne({
                    serverId: this.guild.id,
                    listenerId: vocalSubscribe.listenerId
                });
                if (listenerConfig != null && !listenerConfig.listening)
                    continue;

                let listener: GuildMember;
                try {
                    listener = await this.guild.members.fetch(vocalSubscribe.listenerId);
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

            return this.response(true, {embeds: [embed]});
        }

        if (action === "stop") {
            ownUserConfig.listening = false;
            ownUserConfig.save();

            await VocalSubscribe.updateMany({
                serverId: this.guild.id,
                listenerId: this.member.id,
                enabled: true
            }, {
                enabled: false
            });

            embed.addFields({
                name: "Ecoute désactivée",
                value: "Ecoute désactivée avec succès"
            });

            return this.response(true, {embeds: [embed]});
        }

        if (action === "start") {
            ownUserConfig.listening = true;
            ownUserConfig.save();

            const vocalSubscribes: Array<typeof VocalSubscribe | IVocalSubscribe> = await VocalSubscribe.find({
                serverId: this.guild.id,
                listenerId: this.member.id,
                enabled: false
            });

            for (const vocalSubscribe of vocalSubscribes) {
                const listenedConfig: null | IVocalUserConfig = await VocalUserConfig.findOne({
                    serverId: this.guild.id,
                    userId: vocalSubscribe.listenedId
                });

                if (listenedConfig !== null && (listenedConfig.blocked.users.includes(this.member.id) ||
                    (
                        this.member instanceof GuildMember &&
                        this.member.roles.cache.some(role => listenedConfig.blocked.roles.some(roleId => roleId === role.id))
                    ))
                ) continue

                vocalSubscribe.enabled = true;
                vocalSubscribe.save();
            }

            embed.addFields({
                name: "Ecoute activée",
                value: "Ecoute activée avec succès"
            });

            return this.response(true, {embeds: [embed]});
        }

        if (action === "mute") {
            ownUserConfig.lastMute = new Date(Math.floor(Date.now() / 1000) * 1000);
            ownUserConfig.mutedFor = time

            ownUserConfig.save();

            return this.response(true, "Vous ne recevrez plus de notification pendant" + showTime(extractUTCTime(time), 'fr_long'));
        }

        if (action == 'unmute') {
            if (
                typeof (ownUserConfig.mutedFor) === "number" &&
                ownUserConfig.lastMute instanceof Date &&
                Date.now() - ownUserConfig.lastMute.getTime() < ownUserConfig.mutedFor
            ) {
                ownUserConfig.lastMute = null;
                ownUserConfig.mutedFor = null;

                ownUserConfig.save();

                return this.response(true, "Vous pouvez de nouveau recevoir des notifications");
            }

            return this.response(false, "Vous n'êtes pas mute");
        }

        if (action == 'limit') {
            ownUserConfig.limit = time;
            ownUserConfig.save();

            return this.response(true,
                (time == 0) ?
                    "Il n'y aura maintenant aucun répit entre les notifications" :
                    "Il y aura maintenant un répit de" + showTime(extractUTCTime(time), 'fr_long') + " entre chaque notification"
            );
        }

        if (action == "status") {
            if (subs) {
                let embeds: EmbedBuilder[] = [];

                const subscribings: Array<IVocalSubscribe | typeof VocalSubscribe> = await VocalSubscribe.find({
                    serverId: this.guild.id,
                    listenerId: this.member.id
                })

                if (subscribings.length > 0) {
                    const subscribingsEmbeds = splitFieldsEmbed(15, await Promise.all(subscribings.map(async subscribe => {
                        let member: null | GuildMember = null;
                        try {
                            member = (await (<Guild>this.guild).members.fetch(subscribe.listenedId)) ?? null;
                        } catch (_) {
                            subscribe.remove();
                        }
                        return {
                            inline: false,
                            name: member ? (member.nickname ?? member.user.username) : 'Not found user (' + subscribe.listenedId + ')',
                            value: member ?
                                "Vous écoutez <@" + subscribe.listenedId + ">" + (!subscribe.enabled ? " (écoute désactivée)" : "") +
                                (subscribe.timestamp ? " depuis le "+showDate(extractDate(subscribe.timestamp), 'fr')+" à "+showTime(extractTime(subscribe.timestamp), 'fr') : '') :
                                    "N'est plus présent sur le serveur, écoute supprimée"
                        }
                    })), (embed: EmbedBuilder, nbPart) => {
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

                const subscribeds: Array<IVocalSubscribe | typeof VocalSubscribe> = await VocalSubscribe.find({
                    serverId: this.guild.id,
                    listenedId: this.member.id
                })

                if (subscribeds.length > 0) {
                    const subscribedsEmbeds = splitFieldsEmbed(15, await Promise.all(subscribeds.map(async subscribe => {
                        let member: null | GuildMember = null;
                        try {
                            member = (await (<Guild>this.guild).members.fetch(subscribe.listenerId)) ?? null;
                        } catch (_) {
                            subscribe.remove();
                        }
                        let muted = false;
                        if (member) {
                            const userConfig: IVocalUserConfig = await VocalUserConfig.findOne({
                                serverId: (<Guild>this.guild).id,
                                userId: subscribe.listenerId
                            })
                            muted = userConfig != null &&
                                typeof (userConfig.mutedFor) == "number" &&
                                userConfig.lastMute instanceof Date &&
                                Date.now() - userConfig.lastMute.getTime() < userConfig.mutedFor;
                        }
                        return {
                            inline: false,
                            name: member ? (member.nickname ?? member.user.username) : 'Not found user (' + subscribe.listenerId + ')',
                            value: member ? "<@" + subscribe.listenerId + "> vous écoute" +
                                (!subscribe.enabled ? " (écoute désactivée)" :
                                        muted ? " (il/elle est mute)" : ""
                                ) : "N'est plus présent sur le serveur, écoute supprimée"
                        }
                    })), (embed: EmbedBuilder, nbPart) => {
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
                return this.response(true, {embeds: subscribeds.length === 0 || subscribings.length === 0 ? [embed, ...embeds] : embeds})
            }

            let fieldLines: string[] = [];

            const now = Math.floor(Date.now() / 1000) * 1000;

            const muted = typeof (ownUserConfig.mutedFor) == "number" &&
                ownUserConfig.lastMute instanceof Date &&
                now - ownUserConfig.lastMute.getTime() < ownUserConfig.mutedFor;

            let sinceTimeMuted;
            let remaningTimeMuted;
            if (muted) {
                sinceTimeMuted = extractUTCTime(now - ownUserConfig.lastMute.getTime());
                remaningTimeMuted = extractUTCTime(ownUserConfig.mutedFor - now + ownUserConfig.lastMute.getTime());
            }

            fieldLines.push(muted ? "Vous êtes mute depuis" + showTime(sinceTimeMuted, 'fr_long') +
                ".\nIl reste" + showTime(remaningTimeMuted, 'fr_long') + "." : "Vous n'êtes pas mute");

            fieldLines.push((ownUserConfig.limit > 0 ? "Vous avez" + showTime(extractUTCTime(ownUserConfig.limit), 'fr_long') : "Vous n'avez pas") +
                " de répit entre chaque notification");

            fieldLines.push("L'écoute est " + (ownUserConfig.listening ? "activée" : "désactivée"));


            const nbSubscribings: number = await VocalSubscribe.count({
                serverId: this.guild.id,
                listenerId: this.member.id
            })

            fieldLines.push(nbSubscribings == 0 ?
                "Vous n'écoutez personne" :
                "Vous écoutez " + nbSubscribings + " personne(s), faites '" + config.command_prefix + this.commandName + " status subs' pour plus de détails");

            const nbSubscribeds: number = await VocalSubscribe.count({
                serverId: this.guild.id,
                listenedId: this.member.id
            })

            fieldLines.push(nbSubscribeds == 0 ?
                "Personne ne vous écoute" :
                "Vous êtes écouté par " + nbSubscribeds + " personne(s), faites '" + config.command_prefix + this.commandName + " status subs' pour plus de détails");

            if (ownUserConfig.blocked.users.length + ownUserConfig.blocked.roles.length == 0) {
                fieldLines.push("Vous n'avez bloqué aucun utilisateur ni aucun role");
            }

            embed.addFields({
                name: "Status :",
                value: '\n' +fieldLines.join("\n\n")
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
            return this.response(true, {embeds: [embed]});
        }

        return this.response(false, "Vous n'avez rentré aucune option");
    }

    static async sendInvite(requester: GuildMember | User, requested: GuildMember, guild: Guild): Promise<boolean> {
        const inviteId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "i";

        const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "a";
        const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "d";

        
        const message: null|Message = await requested.send({
            content: (requester instanceof GuildMember ? (requester.nickname ?? requester.user.username) : requester.username) + " souhaite pouvoir recevoir des notifications de vos connexions vocales sur le serveur '" + guild.name + "'",
            components: [ //@ts-ignore
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(acceptButtonId)
                        .setLabel("Accepter")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(denyButtonId)
                        .setLabel("Refuser")
                        .setStyle(ButtonStyle.Danger),
                )
            ]
        }).catch(() => null)

        if (message === null)
            return false;

        VocalInvite.create({
            inviteId,
            buttonId: acceptButtonId,
            messageId: message.id,
            requesterId: requester.id,
            requestedId: requested.id,
            timestamp: new Date(),
            accept: true,
            serverId: guild.id
        });
        VocalInvite.create({
            inviteId,
            buttonId: denyButtonId,
            messageId: message.id,
            requesterId: requester.id,
            requestedId: requested.id,
            timestamp: new Date(),
            accept: false,
            serverId: guild.id
        });
        return true;
    }

    static async listenVoiceChannelsConnects(oldState: VoiceState, newState: VoiceState) {
        if (oldState.channelId === newState.channelId || newState.member === null)
            return;

        if (newState.channelId === null || newState.channel === null) {
            if (Vocal.usersWhoAreOnVocal[newState.member.id] && Vocal.usersWhoAreOnVocal[newState.member.id].timeout !== null)
                clearTimeout(<NodeJS.Timeout>Vocal.usersWhoAreOnVocal[newState.member.id].timeout);
            delete Vocal.usersWhoAreOnVocal[newState.member.id];
            return;
        }

        if (
            Vocal.usersWhoAreOnVocal[newState.member.id] &&
            Vocal.usersWhoAreOnVocal[newState.member.id].timeout !== null
        )
            clearTimeout(<NodeJS.Timeout>Vocal.usersWhoAreOnVocal[newState.member.id].timeout);

        const vocalConfig: IVocalConfig = await VocalConfig.findOne({serverId: newState.guild.id, enabled: true});
        if (vocalConfig === null) return;

        if (vocalConfig.channelBlacklist.includes(newState.channelId)) return;

        const {channel} = newState;
        Vocal.usersWhoAreOnVocal[newState.member.id] = {
            channel: channel,
            timeout: setTimeout(async () => {
                try {
                    if (
                        newState.member === null ||
                        newState.channel === null ||
                        Vocal.usersWhoAreOnVocal[newState.member.id] === undefined ||
                        Vocal.usersWhoAreOnVocal[newState.member.id].channel.id !== channel.id ||
                        newState.channelId !== channel.id
                    )
                        return;

                    Vocal.usersWhoAreOnVocal[newState.member.id].timeout = null
        
                    const listened = newState.member;
        
                    const vocalSubscribes: IVocalSubscribe[] = await VocalSubscribe.find({
                        serverId: newState.guild.id,
                        listenedId: listened.id,
                        enabled: true
                    });
        
                    const allowedUsers: { [id: string]: boolean } = {};
        
                    for (const vocalSubscribe of vocalSubscribes) {
                        const {channel,channelId,member,guild} = newState;
                        if (guild === null || member?.id !== listened.id)
                            return;
                        if ([channel,channelId].some(elem => elem === null)) {
                            delete Vocal.usersWhoAreOnVocal[listened.id];
                            return;
                        }
                        if (channel.id !== Vocal.usersWhoAreOnVocal[listened.id].channel.id) {
                            Vocal.usersWhoAreOnVocal[listened.id].channel = channel;
                        }
        
                        if (Vocal.usersWhoAreOnVocal[vocalSubscribe.listenerId] && Vocal.usersWhoAreOnVocal[vocalSubscribe.listenerId].channel.id === channelId)
                            continue;
        
                        let listener: null | GuildMember = null;
                        try {
                            listener = await guild.members.fetch(vocalSubscribe.listenerId);
                        } catch (_) {
                        }
        
                        if (listener === null) {
                            await VocalSubscribe.deleteMany({
                                serverId: guild.id,
                                listenerId: vocalSubscribe.listenerId
                            });
                            await VocalUserConfig.deleteMany({
                                serverId: guild.id,
                                userId: vocalSubscribe.listenerId
                            })
                            continue;
                        }
        
                        const permissionsForListener = channel.permissionsFor(listener);
                        if (!permissionsForListener || !permissionsForListener.has(PermissionFlagsBits.ViewChannel))
                            continue;
        
                        if (allowedUsers[listener.id] === undefined)
                            allowedUsers[listener.id] = await Vocal.staticCheckPermissions(listener, guild);
                        if (!allowedUsers[listener.id])
                            continue;
        
                        if (allowedUsers[listened.id] === undefined)
                            allowedUsers[listened.id] = await Vocal.staticCheckPermissions(listened, guild);
                        if (!allowedUsers[listened.id])
                            continue;
        
                        let listenerConfig: IVocalUserConfig | typeof VocalUserConfig = await VocalUserConfig.findOne({
                            serverId: guild.id,
                            userId: vocalSubscribe.listenerId
                        });
        
                        if (listenerConfig === null) {
                            listenerConfig = await VocalUserConfig.create({
                                serverId: guild.id,
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
        
                        try {
                            await listener.send("'" + (member.nickname ?? member.user.username) + "' s'est connecté sur le channel vocal <#" + channel.id + "> sur le serveur '" + guild.name + "'");
                        } catch (_) {
                            continue;
                        }
        
                        if (listenerConfig.limit > 0) {
                            listenerConfig.lastMute = new Date(Math.floor(Date.now() / 1000) * 1000);
                            listenerConfig.mutedFor = listenerConfig.limit;
                            listenerConfig.save();
                        }
                    }
                } catch (e) {
                    reportError(new CustomError(<Error>e, {
                        from: "vocalNotifTimeout",
                        oldVoiceState: oldState,
                        newVoiceState: newState
                    }));
                }
                
            }, vocalConfig.delay ?? defaultDelay)
        }
    }

    help() {
        return new EmbedBuilder()
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
                    value: "Attendre 30 secondes entre chaque notif (limit 0 pour remettre ce temps à 0) \nexemples pour time: 30s, 1h, 5m (unitées possibles : " +
                        Object.values(durationUnits).reduce((acc, units) => [
                            ...acc,
                            ...units
                        ], []).join(", ") + ")"
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
                name: config.command_prefix + this.commandName + " " + field.name,
                value: field.value
            })));
    }
}
