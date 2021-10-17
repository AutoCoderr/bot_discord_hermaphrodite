import Command from "../Classes/Command";
import {GuildChannel, GuildMember, Message, MessageEmbed, Role, VoiceChannel} from "discord.js";
import config from "../config";
import VocalSubscribe from "../Models/VocalSubscribe";
import VocalConfig, {IVocalConfig} from "../Models/VocalConfig";

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

    async action(args: {help: boolean, action: string, channels: VoiceChannel[], users: GuildMember[], time: number}) {
        const {help, action, channels, users, time} = args;

        console.log(args);

        this.message.channel.send("TEST");
        return false;

        /*if (help) {
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

        const vocalConfig: IVocalConfig = await VocalConfig.findOne({serverId: this.message.guild.id, enabled: true});
        if (vocalConfig == null) {
            this.sendErrors( {
                name: "Vocal désactivé",
                value: "Vous ne pouvez pas executer cette commande car l'option d'abonnement vocal n'est pas activée sur ce serveur"
            });
            return false;
        }
        if (vocalConfig.listenerBlacklist.users.includes(this.message.author.id) ||
            vocalConfig.listenerBlacklist.roles.some(roleId => this.message.member && this.message.member.roles.cache.some(role => role.id === roleId))) {
            this.sendErrors( {
                name: "Accès interdit",
                value: "Vous n'avez visiblement pas le droit d'utiliser l'option d'abonnement vocal sur ce serveur"
            });
            return false;
        }
        return false;*/

        /*switch (action) {
            case 'subscribe':
                const addeds: typeof VocalSubscribe[] = [];
                const deleteds: typeof VocalSubscribe[] = [];
                const forbiddens: { [id: string]: boolean } = {};
                const forbiddensToDisplay: { [id: string]: VoiceChannel|GuildMember } = {};

                if (channels && users) {
                    const alreadyAll: { [id: string]: VoiceChannel|GuildMember } = {};

                    for (const channel of channels) {
                        const allSubscribe = await VocalSubscribe.findOne({
                            serverId: this.message.guild.id,
                            channelId: channel.id,
                            listenedId: 'all',
                            listenerId: this.message.author.id
                        });
                        if (allSubscribe !== null) {
                            alreadyAll[channel.id] = channel;
                            continue;
                        }

                        if (forbiddens[channel.id] === undefined) {
                            forbiddens[channel.id] = vocalConfig.channelBlacklist.includes(channel.id);
                        }
                        for (const user of users) {
                            if (alreadyAll[user.id]) continue;
                            const allSubscribe = await VocalSubscribe.findOne({
                                serverId: this.message.guild.id,
                                channelId: 'all',
                                listenedId: user.id,
                                listenerId: this.message.author.id
                            });
                            if (allSubscribe !== null) {
                                alreadyAll[user.id] = user;
                                continue;
                            }

                            if (forbiddens[user.id] === undefined) {
                                forbiddens[user.id] = vocalConfig.listenableBlacklist.includes(user.id);
                            }
                            let subscribe: typeof VocalSubscribe = await VocalSubscribe.findOne({
                                serverId: this.message.guild.id,
                                channelId: channel.id,
                                listenedId: user.id,
                                listenerId: this.message.author.id
                            });

                            if (subscribe !== null) {
                                subscribe.delete();
                                deleteds.push({channel,user});
                            } else  if (!forbiddens[user.id] && !forbiddens[channel.id]) {
                                VocalSubscribe.create({
                                    serverId: this.message.guild.id,
                                    channelId: channel.id,
                                    listenedId: user.id,
                                    listenerId: this.message.author.id
                                });
                                addeds.push({channel,user});
                            } else {
                                if (forbiddens[user.id])
                                    forbiddensToDisplay[user.id] = user

                                if (forbiddens[channel.id])
                                    forbiddensToDisplay[channel.id] = channel
                            }
                        }
                    }
                } else {
                    for (const elem of (channels??users)) {
                        forbiddens[elem.id] = channels ? vocalConfig.channelBlacklist.includes(elem.id) : vocalConfig.listenableBlacklist.includes(elem.id);

                        const subscribe = await VocalSubscribe.findOne({
                            serverId: this.message.guild.id,
                            channelId: channels ? elem.id : 'all',
                            listenedId: users ? elem.id : 'all',
                            listenerId: this.message.author.id
                        });
                        if (subscribe !== null) {
                            subscribe.delete();
                            deleteds.push({channel: channels ? elem : 'all', user: users ? elem : 'all'});
                        } else if (!forbiddens[elem.id]) {
                            VocalSubscribe.deleteMany({
                                serverId: this.message.guild.id,
                                ...(channels ? {channelId: elem.id} : {listenedId: elem.id}),
                                listenerId: this.message.author.id
                            });
                            VocalSubscribe.create({
                                serverId: this.message.guild.id,
                                channelId: channels ? elem.id : 'all',
                                listenedId: users ? elem.id : 'all',
                                listenerId: this.message.author.id
                            })
                            addeds.push({channel: channels ? elem : 'all', user: users ? elem : 'all'});
                        } else
                            forbiddensToDisplay[elem.id] = elem;
                    }
                }
        }

        return false;*/
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
