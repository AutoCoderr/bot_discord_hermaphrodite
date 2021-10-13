import Command from "../Classes/Command";
import {GuildChannel, GuildMember, Message, MessageEmbed, VoiceChannel} from "discord.js";
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
                default: "subscribe",
                description: "L'action à effectuer : subscribe, info, clear, all, limit, mute, deny, accept",
                valid: (field) => ['subscribe','info','clear','all','limit','mute', 'deny', 'accept'].includes(field)
            },
            channels: {
                required: false,
                displayValidError: true,
                type: "channels",
                description: "Le ou les channels vocaux sur lesquels écouter",
                valid: (channels: GuildChannel[]) => {
                    const alreadySpecified = {};
                    for (const channel of channels) {
                        if (channel.type != "GUILD_VOICE" || alreadySpecified[channel.id])
                            return false;
                        alreadySpecified[channel.id] = true
                    }
                    return true;
                },
                errorMessage: () => ({
                    name: "Channels mal rentré",
                    value: "Vous avez mal renseigné vos channels. Ils ne peuvent être que des channels vocaux, et vous ne pouvez pas renseigner plus d'une fois le même channel"
                })
            },
            users: {
                required: (args) => args.help == undefined && args.action == "subscribe" && args.channels == undefined,
                type: "users",
                description: "Le ou les utilisateurs à écouter quand ils se connectent sur un vocal",
                valid: (users: GuildMember[]) => {
                    const alreadySpecified = {};
                    for (const user of users) {
                        if (alreadySpecified[user.id])
                            return false;
                        alreadySpecified[user.id] = true
                    }
                    return true;
                },
                errorMessage: (value, args) => (value == undefined && args.channels == undefined) ?
                        {
                            name: "Rentrez au moins l'un des deux",
                            value: "Vous devez avoir mentionné au moins un utilisateur ou un channel. Vous pouvez également utiliser l'action 'all'"
                        } : {
                            name: "Utilisateurs non ou mal renseigné",
                            value: "Vous n'avez pas ou mal renseigné "
                        }
            },
            time: {
                required: (args) => args.help == undefined && ["limit","mute"].includes(args.action),
                type: "duration",
                description: "Le temps durant lequel on souhaite ne pas recevoir de notif"
            }
        }
    }

    async action(args: {help: boolean, action: string, channels: VoiceChannel[], users: GuildMember[], time: number}) {
        const {help, action, channels, users, time} = args;

        if (help) {
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

        console.log(args);

        return false;

        /*const vocalConfig: IVocalConfig = await VocalConfig.findOne({serverId: this.message.guild.id, enabled: true});
        if (vocalConfig == null) {
            this.sendErrors( {
                name: "Vocal désactivé",
                value: "Vous ne pouvez pas executer cette commande car l'option d'abonnement vocal n'est pas activée sur ce serveur"
            });
            return false;
        }
        if (vocalConfig.listenerBlacklist.includes(this.message.author.id)) {
            this.sendErrors( {
                name: "Accès interdit",
                value: "Vous n'avez visiblement pas le droit d'utiliser l'option d'abonnement vocal sur ce serveur"
            });
            return false;
        }

        switch (action) {
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
                config.command_prefix+this.commandName+" @user1,@user2, #!channel1,#!channel2 \nS'abonner à channel1 et channel2, pour user1 et user2\n\n"+
                config.command_prefix+this.commandName+" #!channel1,#!channel2 \nS'abonner à channel1 et channel2 pour tout les users\n\n"+
                config.command_prefix+this.commandName+" @user1 \nS'abonner à user1 pour tout les channels\n\n"+
                config.command_prefix+this.commandName+" all \nS'abonner à tout les channels pour tous les users sur ce serveur\n\n"+
                config.command_prefix+this.commandName+" info \nVoir les abonnements vocaux\n\n"+
                config.command_prefix+this.commandName+" clear \nSe désinscrire de tous \n\n"+
                config.command_prefix+this.commandName+" limit 'time' \nAttendre un temps minimum entre chaque notif \nexemples pour time: 30s, 1h, 5m, 1j\n\n"+
                config.command_prefix+this.commandName+" mute 'time' \nNe plus recevoir de notif pendant x temps\n\n"+
                config.command_prefix+this.commandName+" deny \nEmpêcher les autres de nous écouter\n\n"+
                config.command_prefix+this.commandName+" accept \nAccepter que les autres nous écoutent\n\n"+
                config.command_prefix+this.commandName+" -h \nPour afficher l'aide"
        });
    }
}
