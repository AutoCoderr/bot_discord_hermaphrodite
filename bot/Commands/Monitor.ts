import Command from "../Classes/Command";
import {Guild, GuildChannel, Message, MessageEmbed, TextChannel} from "discord.js";
import config from "../config";

export default class Monitor extends Command {

    static datasCanBeDisplayed = {
        memberCount: (guild: Guild) => guild.memberCount,
        memberMax: (guild: Guild) => guild.maximumMembers,
        presenceCount: (guild: Guild) => guild.presences.cache.size,
        presenceMax: (guild: Guild) => guild.maximumPresences,
        emojiCount: (guild: Guild) => guild.emojis.cache.size,
        channelCount: (guild: Guild) => guild.channels.cache.size,
        description: (guild: Guild) => guild.description,
        icon: (guild: Guild) => guild.iconURL()
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
        showPresenceCount: {
            fields: ["-pc", "--presence-count", "--show-presence-count"],
            type: "boolean",
            description: "Pour afficher ou non le nombre de personnes connectées",
            required: false,
            default: false
        },
        showPresenceMax: {
            fields: ["-pm", "--presence-max", "--show-presence-max"],
            type: "boolean",
            description: "Pour afficher ou non le nombre maximum de personnes connectées",
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
                description: "L'action à effectuer : Ajout de monitoring (add), Suppression de monitoring (remove), les afficher (show)",
                required: (args) => args.help == undefined,
                type: "string",
                valid: (elem: string, _) => ["add","remove","show"].includes(elem)
            },
            {
                field: "channel",
                description: "Le channel sur lequel monitorer le serveur",
                required: (args) => ["add","remove"].includes(args.action),
                type: "channel",
                valid: (elem: GuildChannel, _) => elem.type = "text"
            }
        ]
    }

    async action(args: {help: boolean, action: string, channel: TextChannel}, bot) {
        const {help, action, channel} = args;

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
                const message = await channel.send(Monitor.getMonitorMessage(this.message.guild));
                this.message.channel.send("Un message a été créé sur le channel <#"+channel.id+">");
                return true;
            case "show":
                this.message.channel.send("Ceci est l'action show");
                return true;
            case "remove":
                this.message.channel.send("Ceci est l'action remove");
                return true;
        }
        return false;
    }

    static getMonitorMessage(guild: Guild) {
        return new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Serveur : '+guild.name)
            .setTimestamp()
            .addFields({
               name: "Nombre de membres",
               value: guild.memberCount
            });
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