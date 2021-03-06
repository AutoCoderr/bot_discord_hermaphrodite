import Command from "../Classes/Command";
import {
    Guild,
    GuildChannel,
    GuildMember,
    Message,
    MessageEmbed,
    PartialGuildMember,
    Role,
    TextChannel
} from "discord.js";
import config from "../config";
import MonitoringMessage, {IMonitoringMessage} from "../Models/MonitoringMessage";
import {splitFieldsEmbed} from "../Classes/OtherFunctions";
import client from "../client";

interface messageChannelAndGuild {
    message: Message;
    channel: TextChannel;
    guild: Guild
}

export default class Monitor extends Command {

    static listeneds = {};

    static datasCanBeDisplayed = {
        userCount: {
            display: (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Nombre d'utilisateurs",
                    value: guild.memberCount
                });
            },
            listen: (callback: Function) => {
                const listener = (member: GuildMember|PartialGuildMember) => callback(member.guild);
                client.on('guildMemberAdd', listener);
                client.on('guildMemberRemove', listener);
            }
        },
        memberMax: {
            display: (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Nombre maximum d'utilisateurs",
                    value: guild.maximumMembers
                });
            }
        },
        onlineUserCount: {
            display: async (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Nombre d'utilisateurs en ligne",
                    value: (await guild.members.fetch()).filter(member => member.presence.status == "online").size
                });
            },
            listen: (callback: Function) => {
                client.on('presenceUpdate',(oldPresence, newPresence) =>
                    (oldPresence && newPresence &&
                        (oldPresence.status == "online" || newPresence.status == "online") &&
                        oldPresence.status != newPresence.status)  && callback(newPresence.guild))
            }
        },
        roleMembersCount: {
            display: (guild: Guild, Embed: MessageEmbed, params: {roleId: string}) => {
                const {roleId} = params;
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    Embed.addFields({
                        name: "Nombre de membres du role @" + role.name,
                        value: role.members.size
                    });
                } else {
                    Embed.addFields({
                        name: "Membres du role "+roleId,
                        value: "Role introuvable"
                    })
                }
            },
            params: {roleId: (role: Role) => role.id}
        },
        emojiCount: {
            display: (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Nombre d'emotes",
                    value: guild.emojis.cache.size
                });
            }
        },
        channelCount: {
            display: (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Nombre de channels",
                    value: guild.channels.cache.size
                });
            }
        },
        description: {
            display: (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Description",
                    value: guild.description ?? "Aucune description"
                });
            }
        },
        icon: {
            display: (guild: Guild, Embed: MessageEmbed) => {
                if (typeof(guild.iconURL()) == "string") {
                    Embed.setImage(<string>guild.iconURL());
                } else {
                    Embed.addFields({
                        name: "Icône du serveur",
                        value: "Aucune icône"
                    });
                }
            }
        }
    };

    static nbListeners = Object.keys(Monitor.datasCanBeDisplayed).filter(data => typeof(Monitor.datasCanBeDisplayed[data].listen) == "function").length;

    static display = true;
    static description = "Pour afficher en temps réel des infos relatives au serveur";
    static commandName = "monitor";

    constructor(message: Message) {
        super(message, Monitor.commandName);
    }

    argsModel = {
        help: {
            fields: ["-h","--help"],
            type: "boolean",
            description: "Pour afficher l'aide",
            required: false
        },
        showUserCount: {
            fields: ["-uc", "--user-count", "--show-user-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre d'utilisateurs",
            default: true
        },
        showDescription: {
            fields: ["-d", "--description", "--show-description"],
            type: "boolean",
            description: "Pour afficher ou non la description",
            default: true
        },
        showIcon: {
            fields: ["-i", "--icon", "--show-icon"],
            type: "boolean",
            description: "Pour afficher ou non l'icone",
            default: true
        },
        showOnlineUserCount: {
            fields: ["-ouc", "--online-user-count", "--show-online-user-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre d'utilisateurs connectées",
            default: true
        },
        showMemberMax: {
            fields: ["-mm", "--member-max", "--show-member-max"],
            type: "boolean",
            description: "Pour afficher ou non le nombre maximum de membres",
            default: false
        },
        showRoleMembersCount: {
            fields: ["-rmc", "--role-members-count", "--show-role-members-count"],
            type: "roles",
            description: "Pour afficher le nombre de membres d'un ou de plusieurs rôles spécifiés (exemple: "+config.command_prefix+"monitor -rmc @moderateurs)",
            required: false
        },
        showEmojiCount: {
            fields: ["-ec", "--emoji-count", "--show-emoji-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre d'emotes",
            default: false
        },
        showChannelCount: {
            fields: ["-cc", "--channel-count", "--show-channel-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre de channels",
            default: false
        },

        $argsByType: {
            action: {
                type: "string",
                description: "L'action à effectuer : Ajout de monitoring (add), Suppression de monitoring (remove), les afficher (show), rafraichir (refresh)",
                required: (args) => args.help == undefined,
                valid: (elem: string, _) => ["add","remove","show","refresh"].includes(elem)
            },
            channel: {
                type: "channel",
                description: "Le channel sur lequel monitorer le serveur",
                default: this.message.channel,
                required: (args) => args.help == undefined && args.action != "show",
                valid: (elem: GuildChannel, _) => elem.type == "text"
            },
            messages: {
                type: "messages",
                description: "L'id du message à supprimer ou rafraichir",
                required: (args) => args.help == undefined && ["refresh","remove"].includes(args.action),
                moreDatas: (args) => args.channel
            }
        }
    }

    async action(args: {help: boolean, action: string, channel: TextChannel, messages: Array<Message>}, bot) {
        const {help, action, channel, messages} = args;

        if (help) {
            this.displayHelp();
            return false;
        }

        if (this.message.guild == null) {
            this.sendErrors({
                name: "Datas missing",
                value: "Nor message guild nor message membre has been found"
            });
            return false;
        }
        let monitoringMessage: IMonitoringMessage;
        switch (action) {
            case "add":
                let datasToDisplay: Array<string|{data: string, params: any}> = <Array<string|{data: string, params: any}>>Object.keys(Monitor.datasCanBeDisplayed).filter(attr =>
                    args["show"+attr[0].toUpperCase()+attr.substring(1)]
                ).map(attr => {
                    const argsData = args["show"+attr[0].toUpperCase()+attr.substring(1)]
                    if (Monitor.datasCanBeDisplayed[attr].params) {
                        if (argsData instanceof Array) {
                            return argsData.map(param => ({
                                data: attr,
                                params: Object.keys(Monitor.datasCanBeDisplayed[attr].params).reduce((acc, paramKey) => {
                                    acc[paramKey] = Monitor.datasCanBeDisplayed[attr].params[paramKey](param);
                                    return acc;
                                }, {})
                            }));
                        } else {
                            return {
                                data: attr,
                                params: Object.keys(Monitor.datasCanBeDisplayed[attr].params).reduce((acc, paramKey) => {
                                    acc[paramKey] = Monitor.datasCanBeDisplayed[attr].params[paramKey](argsData);
                                    return acc;
                                }, {})
                            }
                        }
                    } else {
                        return attr;
                    }
                });
                for (let i=0;i<datasToDisplay.length;i++) {
                    if (datasToDisplay[i] instanceof Array) {// @ts-ignore
                        datasToDisplay = [...datasToDisplay.slice(0,i), ...datasToDisplay[i], ...datasToDisplay.slice(i+1)];
                    }
                }

                const createdMessage: Message = await channel.send(await Monitor.getMonitorMessage(this.message.guild, datasToDisplay));
                monitoringMessage = await MonitoringMessage.create({
                    serverId: this.message.guild.id,
                    datas: datasToDisplay,
                    channelId: channel.id,
                    messageId: createdMessage.id
                });
                Monitor.startMonitoringMessageEvent(monitoringMessage);
                this.message.channel.send("Un message de monitoring a été créé sur le channel <#"+channel.id+">");
                return true;
            case "refresh":
                for (const message of messages) {
                    monitoringMessage = await MonitoringMessage.findOne({
                        serverId: this.message.guild.id,
                        channelId: channel.id,
                        messageId: message.id
                    });
                    if (monitoringMessage == null) {
                        this.message.channel.send("Il n'y a pas de monitoring sur le message "+message.id);
                    }
                    await message.edit(await Monitor.getMonitorMessage(this.message.guild, monitoringMessage.datas));
                }

                this.message.channel.send("Monitoring mis à jour");
                return true;
            case "show":
                const channelsById = {};
                const monitoringMessages: Array<IMonitoringMessage> = await MonitoringMessage.find({
                    serverId: this.message.guild.id
                });
                if (monitoringMessages.length > 0) {
                    const Embeds = splitFieldsEmbed(25, await Promise.all(monitoringMessages.map(async monitoringMessage => {
                        if (channelsById[monitoringMessage.channelId] == undefined) { // @ts-ignore
                            channelsById[monitoringMessage.channelId] = this.message.guild.channels.cache.get(monitoringMessage.channelId);
                        }
                        const exist = await Monitor.checkMonitoringMessageExist(monitoringMessage, this.message.guild, channelsById[monitoringMessage.channelId]);
                        return {
                            name: exist ? "Sur la channel #" + exist.channel.name : "Ce message et/ou ce salon n'existe plus",
                            value: exist ?
                                "Message " + exist.message.id + " ; Données : " + monitoringMessage.datas.map(data =>
                                    typeof(data) == "string" ?
                                        data :
                                        data.data+"("+Object.keys(data.params).reduce((acc, paramName, index) => {
                                            if (index > 0) acc += ", ";
                                            acc += paramName+": "+data.params[paramName];
                                            return acc;
                                        }, "")+")").join(", ")
                                : "Supprimé"
                        }
                    })), (Embed: MessageEmbed, partNb: number) => {
                        if (partNb == 1) {
                            Embed.setTitle("Les messages de monitoring")
                        }
                    });
                    for (const Embed of Embeds) {
                        this.message.channel.send(Embed);
                    }
                } else {
                    this.message.channel.send("Il n'y a aucun monitoring sur ce serveur");
                }

                return true;
            case "remove":
                for (const message of messages) {
                    const res = await MonitoringMessage.deleteOne({
                        serverId: this.message.guild.id,
                        channelId: channel.id,
                        messageId: message.id
                    });
                    if (res.deletedCount > 0) {
                        await message.delete();
                        this.message.channel.send("Monitoring supprimé avec succès sur le message "+message.id);
                    } else {
                        this.message.channel.send("Il n'y a pas de monitoring sur le message "+message.id);
                    }
                }
                return true;
        }
        return false;
    }

    static async checkMonitoringMessageExist(monitoringMessage: IMonitoringMessage, guild: null|undefined|Guild = null, channel: null|undefined|TextChannel = null) {
        if (guild == null) {
            guild = client.guilds.cache.get(monitoringMessage.serverId);
        }

        if (!channel && guild) {
            channel = <TextChannel>guild.channels.cache.get(monitoringMessage.channelId);
        }
        if (channel && channel.type != "text") channel = null

        let message: null | Message = null;
        if (channel) {
            try {
                message = await channel.messages.fetch(monitoringMessage.messageId);
            } catch (e) {
            }
        }
        if (message == null || channel == null || guild == null) {
            await MonitoringMessage.deleteOne({ // @ts-ignore
                serverId: monitoringMessage.serverId,
                channelId: monitoringMessage.channelId,
                messageId: monitoringMessage.messageId
            });
            return false;
        }
        return {message,channel,guild};
    }

    static async refreshMonitor(monitoringMessage: IMonitoringMessage, exist: false|messageChannelAndGuild = false) {
        if (!exist) {
            exist = await this.checkMonitoringMessageExist(monitoringMessage);
        }
        if (exist) {
            const {message, guild} = exist;
            await message.edit(await this.getMonitorMessage(guild,monitoringMessage.datas));
            return true;
        }
        return false;
    }

    static async getMonitorMessage(guild: Guild, datasToDisplay: Array<string|{data: string, params: any}>) {
        const Embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Serveur : '+guild.name)
            .setTimestamp();
        for (const data of datasToDisplay) {
            if (typeof(data) == "string") {
                await this.datasCanBeDisplayed[data].display(guild, Embed);
            } else {
                await this.datasCanBeDisplayed[data.data].display(guild, Embed, data.params);
            }
        }
        return Embed;
    }

    static startMonitoringMessageEvent(monitoringMessage: IMonitoringMessage) {
        if (Object.keys(this.listeneds).length == this.nbListeners) return;
        for (const data of monitoringMessage.datas) {
            const dataName = typeof(data) == "string" ? data : data.data;
            if (!this.listeneds[dataName] && typeof(this.datasCanBeDisplayed[dataName].listen) == "function") {
                this.listeneds[dataName] = true;
                this.datasCanBeDisplayed[dataName].listen(async (guild: Guild) => {
                    const monitoringMessages: Array<IMonitoringMessage> = await MonitoringMessage.find({
                        serverId: guild.id,
                        $or: [
                            {datas: dataName},
                            {"datas.data": dataName}
                        ]
                    });
                    for (const monitoringMessage of monitoringMessages) {
                        await this.refreshMonitor(monitoringMessage);
                    }
                });
            }
            if (Object.keys(this.listeneds).length == this.nbListeners) return;
        }
    }

    static async initAllEventListeners() {
        console.log("Init all monitoring event listeners");
        const monitoringMessages: Array<IMonitoringMessage> = await MonitoringMessage.find();
        for (const monitoringMessage of monitoringMessages) {
            const exist = await this.checkMonitoringMessageExist(monitoringMessage);
            if (exist) {
                this.startMonitoringMessageEvent(monitoringMessage);
                this.refreshMonitor(monitoringMessage,exist);
                if (Object.keys(this.listeneds).length == this.nbListeners) break;
            }
        }
        console.log("All listenings started");
    }

    help(Embed: MessageEmbed) {
        Embed.addFields({
            name: "Exemples :",
            value: config.command_prefix+this.commandName+" add (prend par défaut le channel de l'utilisateur)\n"+
                   config.command_prefix+this.commandName+" add #unAutreChannelSurLequelMonitorer\n"+
                   config.command_prefix+this.commandName+" add -ec -d false (avec le nombre d'emojis, sans la description)\n"+
                   config.command_prefix+this.commandName+" remove #leChannelSurLequelNePlusMonitorer idDuMessage\n"+
                   config.command_prefix+this.commandName+" remove idDuMessageDeMonitoring (sans channel spécifié, prend le channel courant)\n"+
                   config.command_prefix+this.commandName+" refresh #leChannelSurLequelRefraichir idDuMessage\n"+
                   config.command_prefix+this.commandName+" refresh idDuMessageDeMonitoring (sans channel spécifié, prend le channel courant)\n"+
                   config.command_prefix+this.commandName+" show\n"+
                   config.command_prefix+this.commandName+" -h\n"
        });
    }
}
