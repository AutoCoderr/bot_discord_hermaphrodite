import Command from "../Classes/Command";
import {Guild, GuildChannel, Message, MessageEmbed, TextChannel} from "discord.js";
import config from "../config";
import MonitoringMessage, {IMonitoringMessage} from "../Models/MonitoringMessage";
import {splitFieldsEmbed} from "../Classes/OtherFunctions";
import client from "../client";

export default class Monitor extends Command {

    static datasCanBeDisplayed = {
        memberCount: (guild: Guild, Embed: MessageEmbed) => {
            Embed.addFields({
                name: "Nombre de membres",
                value: guild.memberCount
            });
        },
        memberMax: (guild: Guild, Embed: MessageEmbed) => {
            Embed.addFields({
                name: "Nombre maximum de membres",
                value: guild.maximumMembers
            });
        },
        onlineMemberCount: async (guild: Guild, Embed: MessageEmbed) => {
            Embed.addFields({
                name: "Nombre de membres en ligne",
                value: (await guild.members.fetch()).filter(member => member.presence.status == "online").size
            });
        },
        emojiCount: (guild: Guild, Embed: MessageEmbed) => {
            Embed.addFields({
                name: "Nombre d'emotes",
                value: guild.emojis.cache.size
            });
        },
        channelCount: (guild: Guild, Embed: MessageEmbed) => {
            Embed.addFields({
                name: "Nombre de channels",
                value: guild.channels.cache.size
            });
        },
        description: (guild: Guild, Embed: MessageEmbed) => {
            Embed.addFields({
                name: "Description",
                value: guild.description ?? "Aucune description"
            });
        },
        icon: (guild: Guild, Embed: MessageEmbed) => {
            Embed.addFields({
                name: "Icone",
                value: guild.iconURL() ?? "Aucune icone"
            });
        }
    }

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
        showMemberCount: {
            fields: ["-mc", "--member-count", "--show-member-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre de membres",
            required: false,
            default: true
        },
        showDescription: {
            fields: ["-d", "--description", "--show-description"],
            type: "boolean",
            description: "Pour afficher ou non la description",
            required: false,
            default: true
        },
        showIcon: {
            fields: ["-i", "--icon", "--show-icon"],
            type: "boolean",
            description: "Pour afficher ou non l'icone",
            required: false,
            default: true
        },
        showMemberMax: {
            fields: ["-mm", "--member-max", "--show-member-max"],
            type: "boolean",
            description: "Pour afficher ou non le nombre maximum de membres",
            required: false,
            default: false
        },
        showOnlineMemberCount: {
            fields: ["-omc", "--online-member-count", "--show-online-member-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre de personnes connectées",
            required: false,
            default: false
        },
        showEmojiCount: {
            fields: ["-ec", "--emoji-count", "--show-emoji-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre d'emotes",
            required: false,
            default: false
        },
        showChannelCount: {
            fields: ["-cc", "--channel-count", "--show-channel-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre de channels",
            required: false,
            default: false
        },

        $argsWithoutKey: [
            {
                field: "action",
                description: "L'action à effectuer : Ajout de monitoring (add), Suppression de monitoring (remove), les afficher (show), rafraichir (refresh)",
                required: (args) => args.help == undefined,
                type: "string",
                valid: (elem: string, _) => ["add","remove","show","refresh"].includes(elem)
            },
            {
                field: "channel",
                description: "Le channel sur lequel monitorer le serveur",
                required: (args) => args.help == undefined && ["add","remove","refresh"].includes(args.action),
                type: "channel",
                valid: (elem: GuildChannel, _) => elem.type = "text",
                default: this.message.channel
            },
            {
                field: "message",
                description: "L'id du message à supprimer ou rafraichir",
                type: "message",
                required: (args) => args.help == undefined && ["remove","refresh"].includes(args.action),
                moreDatas: (args) => args.channel
            }
        ]
    }

    async action(args: {help: boolean, action: string, channel: TextChannel, message: Message}, bot) {
        const {help, action, channel, message} = args;

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

        switch (action) {
            case "add":
                const datasToDisplay: Array<string> = [];
                for (const attr in Monitor.datasCanBeDisplayed) {
                    if (args["show"+attr[0].toUpperCase()+attr.substring(1)]) {
                        datasToDisplay.push(attr);
                    }
                }
                const createdMessage: Message = await channel.send(await Monitor.getMonitorMessage(this.message.guild, datasToDisplay));
                await MonitoringMessage.create({
                    serverId: this.message.guild.id,
                    datas: datasToDisplay,
                    channelId: channel.id,
                    messageId: createdMessage.id
                });
                this.message.channel.send("Un message de monitoring a été créé sur le channel <#"+channel.id+">");
                return true;
            case "refresh":
                const monitoringMessage: IMonitoringMessage = await MonitoringMessage.findOne({
                    serverId: this.message.guild.id,
                    channelId: channel.id,
                    messageId: message.id
                });
                if (monitoringMessage == null) {
                    this.message.channel.send("Il n'y a pas de monitoring sur ce message");
                    return false;
                }
                await message.edit(await Monitor.getMonitorMessage(this.message.guild,monitoringMessage.datas));
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
                            value: exist ? "Message " + exist.message.id + " ; Données : " + monitoringMessage.datas.join(", ") : "Supprimé"
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
                const res = await MonitoringMessage.deleteOne({
                    serverId: this.message.guild.id,
                    channelId: channel.id,
                    messageId: message.id
                });
                if (res.deletedCount > 0) {
                    await message.delete();
                    this.message.channel.send("Monitoring supprimé aves succès");
                    return true;
                } else {
                    this.message.channel.send("Il n'y a pas de monitoring sur ce message");
                    return false;
                }
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

    static async refreshMonitor(monitoringMessage: IMonitoringMessage) {
        const exist = await this.checkMonitoringMessageExist(monitoringMessage);
        if (exist) {
            const {message, guild} = exist;
            await message.edit(await this.getMonitorMessage(guild,monitoringMessage.datas));
            return true;
        }
        return false;
    }

    static async getMonitorMessage(guild: Guild, datasToDisplay: Array<string>) {
        const Embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Serveur : '+guild.name)
            .setTimestamp();
        for (const data of datasToDisplay) {
            await this.datasCanBeDisplayed[data](guild, Embed);
        }
        return Embed;
    }

    help(Embed: MessageEmbed) {
        Embed.addFields({
            name: "Exemples :",
            value: config.command_prefix+this.commandName+" add #leChannelSurLequelMonitorer\n"+
                   config.command_prefix+this.commandName+" remove #leChannelSurLequelNePlusMonitorer idDuMessageDeMonitoring\n"+
                   config.command_prefix+this.commandName+" show\n"+
                   config.command_prefix+this.commandName+" -h\n"
        });
    }
}
