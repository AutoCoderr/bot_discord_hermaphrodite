import Command from "../Classes/Command";
import {
    Guild,
    GuildChannel,
    GuildMember,
    Message,
    MessageEmbed,
    PartialGuildMember,
    Role, TextBasedChannels,
    TextChannel, User
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

    static display = true;
    static description = "Pour afficher en temps réel des infos relatives au serveur";
    static commandName = "monitor";

    static datasCanBeDisplayed = {
        userCount: {
            display: (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Nombre d'utilisateurs",
                    value: guild.memberCount.toString()
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
                    value: guild.maximumMembers ? guild.maximumMembers.toString() : "Infinity"
                });
            }
        },
        onlineUserCount: {
            display: async (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Nombre d'utilisateurs en ligne",
                    value: (await guild.members.fetch()).filter(member => member.presence != null && member.presence.status == "online").size.toString()
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
                        value: role.members.size.toString()
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
                    value: guild.emojis.cache.size.toString()
                });
            }
        },
        channelCount: {
            display: (guild: Guild, Embed: MessageEmbed) => {
                Embed.addFields({
                    name: "Nombre de channels",
                    value: guild.channels.cache.size.toString()
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
    static listeneds = {};

    static slashCommand = true;

    static argsModel = {

        $argsByType: {
            action: {
                isSubCommand: true,
                type: "string",
                description: "L'action à effectuer : Ajout de monitoring (add), Suppression de monitoring (remove), les afficher (show), rafraichir (refresh)",
                required: true,
                choices: {
                    add: "Ajouter un monitoring",
                    remove: "Supprimer un ou des monitoring",
                    show: "Afficher les monitoring",
                    refresh: "Rafraichir un ou des monitoring"
                }
            },
            channel: {
                referToSubCommands: ["add","remove","refresh"],
                type: "channel",
                description: "Le channel sur lequel monitorer le serveur",
                default: (_, command: Command) => command.channel,
                required: false,
                valid: (elem: GuildChannel, _) => elem.type == "GUILD_TEXT",
                errorMessage: (value, _) => {
                    if (value != undefined) {
                        return {
                            name: "Channel mentionné invalide",
                            value: "Vous ne pouvez mentionner que des channels de texte"
                        };
                    }
                    return {
                        name: "Channel non renseigné",
                        value: "Vous n'avez pas renseigné de channel"
                    }
                }
            },
            messages: {
                referToSubCommands: ["refresh","remove"],
                type: "message",
                multi: true,
                description: "L'id du message à supprimer ou rafraichir",
                required: (args) => ["refresh","remove"].includes(args.action),
                moreDatas: (args) => args.channel
            }
        },

        showUserCount: {
            referToSubCommands: ["add"],
            fields: ["-uc", "--user-count", "--show-user-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre d'utilisateurs",
            default: true,
            required: false
        },
        showDescription: {
            referToSubCommands: ["add"],
            fields: ["-d", "--description", "--show-description"],
            type: "boolean",
            description: "Pour afficher ou non la description",
            default: true,
            required: false
        },
        showIcon: {
            referToSubCommands: ["add"],
            fields: ["-i", "--icon", "--show-icon"],
            type: "boolean",
            description: "Pour afficher ou non l'icone",
            default: true,
            required: false
        },
        showOnlineUserCount: {
            referToSubCommands: ["add"],
            fields: ["-ouc", "--online-user-count", "--show-online-user-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre d'utilisateurs connectées",
            default: true,
            required: false
        },
        showMemberMax: {
            referToSubCommands: ["add"],
            fields: ["-mm", "--member-max", "--show-member-max"],
            type: "boolean",
            description: "Pour afficher ou non le nombre maximum de membres",
            default: false,
            required: false
        },
        showRoleMembersCount: {
            referToSubCommands: ["add"],
            fields: ["-rmc", "--role-members-count", "--show-role-members-count"],
            type: "roles",
            description: "Pour afficher le nombre de membres d'un/des rôles spécifiés (exemple: "+config.command_prefix+"monitor -rmc @moderateurs)",
            required: false
        },
        showEmojiCount: {
            referToSubCommands: ["add"],
            fields: ["-ec", "--emoji-count", "--show-emoji-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre d'emotes",
            default: false,
            required: false
        },
        showChannelCount: {
            referToSubCommands: ["add"],
            fields: ["-cc", "--channel-count", "--show-channel-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre de channels",
            default: false,
            required: false
        }
    }

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommand: null|string = null) {
        super(channel, member, guild, writtenCommand, Monitor.commandName, Monitor.argsModel);
    }

    async action(args: {action: string, channel: TextChannel, messages: Array<Message>}, bot) {
        const {action, channel, messages} = args;

        if (this.guild == null)
            return this.response(false,
                this.sendErrors({
                    name: "Datas missing",
                    value: "Nor guild nor member has been found"
                })
            );

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

                const createdMessage: Message = await channel.send({ embeds: [await Monitor.getMonitorMessage(this.guild, datasToDisplay)]});
                monitoringMessage = await MonitoringMessage.create({
                    serverId: this.guild.id,
                    datas: datasToDisplay,
                    channelId: channel.id,
                    messageId: createdMessage.id
                });
                Monitor.startMonitoringMessageEvent(monitoringMessage);
                return this.response(true, "Un message de monitoring a été créé sur le channel <#"+channel.id+">");
            case "refresh":
                for (const message of messages) {
                    monitoringMessage = await MonitoringMessage.findOne({
                        serverId: this.guild.id,
                        channelId: channel.id,
                        messageId: message.id
                    });
                    if (monitoringMessage == null) {
                        return this.response(false, "Il n'y a pas de monitoring sur le message "+message.id);
                    }
                    await message.edit({embeds: [await Monitor.getMonitorMessage(this.guild, monitoringMessage.datas)]});
                }

                return this.response(true, "Monitoring mis à jour");
            case "show":
                const channelsById = {};
                const monitoringMessages: Array<IMonitoringMessage> = await MonitoringMessage.find({
                    serverId: this.guild.id
                });
                if (monitoringMessages.length > 0) {
                    const Embeds = splitFieldsEmbed(25, await Promise.all(monitoringMessages.map(async monitoringMessage => {
                        if (channelsById[monitoringMessage.channelId] == undefined) { // @ts-ignore
                            channelsById[monitoringMessage.channelId] = this.guild.channels.cache.get(monitoringMessage.channelId);
                        }
                        const exist = await Monitor.checkMonitoringMessageExist(monitoringMessage, this.guild, channelsById[monitoringMessage.channelId]);
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
                    return this.response(true, Embeds.map(Embed => ({embeds: [Embed]})));
                }
                return this.response(true, "Il n'y a aucun monitoring sur ce serveur");
            case "remove":
                const responses: string[] = [];
                for (const message of messages) {
                    const res = await MonitoringMessage.deleteOne({
                        serverId: this.guild.id,
                        channelId: channel.id,
                        messageId: message.id
                    });
                    if (res.deletedCount > 0) {
                        await message.delete();
                        responses.push("Monitoring supprimé avec succès sur le message "+message.id);
                    } else {
                        responses.push("Il n'y a pas de monitoring sur le message "+message.id);
                    }
                }
                return this.response(true, responses.join("\n"));
        }
        return this.response(false, "Aucune action spécifiée");
    }

    static async checkMonitoringMessageExist(monitoringMessage: IMonitoringMessage, guild: null|undefined|Guild = null, channel: null|undefined|TextChannel = null) {
        if (guild == null) {
            guild = client.guilds.cache.get(monitoringMessage.serverId);
        }

        if (!channel && guild) {
            channel = <TextChannel>guild.channels.cache.get(monitoringMessage.channelId);
        }
        if (channel && channel.type != "GUILD_TEXT") channel = null

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
            await message.edit({embeds: [await this.getMonitorMessage(guild, monitoringMessage.datas)]});
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
        console.log("All monitorings listened");
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "add",
                    value: "Ajouter un monitoring (par défaut sur la channel courant)"
                },
                {
                    name: "add #unAutreChannelSurLequelMonitorer",
                    value: "Ajouter un monitoring sur le channel spécifié"
                },
                {
                    name: "add -ec -d false",
                    value: "Ajouter un moniroting avec le nombre d'émojis, sans la description"
                },
                {
                    name: "remove #leChannelSurLequelNePlusMonitorer idDuMessage",
                    value: "Retirer le monitoring sur le message spécifié dans le channel spécifié"
                },
                {
                    name: "remove idDuMessageDeMonitoring",
                    value: "Retire le moniting sur le message spéficié, sur le channel courant par défaut"
                },
                {
                    name: "refresh #leChannelSurLequelRefraichir idDuMessage",
                    value: "Rafraichir le monitoring sur la messagé spécifié dans le channel spécifié"
                },
                {
                    name: "refresh idDuMessageDeMonitoring",
                    value: "rafraichir le moniting sur le message spéficié, sur le channel courant par défaut"
                },
                {
                    name: "show",
                    value: "Afficher les monitoring en cours sur ce serveur"
                },
                {
                    name: "-h",
                    value: "Afficher l'aide"
                }
            ].map(field => ({
                name: config.command_prefix+this.commandName+" "+field.name,
                value: field.value
            })));
    }
}
