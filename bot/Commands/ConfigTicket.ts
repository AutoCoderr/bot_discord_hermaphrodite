import Command from "../Classes/Command";
import config from "../config";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";
import Discord, {CategoryChannel, GuildChannel, GuildEmoji, GuildMember, Message, TextChannel} from "discord.js";

export default class ConfigTicket extends Command {

    argsModel = {
        help: { fields: ["-h","--help"], type: "boolean", required: false, description: "Pour afficher l'aide" },
        allListen: {fields: ['-a','--all'], type: "boolean", required: false, description: "Pour viser toutes les écoutes de message"},

        $argsByType: {
            action: {
                required: args => args.help == undefined,
                type: "string",
                description: "L'action à effectuer : set, show, disable, enable, listen ou blacklist",
                valid: (elem,_) => ['set','show','disable','enable','listen','blacklist'].includes(elem)
            },
            category: {
                required: args => args.help == undefined && args.action == "set",
                type: "category",
                description: "L'id de la catégorie à définir avec 'set'"
            },
            subAction: {
                required: args => args.help == undefined && ["blacklist","listen"].includes(args.action),
                type: "string",
                description: "L'action à effectuer",
                valid: (elem,_) => ['add','remove','show'].includes(elem)
            },
            user: {
                required: args => args.help == undefined && args.action == "blacklist" && ['add','remove'].includes(args.actionBlacklist),
                type: "user",
                description: "L'utilisateur à ajouter ou retirer de la blacklist"
            },
            channelListen: {
                required: args => args.help == undefined && args.subAction == "add" || (args.subAction == "remove" && !args.allListen),
                type: "channel",
                description: "Le channel sur lequel ajouter, retirer, ou afficher les écoutes de réaction",
                valid: (elem: GuildChannel,_) => elem.type == "text"
            },
            emoteListen: {
                required: args => args.help == undefined && args.subAction == "add",
                type: "emote",
                description: "L'emote sur l'aquelle ajouter ou retirer une écoute de réaction"
            },
            messageListen: {
                required: args => args.help == undefined && args.subAction == "add" || (args.subAction == "remove" && args.emoteListen != undefined),
                type: "message",
                description: "L'id du message sur lequel ajouter, retirer, ou afficher les écoutes de réaction",
                moreDatas: args => args.channelListen
            }
        },
    }

    static display = true;
    static description = "Pour définir la catégorie pour les channels des tickets, activer, ou désactiver les ticket.";
    static commandName = "configTicket";

    constructor(message: Message) {
        super(message, ConfigTicket.commandName);
    }

