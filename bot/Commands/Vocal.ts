import Command from "../Classes/Command";
import {
    GuildMember, Interaction,
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    Role
} from "discord.js";
import config from "../config";
import VocalSubscribe, {IVocalSubscribe} from "../Models/VocalSubscribe";
import VocalConfig, {IVocalConfig} from "../Models/VocalConfig";
import VocalUserConfig, {IVocalUserConfig} from "../Models/VocalUserConfig";
import VocalInvite, {IVocalInvite} from "../Models/VocalInvite";
import client from "../client";
import {decomposeMsTime, showTime} from "../Classes/OtherFunctions";

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
                description: "L'action à effectuer : sub|add, unsub|remove, block|ghost, unsub|unghost, stop, start, limit, mute, unmute, status",
                valid: (field) => ['sub', 'add', 'unsub', 'remove', 'block', 'ghost', 'unblock', 'unghost', 'stop', 'start', 'limit', 'mute', 'unmute', 'status'].includes(field)
            },
            roles: {
                required: false,
                displayValidError: true,
                displayExtractError: true,
                type: "roles",
                description: "Le ou les roles à ignorer",
                valid: (roles: Role[]) => {
                    const alreadySpecified = {};
                    for (const role of roles) {
                        if (alreadySpecified[role.id])
                            return false;
                        alreadySpecified[role.id] = true
                    }
                    return true;
                },
                errorMessage: () => ({
                    name: "Roles mal rentrés",
                    value: "Vous avez mal renseigné vos roles. Vous ne pouvez pas renseigner plus d'une fois le même role"
                })
            },
            users: {
                required: (args) => args.help == undefined &&
                    (['sub', 'add', 'unsub', 'remove'].includes(args.action) || (['ghost', 'block', 'unghost', 'unblock'].includes(args.action) && args.roles == undefined)),
                displayValidError: true,
                displayExtractError: true,
                type: "users",
                description: "Le ou les utilisateurs à ignorer ou écouter quand ils se connectent sur un vocal",
                valid: (users: GuildMember[]) => {
                    const alreadySpecified = {};
                    for (const user of users) {
                        if (user.id === this.message.author.id || alreadySpecified[user.id])
                            return false;
                        alreadySpecified[user.id] = true
                    }
                    return true;
                },
                errorMessage: (value, args) => (value == undefined && args.channels == undefined && ['ghost', 'block', 'unghost', 'unblock'].includes(args.action)) ?
                    {
                        name: "Rentrez au moins l'un des deux",
                        value: "Vous devez avoir mentionné au moins un utilisateur ou un role."
                    } : {
                        name: "Utilisateurs non ou mal renseigné",
                        value: "Vous n'avez pas ou mal renseigné les utilisateurs.\n" +
                            "Vous ne pouvez pas vous renseignez vous même, ni renseigner plusieurs les mêmes personnes"
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

    async action(args: { help: boolean, action: string, users: GuildMember[], roles: Role[], time: number }) {
        const {help, action, roles, users, time} = args;

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
        if (['add', 'sub', 'remove', 'unsub'].includes(action) &&
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
            .setTitle("Resultat de la commande : ")
            .setDescription("Resultat de la commande : " + this.message.content)
            .setAuthor("Herma bot");

        if (['add', 'sub'].includes(action)) {
            const forbiddens: GuildMember[] = [];
            const inviteds: GuildMember[] = [];
            const alreadyInviteds: GuildMember[] = [];
            const alreadySubscribeds: GuildMember[] = [];

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

                inviteds.push(user);

                await Promise.all([
                    VocalInvite.create({
                        buttonId: acceptButtonId,
                        requesterId: this.message.author.id,
                        requestedId: user.id,
                        accept: true,
                        serverId: this.message.guild.id
                    }),
                    VocalInvite.create({
                        buttonId: denyButtonId,
                        requesterId: this.message.author.id,
                        requestedId: user.id,
                        accept: false,
                        serverId: this.message.guild.id
                    }),
                    user.send({
                        content: "<@" + this.message.author.id + "> souhaite pouvoir écouter vos connexions vocales sur le serveur '" + this.message.guild.name + "'",
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
                ]);
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
            if (!ownUserConfig.listening) {
                embed.addFields({
                    name: "Votre écoute est désactivée",
                    value: "Vous avez désactivé votre écoute, donc vous ne recevrez pas de notif"
                });
            }

            this.message.channel.send({embeds: [embed]});
            return true;

        }

        if (['unsub', 'remove'].includes(action)) {
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


        if (['block', 'ghost'].includes(action)) {
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

        if (['unblock', 'unghost'].includes(action)) {
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
                const listenedConfig: null|IVocalUserConfig = await VocalUserConfig.findOne({
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
            ownUserConfig.lastMute = new Date(Math.floor(Date.now()/1000)*1000);
            ownUserConfig.mutedFor = time

            this.message.channel.send("Vous ne recevrez plus de notification pendant"+showTime(decomposeMsTime(time)));

            ownUserConfig.save();
            return true;
        }

        if (action == 'unmute') {
            if (
                typeof(ownUserConfig.mutedFor) === "number" &&
                ownUserConfig.lastMute instanceof Date &&
                Date.now()-ownUserConfig.lastMute.getTime() < ownUserConfig.mutedFor
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

            const decomposedTime = decomposeMsTime(time);

            this.message.channel.send((decomposedTime.h+decomposedTime.m+decomposedTime.s === 0) ?
                "Il n'y aura maintenant aucun répit entre les notifications" :
                "Il y aura maintenant un répit de"+showTime(decomposedTime)+" entre chaque notification"
            );
            ownUserConfig.save();

            return true;
        }

        if (action == "status") {
            const now = Math.floor(Date.now()/1000)*1000;

            const muted = typeof(ownUserConfig.mutedFor) == "number" &&
                ownUserConfig.lastMute instanceof Date &&
                now-ownUserConfig.lastMute.getTime() < ownUserConfig.mutedFor;

            let sinceTimeMuted;
            let remaningTimeMuted;
            if (muted) {
                sinceTimeMuted = decomposeMsTime(now-ownUserConfig.lastMute.getTime());
                remaningTimeMuted = decomposeMsTime(ownUserConfig.mutedFor-now+ownUserConfig.lastMute.getTime());
            }
            embed.addFields({
                name: muted ? "Vous êtes mute" : "Vous n'est pas mute",
                value: muted ? "Vous êtes mute depuis"+showTime(sinceTimeMuted)+
                    ".\nIl reste"+showTime(remaningTimeMuted)+"." : "Vous n'êtes pas mute"
            });

            embed.addFields({
                name: "Répit entre chaque notifications : ",
                value: (ownUserConfig.limit >  0 ? "Vous avez"+showTime(decomposeMsTime(ownUserConfig.limit)) : "Vous n'avez pas")+
                    " de répit entre chaque notification"
            });

            embed.addFields({
                name: "Ecoute "+(ownUserConfig.listening ? "activée" : "désactivée"),
                value: "L'écoute est "+(ownUserConfig.listening ? "activée" : "désactivée")
            });

            if (ownUserConfig.blocked.users.length > 0) {
                embed.addFields({
                    name: "Les utilisateurs que vous avez bloqué",
                    value: ownUserConfig.blocked.users.map(userId => "<@"+userId+">").join("\n")
                });
            }
            if (ownUserConfig.blocked.roles.length > 0) {
                embed.addFields({
                    name: "Les roles que vous avez bloqué",
                    value: ownUserConfig.blocked.roles.map(userId => "<@&"+userId+">").join("\n")
                });
            }
            if (ownUserConfig.blocked.users.length+ownUserConfig.blocked.roles.length == 0) {
                embed.addFields({
                    name: "Blacklist vide",
                    value: "Vous n'avez bloqué aucun utilisateur ni aucun role"
                });
            }
            this.message.channel.send({embeds: [embed]});
            return true;
        }

        return false;
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
                } else if (invite.accept) {
                    const listenerConfig: IVocalUserConfig = await VocalUserConfig.findOne({serverId: server.id, listenerId: invite.requesterId});

                    await VocalSubscribe.create({
                        serverId: invite.serverId,
                        listenerId: invite.requesterId,
                        listenedId: invite.requestedId,
                        enabled: listenerConfig.listening
                    });
                    const requester = await server.members.fetch(invite.requesterId);
                    await requester.send("<@" + invite.requestedId + "> a accepté votre invitation sur '" + server.name + "'"+(!listenerConfig.listening ? " (Attention votre écoute n'est pas activée sur ce serveur)" : ""));
                    await interaction.editReply({content: "Invitation acceptée"});
                } else {
                    const requester = await server.members.fetch(invite.requesterId);
                    await requester.send("<@" + invite.requestedId + "> a refusé votre invitation sur '" + server.name + "'");
                    await interaction.editReply({content: "Invitation refusée"});
                }

                await VocalInvite.deleteMany({
                    serverId: invite.serverId,
                    requesterId: invite.requesterId,
                    requestedId: invite.requestedId
                });
            }
        }
    }

    help(Embed: MessageEmbed) {
        Embed.addFields({
            name: "Exemples :",
            value:
                config.command_prefix + this.commandName + " sub|add @user \nDemander à @user si on peut écouter ses connexions vocales\n\n" +
                config.command_prefix + this.commandName + " sub|add '@user1, @user2' \nDemander à @user1 et @user2 si ou peut écouter leurs connexions vocales\n\n" +
                config.command_prefix + this.commandName + " unsub|remove @user1 \nSe désabonner de @user1\n\n" +
                config.command_prefix + this.commandName + " block|ghost @user\nIgnorer les invitations de @user et l'empêcher de nous écouter\n\n" +
                config.command_prefix + this.commandName + " block|ghost @&role\nIgnorer les invitations des membres du role @&role et les empêcher de nous écouter\n\n" +
                config.command_prefix + this.commandName + " unblock|unghost '@user1, @user2' @&role\nPermettre à nouveau à @user1, @user2 et aux membdre du role @&role de nous écouter\n\n" +
                config.command_prefix + this.commandName + " stop \nCesser d'écouter les connexions au vocal\n\n" +
                config.command_prefix + this.commandName + " start \nDe nouveau écouter les connexions au vocal\n\n" +
                config.command_prefix + this.commandName + " limit 'time' \nAttendre un temps minimum entre chaque notif \nexemples pour time: 30s, 1h, 5m, 1j\n\n" +
                config.command_prefix + this.commandName + " mute 'time' \nNe plus recevoir de notif pendant x temps\n\n" +
                config.command_prefix + this.commandName + " unmute \nDe nouveaux recevoir les notifs\n\n" +
                config.command_prefix + this.commandName + " status \nAfficher toutes les infos vous concernant\n\n" +
                config.command_prefix + this.commandName + " -h \nPour afficher l'aide"
        });
    }
}
