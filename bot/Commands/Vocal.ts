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
import VocalSubscribe from "../Models/VocalSubscribe";
import VocalConfig, {IVocalConfig} from "../Models/VocalConfig";
import VocalUserConfig, {IVocalUserConfig} from "../Models/VocalUserConfig";
import VocalInvite, {IVocalInvite} from "../Models/VocalInvite";
import client from "../client";

export default class Vocal extends Command {
    static display = true;
    static description = "Être alerté quand une ou plusieurs personnes se connectent à un ou plusieurs channels";
    static commandName = "vocal";

    constructor(message: Message) {
        super(message, Vocal.commandName);
    }

    argsModel = {
        help: { fields: ["-h","--help"], type: "boolean", required: false, description: "Pour afficher l'aide" },

        $argsByType: {
            action: {
                required: (args) => args.help == undefined,
                type: "string",
                description: "L'action à effectuer : sub|add, unsub|remove, block|ghost, unsub|unghost, stop, start, limit, mute, status",
                valid: (field) => ['sub','add','unsub','remove','block','ghost','unblock','unghost','stop','start','limit','mute','status'].includes(field)
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
                    (['sub','add','unsub','remove'].includes(args.action) || ( ['ghost','block','unghost','unblock'].includes(args.action) && args.roles == undefined)),
                displayValidError: true,
                displayExtractError: true,
                type: "users",
                description: "Le ou les utilisateurs à ignorer ou écouter quand ils se connectent sur un vocal",
                valid: (users: GuildMember[]) => {
                    const alreadySpecified = {};
                    for (const user of users) {
                        if (alreadySpecified[user.id])
                            return false;
                        alreadySpecified[user.id] = true
                    }
                    return true;
                },
                errorMessage: (value, args) => (value == undefined && args.channels == undefined && ['ghost','block','unghost','unblock'].includes(args.action)) ?
                        {
                            name: "Rentrez au moins l'un des deux",
                            value: "Vous devez avoir mentionné au moins un utilisateur ou un role."
                        } : {
                            name: "Utilisateurs non ou mal renseigné",
                            value: "Vous n'avez pas ou mal renseigné les utilisateurs"
                        }
            },
            time: {
                required: (args) => args.help == undefined && ["limit","mute"].includes(args.action),
                type: "duration",
                description: "Le temps durant lequel on souhaite ne pas recevoir de notif (ex: 30s, 5m, 3h, 2j)"
            }
        }
    }

    async action(args: {help: boolean, action: string, users: GuildMember[], roles: Role[], time: number}) {
        const {help, action, roles, users, time} = args;

        if (help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild === null) {
            this.sendErrors( {
                name: "Missing guild",
                value: "We couldn't find the message guild"
            });
            return false;
        }

        const vocalConfig: IVocalConfig = await VocalConfig.findOne({serverId: this.message.guild.id, enabled: true});
        if (vocalConfig == null) {
            this.sendErrors( {
                name: "Vocal désactivé",
                value: "Vous ne pouvez pas executer cette commande car l'option d'abonnement vocal n'est pas activée sur ce serveur"
            });
            return false;
        }
        if (['add','sub','remove','unsub'].includes(action) &&
            (vocalConfig.listenerBlacklist.users.includes(this.message.author.id) ||
            vocalConfig.listenerBlacklist.roles.some(roleId => this.message.member && this.message.member.roles.cache.some(role => role.id === roleId)))) {
            this.sendErrors( {
                name: "Accès interdit",
                value: "Vous n'avez visiblement pas le droit d'utiliser l'option d'abonnement vocal sur ce serveur"
            });
            return false;
        }

        const embed = new MessageEmbed()
            .setTitle("Resultat de la commande : ")
            .setDescription("Resultat de la commande : "+this.message.content)
            .setAuthor("Herma bot");

        if (['add','sub'].includes(action)) {
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

                const userConfig: null|IVocalUserConfig = await VocalUserConfig.findOne({
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
                const acceptButtonId = (Date.now()*10**4+Math.floor(Math.random()*10**4)).toString()+"a";
                const denyButtonId = (Date.now()*10**4+Math.floor(Math.random()*10**4)).toString()+"d";

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
                        content: "<@"+this.message.author.id+"> souhaite pouvoir écouter vos connexions vocales sur le serveur '"+this.message.guild.name+"'",
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
                    value: forbiddens.map(user => "<@"+user.id+">").join("\n")
                });
            if (alreadySubscribeds.length > 0)
                embed.addFields({
                    name: "Déjà écoutés  :",
                    value: alreadySubscribeds.map(user => "<@"+user.id+">").join("\n")
                });
            if (alreadyInviteds.length > 0)
                embed.addFields({
                    name: "Déjà invités :",
                    value: alreadyInviteds.map(user => "<@"+user.id+">").join("\n")
                });
            if (inviteds.length > 0)
                embed.addFields({
                    name: "Invités avec succès :",
                    value: inviteds.map(user => "<@"+user.id+">").join("\n")
                });

            this.message.channel.send({embeds: [embed]});
            return true;

        }

        if (['unsub','remove'].includes(action)) {
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
                    value: doesntExist.map(user => "<@"+user.id+">").join("\n")
                });
            if (deleted.length > 0)
                embed.addFields({
                    name: "Supprimés avec succès :",
                    value: deleted.map(user => "<@"+user.id+">").join("\n")
                });