    async action(args: {help: boolean, action: string, category: CategoryChannel, subAction: string, user: GuildMember, channelListen: TextChannel, messageListen: Message, emoteListen: GuildEmoji|string}, bot) {
        const {help, action, category, subAction, user, channelListen, messageListen, emoteListen} = args;

        if (help) {
            this.displayHelp();
            return false;
        }


        if (this.message.guild == null || this.message.member == null) {
            this.sendErrors({
                name: "Datas missing",
                value: "Nor message guild nor message membre has been found"
            });
            return false;
        }

        let ticketConfig: ITicketConfig;

        switch(action) {
            case "set":
                ticketConfig = await TicketConfig.findOne({serverId: this.message.guild.id});
                let toEnable = false;
                if (ticketConfig == null) {
                    toEnable = true;
                    ticketConfig = {
                        enabled: true,
                        categoryId: category.id,
                        serverId: this.message.guild.id,
                        blacklist: [],
                        messagesToListen: []
                    }
                    TicketConfig.create(ticketConfig);
                } else {
                    if (ticketConfig.categoryId == null)  {
                        toEnable = true;
                        ticketConfig.enabled = true;
                    }
                    ticketConfig.categoryId = category.id; // @ts-ignore
                    ticketConfig.save();
                }
                this.message.channel.send("Ce sera dorénavant dans la catégorie '"+category.name+"' que seront gérés les tickets"+
                    (toEnable ?  "\n(La fonctionnalité des tickets a été activée)" : ""));
                return true;
            case "show":
                ticketConfig = await TicketConfig.findOne({serverId: this.message.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    this.message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie")
                } else {
                    const category = this.message.guild.channels.cache.get(<string>ticketConfig.categoryId);
                    if (category == undefined) {
                        this.message.channel.send("On dirait que la catégorie que vous aviez définie n'existe plus, vous pouvez la redéfinir avec : " + config.command_prefix + this.commandName + " set idDeLaCategorie");
                    } else {
                        this.message.channel.send("Catégorie utilisée pour les tickets : " + category.name);
                    }
                }
                return true;
            case "disable":
                ticketConfig = await TicketConfig.findOne({serverId: this.message.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    this.message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie")
                } else {
                    ticketConfig.enabled = false; // @ts-ignore
                    ticketConfig.save();
                    this.message.channel.send("La fonctionalité des tickets a été désactivée.");
                }
                return true;
            case "enable":
                ticketConfig = await TicketConfig.findOne({serverId: this.message.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    this.message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie")
                } else {
                    ticketConfig.enabled = true; // @ts-ignore
                    ticketConfig.save();
                    this.message.channel.send("La fonctionalité des tickets a été activée. \nFaite '"+config.command_prefix+this.commandName+" show ' pour voir le nom de la catégorie dans laquelle apparaitrons les tickets");
                }
                return true;
            case "listen":
                ticketConfig = await TicketConfig.findOne({serverId: this.message.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    this.message.channel.send("On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie");
                    return false;
                }
                switch (subAction) {
                    case "add":
                        const emote = emoteListen instanceof GuildEmoji ? emoteListen.name : emoteListen;
                        if (!(ticketConfig.messagesToListen instanceof Array)) ticketConfig.messagesToListen = [];
                        if (ticketConfig.messagesToListen.find(message =>
                            message.channelId == channelListen.id &&
                            message.messageId == messageListen.id &&
                            message.emoteName == emote)) {

                            this.message.channel.send("Il y a déjà une écoute de réaction pour création de ticket sur ce message avec cette emote");
                            return false;
                        }
                        ticketConfig.messagesToListen.push({channelId: channelListen.id, messageId: messageListen.id, emoteName: emote}); // @ts-ignore
                        ticketConfig.save();
                        this.message.channel.send("Une écoute a été activée sur ce message pour la création de ticket");
                }
                return false;
            case "blacklist":
                switch(subAction) {
                    case "add":
                        return this.addUserToBlackList(this.message.guild.id,user.id);

                    case "remove":
                        return this.removeUserFromBlackList(this.message.guild.id,user.id);

                    case "show":
                        return this.showUsersInBlackList(bot, this.message.guild.id);
                }
        }
        return false;
    }

    async addUserToBlackList(serverId, userId) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});
        if (ticketConfig == null) {
            ticketConfig = {
                enabled: false,
                categoryId: null,
                blacklist: [userId],
                serverId: serverId,
                messagesToListen: []
            }
            TicketConfig.create(ticketConfig);
        } else {
            if (ticketConfig.blacklist.includes(userId)) {
                this.message.channel.send("Il semblerait que cet utilisateur se trouve déjà dans la blacklist");
                return true;
            }

            ticketConfig.blacklist.push(userId);// @ts-ignore
            ticketConfig.save();
        }
        this.message.channel.send("L'utilisateur a été ajouté avec succès à la blacklist !");
        return true;
    }

    async removeUserFromBlackList(serverId, userId) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});

        if (ticketConfig == null || !ticketConfig.blacklist.includes(userId)) {
            this.message.channel.send("Il semblerait que l'utilisateur ne se trouve pas dans la blacklist");
            return true;
        }
        let list = ticketConfig.blacklist ;
        for (let i=0;i<list.length;i++) {
            if (list[i] == userId) {
                list.splice(i,1);
                break;
            }
        } // @ts-ignore
        ticketConfig.save();

        this.message.channel.send("L'utilisateur a été retiré avec succès de la blacklist !");
        return true;
    }

    async showUsersInBlackList(bot, serverId) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});

        let Embeds = [new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle("Les utilisateurs de la blacklist :")
            .setDescription("Liste des utilisateurs de la blacklist")
            .setTimestamp()];

        if (ticketConfig == null || ticketConfig.blacklist.length == 0) {
            Embeds[0].addFields({
                name: "Aucun utilisateur",
                value: "Il n'y a aucun utilisateur dans la blacklist"
            });
        } else {
            const list = ticketConfig.blacklist;
            let users: Array<any> = [];

            for (const userId of list) {
                try { // @ts-ignore
                    const user = await this.message.guild.members.fetch(userId);
                    users.push({username: user.nickname ?? user.user.username, id: user.id});
                } catch(e) {
                    users.push({username: "unknown", id: userId});
                }
            }
            users.sort((user1: any, user2: any) => {
                if (user1.username == "unknown") return -1;
                if (user2.username == "unknown") return 1;
                return user1.username.toLowerCase() > user2.username.toLowerCase() ? 1 : -1;
            });

            const linePerMessage = 5;
            const userDisplayedPerLine = 10;

            for  (let msg=0; msg*linePerMessage*userDisplayedPerLine < users.length; msg ++) {
                if (msg > 0) {
                    Embeds.push(new Discord.MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle("Les utilisateurs de la blacklist (Partie "+(msg+1)+") :")
                        .setDescription("Liste des utilisateurs de la blacklist")
                        .setTimestamp());
                }
                let Embed = Embeds[Embeds.length-1];
                for (let line = 0; line < linePerMessage && msg*linePerMessage*userDisplayedPerLine + line*userDisplayedPerLine < users.length; line++) {
                    let usersNames: Array<string> = [];
                    for (let userIndex=0;userIndex < userDisplayedPerLine && msg*linePerMessage*userDisplayedPerLine + line*userDisplayedPerLine + userIndex < users.length;userIndex++) {
                        const user = users[msg*linePerMessage*userDisplayedPerLine + line*userDisplayedPerLine + userIndex];
                        usersNames.push("@"+(user != null ? user.username : "unknown")+"("+user.id+")");
                    }
                    Embed.addFields({
                        name: "Les utilisateurs :",
                        value: usersNames.join(", ")
                    });
                }
            }
        }
        for (let Embed of Embeds) {
            this.message.channel.send(Embed);
        }
        return true;
    }

    help(Embed) {
        Embed.addFields({
            name: "Exemples :",
            value: config.command_prefix+this.commandName+" set 475435899654125637\n"+
                   config.command_prefix+this.commandName+" show\n"+
                   config.command_prefix+this.commandName+" enable\n"+
                   config.command_prefix+this.commandName+" disable\n"+
                   config.command_prefix+this.commandName+" blacklist add @unUtilisateur\n"+
                   config.command_prefix+this.commandName+" blacklist remove @unUtilisateur\n"+
                   config.command_prefix+this.commandName+" blacklist show\n"+
                   config.command_prefix+this.commandName+" listen add #channel idDuMessageAEcouter :emote:\n"+
                   config.command_prefix+this.commandName+" listen remove #channel idDuMessageANePlusEcouter :emote:\n"+
                   config.command_prefix+this.commandName+" listen remove #channel idDuMessageANePlusEcouter (s'applique à toutes les émotes)\n"+
                   config.command_prefix+this.commandName+" listen remove #channel (s'applique à toutes les émotes de tout les messages du channel)\n"+
                   config.command_prefix+this.commandName+" listen remove --all|-a (s'applique à toutes les émotes de tout les messages de tout les channels)\n"+
                   config.command_prefix+this.commandName+" listen show\n"+
                   config.command_prefix+this.commandName+" listen show #channel\n"+
                   config.command_prefix+this.commandName+" listen show #channel idDunMessage\n"+
                   config.command_prefix+this.commandName+" --help"
        })
    }
}