            this.message.channel.send({embeds: [embed]});
            return true;
        }

        if (['block','ghost'].includes(action)) {
            let ownUserConfig: IVocalUserConfig|typeof VocalUserConfig= await VocalUserConfig.findOne({
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

            const alreadyBlocked: Array<GuildMember | Role> = [];
            const blocked: Array<GuildMember | Role> = [];
            const notFoundUsersId: string[] = [];

            if (users) {
                for (const user of users) {
                    if (ownUserConfig.blocked.users.includes(user.id)) {
                        alreadyBlocked.push(user);
                        continue;
                    }

                    blocked.push(user);

                    ownUserConfig.blocked.users.push(user.id);

                    await VocalSubscribe.updateMany({
                        serverId: this.message.guild.id,
                        listenerId: user.id,
                        listenedId: this.message.author.id
                    }, {
                        enabled: false
                    });
                }
            }


            if (roles) {
                const vocalSubscribes: Array<typeof VocalSubscribe> = await VocalSubscribe.find({
                    serverId: this.message.guild.id,
                    listened: this.message.author.id
                })
                for (const role of roles) {
                    if (ownUserConfig.blocked.roles.includes(role.id)) {
                        alreadyBlocked.push(role);
                        continue;
                    }

                    blocked.push(role);

                    ownUserConfig.blocked.roles.push(role.id);

                    for (const vocalSubscribe of vocalSubscribes) {
                        if (!vocalSubscribe.enabled) continue;
                        let user: GuildMember;
                        try {
                            user = await this.message.guild.members.fetch(vocalSubscribe.listenerId);
                        } catch (e) {
                            notFoundUsersId.push(vocalSubscribe.listenerId);
                            continue;
                        }

                        if (user.roles.cache.some(userRole => userRole.id === role.id)) {
                            vocalSubscribe.enabled = false;
                        }

                    }
                }
                Promise.all(vocalSubscribes.map(vocalSubscribe => vocalSubscribe.save()));
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
                    name: "Bloqué succèes : ",
                    value: blocked.map(elem => "<@" + (elem instanceof Role ? "&" : "") + elem.id + "> (" + (elem instanceof Role ? 'role' : 'user') + ")").join("\n")
                });

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
                    await VocalSubscribe.create({
                        serverId: invite.serverId,
                        listenerId: invite.requesterId,
                        listenedId: invite.requestedId,
                        enabled: true
                    });
                    const requester = await server.members.fetch(invite.requesterId);
                    await requester.send("<@" + invite.requestedId + "> a accepté votre invitation sur '"+server.name+"'");
                    await interaction.editReply({content: "Invitation acceptée"});
                } else {
                    const requester = await server.members.fetch(invite.requesterId);
                    await requester.send("<@" + invite.requestedId + "> a refusé votre invitation sur '"+server.name+"'");
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
                config.command_prefix+this.commandName+" sub|add @user \nDemander à @user si on peut écouter ses connexions vocales\n\n"+
                config.command_prefix+this.commandName+" sub|add '@user1, @user2' \nDemander à @user1 et @user2 si ou peut écouter leurs connexions vocales\n\n"+
                config.command_prefix+this.commandName+" unsub|remove @user1 \nSe désabonner de @user1\n\n"+
                config.command_prefix+this.commandName+" block|ghost @user\nIgnorer les invitations de @user et l'empêcher de nous écouter\n\n"+
                config.command_prefix+this.commandName+" block|ghost @&role\nIgnorer les invitations des membres du role @&role et les empêcher de nous écouter\n\n"+
                config.command_prefix+this.commandName+" unblock|unghost '@user1, @user2' @&role\nPermettre à nouveau à @user1, @user2 et aux membdre du role @&role de nous écouter\n\n"+
                config.command_prefix+this.commandName+" stop \nCesser d'écouter les connexions au vocal\n\n"+
                config.command_prefix+this.commandName+" start \nDe nouveau écouter les connexions au vocal\n\n"+
                config.command_prefix+this.commandName+" limit 'time' \nAttendre un temps minimum entre chaque notif \nexemples pour time: 30s, 1h, 5m, 1j\n\n"+
                config.command_prefix+this.commandName+" mute 'time' \nNe plus recevoir de notif pendant x temps\n\n"+
                config.command_prefix+this.commandName+" status \nAffichet toutes les infos vous concernant\n\n"+
                config.command_prefix+this.commandName+" -h \nPour afficher l'aide"
        });
    }
}
