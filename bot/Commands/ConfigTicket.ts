import Command from "../Classes/Command";
import config from "../config";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";
import Discord, {
    CategoryChannel, ClientUser,
    Guild,
    GuildChannel,
    GuildEmoji,
    GuildMember,
    Message,
    MessageEmbed, PermissionString, Role, TextBasedChannels,
    TextChannel, User
} from "discord.js";
import {splitFieldsEmbed} from "../Classes/OtherFunctions";
import client from "../client";


const toDenyToEveryone: Array<PermissionString> = ['SEND_MESSAGES','VIEW_CHANNEL','SEND_TTS_MESSAGES', 'MANAGE_CHANNELS', 'MANAGE_MESSAGES'];
const toAllowToAuthorAndModerators: Array<PermissionString> = [
    'SEND_MESSAGES',
    'SEND_TTS_MESSAGES',
    'ADD_REACTIONS',
    'VIEW_CHANNEL',
    'MANAGE_MESSAGES',
    'MANAGE_CHANNELS',
    'EMBED_LINKS',
    'ATTACH_FILES',
    'READ_MESSAGE_HISTORY'];

export default class ConfigTicket extends Command {
    static display = true;
    static description = "Pour définir la catégorie pour les channels des tickets, activer, ou désactiver les ticket.";
    static commandName = "configTicket";

    static argsModel = {
        help: { fields: ["-h","--help"], type: "boolean", required: false, description: "Pour afficher l'aide" },
        allListen: {fields: ['-a','--all'], type: "boolean", required: false, description: "Pour viser toutes les écoutes de message"},

        $argsByType: {
            action: {
                required: args => args.help == undefined,
                type: "string",
                description: "L'action à effectuer : set, set-moderator, unset-moderator, show, show-moderator, disable, enable, listen ou blacklist",
                valid: (elem,_) => ['set','set-moderator','unset-moderator','show','show-moderator','disable','enable','listen','blacklist'].includes(elem)
            },
            moderatorRole: {
                required: args => args.help == undefined && args.action == "set-moderator",
                type: "role",
                description: "Le role désignant les modérateurs sur ce serveur"
            },
            category: {
                required: args => args.help == undefined && args.action == "set",
                type: "category",
                description: "L'id de la catégorie à définir avec 'set'"
            },
            subAction: {
                required: args => args.help == undefined && ["blacklist","listen"].includes(args.action),
                type: "string",
                description: "L'action à effectuer : add, remove ou show",
                valid: (elem,_) => ['add','remove','show'].includes(elem)
            },
            user: {
                required: args => args.help == undefined && args.action == "blacklist" && ['add','remove'].includes(args.subAction),
                type: "user",
                multi: true,
                description: "Le ou les utilisateurs à ajouter ou retirer de la blacklist"
            },
            channelListen: {
                required: args => args.help == undefined && args.action == "listen" && (args.subAction == "add" || (args.subAction == "remove" && !args.allListen)),
                type: "channel",
                description: "Le channel sur lequel ajouter, retirer, ou afficher les écoutes de réaction",
                valid: (elem: GuildChannel,_) => elem.type == "GUILD_TEXT"
            },
            emoteListen: {
                required: args => args.help == undefined && args.action == "listen" && args.subAction == "add",
                type: "emote",
                description: "L'emote sur l'aquelle ajouter ou retirer une écoute de réaction"
            },
            messageListen: {
                required: args => args.help == undefined && args.action == "listen" && (args.subAction == "add" || (args.subAction == "remove" && args.emoteListen != undefined)),
                type: "message",
                description: "L'id du message sur lequel ajouter, retirer, ou afficher les écoutes de réaction",
                moreDatas: args => args.channelListen
            }
        },
    }

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommand: null|string = null) {
        super(channel, member, guild, writtenCommand, ConfigTicket.commandName, ConfigTicket.argsModel);
    }

    async action(args: {help: boolean, action: string, category: CategoryChannel, subAction: string, user: GuildMember, channelListen: TextChannel, messageListen: Message, emoteListen: GuildEmoji|string, moderatorRole: Role}, bot) {
        const {help, action, category, subAction, user, channelListen, messageListen, emoteListen, moderatorRole} = args;

        if (help)
            return this.response(false, this.displayHelp());


        if (this.guild == null || !(this.member instanceof GuildMember)) {
            return this.response(false,
                this.sendErrors({
                    name: "Datas missing",
                    value: "Nor guild nor member has been found"
                })
            );
        }

        let ticketConfig: ITicketConfig;
        let emoteName: string|null;
        let resultContent: string;

        switch(action) {
            case "set":
                ticketConfig = await TicketConfig.findOne({serverId: this.guild.id});
                let toEnable = false;
                if (ticketConfig == null) {
                    toEnable = true;
                    ticketConfig = {
                        enabled: true,
                        categoryId: category.id,
                        serverId: this.guild.id,
                        blacklist: [],
                        messagesToListen: [],
                        moderatorId: null,
                        ticketChannels: []
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
                return this.response(true,
                    "Ce sera dorénavant dans la catégorie '"+category.name+"' que seront gérés les tickets"+
                    (toEnable ?  "\n(La fonctionnalité des tickets a été activée)" : "")
                );
            case "set-moderator":
                ticketConfig = await TicketConfig.findOne({serverId: this.guild.id});
                if (ticketConfig == null) {
                    ticketConfig = {
                        enabled: false,
                        categoryId: null,
                        serverId: this.guild.id,
                        blacklist: [],
                        messagesToListen: [],
                        moderatorId: moderatorRole.id,
                        ticketChannels: []
                    };
                    TicketConfig.create(ticketConfig);
                } else {
                    ticketConfig.moderatorId = moderatorRole.id;
                    // @ts-ignore
                    ticketConfig.save()
                }
                return this.response(true,
                    "Les modérateurs ont été définit sur le role <@&"+moderatorRole.id+">"
                );
            case "unset-moderator":
                ticketConfig = await TicketConfig.findOne({serverId: this.guild.id});
                if (ticketConfig == null || !ticketConfig.moderatorId) {
                    resultContent = "Aucun rôle modérateur configuré";
                } else {
                    ticketConfig.moderatorId = null; //@ts-ignore
                    ticketConfig.save()
                    resultContent = "Le rôle modérateur a été retiré de la configuration";
                }
                return this.response(true, resultContent);
            case "show":
                ticketConfig = await TicketConfig.findOne({serverId: this.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    resultContent = "On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie";
                } else {
                    const category = this.guild.channels.cache.get(<string>ticketConfig.categoryId);
                    if (category == undefined) {
                        resultContent = "On dirait que la catégorie que vous aviez définie n'existe plus, vous pouvez la redéfinir avec : " + config.command_prefix + this.commandName + " set idDeLaCategorie";
                    } else {
                        resultContent = "Catégorie utilisée pour les tickets : " + category.name+" ("+(ticketConfig.enabled ? 'activé': 'désactivé')+")";
                    }
                }
                return this.response(true, resultContent);
            case "show-moderator":
                ticketConfig = await TicketConfig.findOne({serverId: this.guild.id, moderatorId: { $ne: null }});
                if (ticketConfig) {
                    resultContent = "Role modérateur configuré : <@&"+ticketConfig.moderatorId+">";
                } else {
                    resultContent = "Aucun rôle modérateur configuré";
                }
                return this.response(true, resultContent);
            case "disable":
                ticketConfig = await TicketConfig.findOne({serverId: this.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    resultContent = "On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie";
                } else {
                    ticketConfig.enabled = false; // @ts-ignore
                    ticketConfig.save();
                    resultContent = "La fonctionalité des tickets a été désactivée.";
                }
                return this.response(true, resultContent);
            case "enable":
                ticketConfig = await TicketConfig.findOne({serverId: this.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null) {
                    resultContent = "On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie";
                } else {
                    ticketConfig.enabled = true; // @ts-ignore
                    ticketConfig.save();
                    resultContent = "La fonctionalité des tickets a été activée. \nFaite '"+config.command_prefix+this.commandName+" show ' pour voir le nom de la catégorie dans laquelle apparaitrons les tickets";
                }
                return this.response(true, resultContent);
            case "listen":
                ticketConfig = await TicketConfig.findOne({serverId: this.guild.id, categoryId: { $ne: null }});
                if (ticketConfig == null ||
                    <CategoryChannel>this.guild.channels.cache.get(<string>ticketConfig.categoryId) == undefined) {
                    return this.response(false,
                        "On dirait que vous n'avez pas encore configuré les tickets sur ce serveur, vous pouvez le faire en définissant la catégorie via : "+config.command_prefix+this.commandName+" set idDeLaCategorie"
                    );
                }
                if (!(ticketConfig.messagesToListen instanceof Array)) ticketConfig.messagesToListen = [];
                switch (subAction) {
                    case "add":
                        const emote = emoteListen instanceof GuildEmoji ? emoteListen.name : emoteListen;
                        if (emote == null) {
                            return this.response(false, "L'émoji spécifié semble invalide")
                        }
                        if (ticketConfig.messagesToListen.find(message =>
                            message.channelId == channelListen.id &&
                            message.messageId == messageListen.id &&
                            message.emoteName == emote)) {

                            return this.response(false, "Il y a déjà une écoute de réaction pour création de ticket sur ce message avec cette emote");
                        }
                        ticketConfig.messagesToListen.push({channelId: channelListen.id, messageId: messageListen.id, emoteName: emote}); // @ts-ignore
                        ticketConfig.save();
                        messageListen.react(emoteListen);
                        ConfigTicket.listenMessageTicket(messageListen, emote, ticketConfig._id, ticketConfig.messagesToListen[ticketConfig.messagesToListen.length-1]._id);

                        return this.response(true, "Une écoute a été activée sur ce message pour la création de ticket");
                    case "remove":
                        emoteName = emoteListen instanceof GuildEmoji ? emoteListen.name : emoteListen;

                        let nbRemoved = 0;
                        for (let i=0;i<ticketConfig.messagesToListen.length;i++) {
                            const listening = ticketConfig.messagesToListen[i];
                            if ((emoteName == null || listening.emoteName == emoteName) &&
                                (messageListen == undefined || listening.messageId == messageListen.id) &&
                                (channelListen == undefined || listening.channelId == channelListen.id)) {
                                const exist = await ConfigTicket.listeningMessageExist(listening,this.guild);
                                if (exist) {
                                    const reaction = exist.message.reactions.cache.find(reaction => reaction.emoji.name == listening.emoteName);
                                    if (reaction) reaction.remove();
                                }
                                ticketConfig.messagesToListen.splice(i,1);
                                i -= 1;
                                nbRemoved += 1;
                            }
                        }
                        if (nbRemoved == 0) {
                            return this.response(false, "Aucune écoute de réaction n'a été trouvée");
                        }
                         // @ts-ignore
                        ticketConfig.save();
                        return this.response(true,
                            nbRemoved+" écoute"+(nbRemoved > 1 ? 's' : '')+" "+(nbRemoved > 1 ? "ont " : "a ")+"été supprimée"+(nbRemoved > 1 ? 's' : '')+" avec succès!"
                        )
                    case "show":
                        emoteName = emoteListen instanceof GuildEmoji ? emoteListen.name : emoteListen;

                        const fields: Array<{name: string, value: string}> = [];
                        for (let i=0;i<ticketConfig.messagesToListen.length;i++) {
                            const message = ticketConfig.messagesToListen[i];
                            if ((emoteName == undefined || message.emoteName == emoteName) &&
                                (messageListen == undefined || message.messageId == messageListen.id) &&
                                (channelListen == undefined || message.channelId == channelListen.id)) {
                                const exist = await ConfigTicket.listeningMessageExist(ticketConfig.messagesToListen[i],this.guild);
                                fields.push(exist ? {
                                    name: "#"+exist.channel.name+" > ("+exist.message.content.substring(0,Math.min(20,exist.message.content.length))+"...) :"+ticketConfig.messagesToListen[i].emoteName+":",
                                    value: "Channel : #"+exist.channel.name+" ; Id du message : "+exist.message.id
                                } : {
                                    name: "Message/channel introuvable",
                                    value: "Le message de cette écoute n'existe plus"
                                });
                                if (!exist) {
                                    ticketConfig.messagesToListen.splice(i,1);
                                    i -= 1;
                                }
                            }
                        }
                        if (fields.length == 0) {
                            return this.response(false, "Aucune écoute de réaction trouvée");
                        } // @ts-ignore
                        ticketConfig.save();
                        const embeds: Array<MessageEmbed> = splitFieldsEmbed(25,fields,(Embed: MessageEmbed, partNb: number) => {
                            if (partNb == 1) {
                                Embed.setTitle("Les écoutes de réactions pour le ticketing");
                            }
                        });
                        return this.response(true, {embeds});
                }
                break;
            case "blacklist":
                switch(subAction) {
                    case "add":
                        return this.addUserToBlackList(this.guild.id,user.id);

                    case "remove":
                        return this.removeUserFromBlackList(this.guild.id,user.id);

                    case "show":
                        return this.showUsersInBlackList(bot, this.guild.id);
                }
        }
        return this.response(false, "Vous n'avez pas spécifié les bonnes actions");
    }

    async addUserToBlackList(serverId, userId) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});
        if (ticketConfig == null) {
            ticketConfig = {
                enabled: false,
                categoryId: null,
                moderatorId: null,
                blacklist: [userId],
                serverId: serverId,
                messagesToListen: [],
                ticketChannels: []
            }
            TicketConfig.create(ticketConfig);
        } else {
            if (ticketConfig.blacklist.includes(userId)) {
                return this.response(true, "Il semblerait que cet utilisateur se trouve déjà dans la blacklist");
            }

            ticketConfig.blacklist.push(userId);// @ts-ignore
            ticketConfig.save();
        }
        return this.response(true, "L'utilisateur a été ajouté avec succès à la blacklist !");
    }

    async removeUserFromBlackList(serverId, userId) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});

        if (ticketConfig == null || !ticketConfig.blacklist.includes(userId)) {
            return this.response(true, "Il semblerait que l'utilisateur ne se trouve pas dans la blacklist");
        }
        let list = ticketConfig.blacklist ;
        for (let i=0;i<list.length;i++) {
            if (list[i] == userId) {
                list.splice(i,1);
                break;
            }
        } // @ts-ignore
        ticketConfig.save();

        return this.response(true, "L'utilisateur a été retiré avec succès de la blacklist !");
    }

    async showUsersInBlackList(bot, serverId) {
        let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: serverId});

        let embeds = [new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle("Les utilisateurs de la blacklist :")
            .setDescription("Liste des utilisateurs de la blacklist")
            .setTimestamp()];

        if (ticketConfig == null || ticketConfig.blacklist.length == 0) {
            embeds[0].addFields({
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
                    embeds.push(new Discord.MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle("Les utilisateurs de la blacklist (Partie "+(msg+1)+") :")
                        .setDescription("Liste des utilisateurs de la blacklist")
                        .setTimestamp());
                }
                let embed = embeds[embeds.length-1];
                for (let line = 0; line < linePerMessage && msg*linePerMessage*userDisplayedPerLine + line*userDisplayedPerLine < users.length; line++) {
                    let usersNames: Array<string> = [];
                    for (let userIndex=0;userIndex < userDisplayedPerLine && msg*linePerMessage*userDisplayedPerLine + line*userDisplayedPerLine + userIndex < users.length;userIndex++) {
                        const user = users[msg*linePerMessage*userDisplayedPerLine + line*userDisplayedPerLine + userIndex];
                        usersNames.push("@"+(user != null ? user.username : "unknown")+"("+user.id+")");
                    }
                    embed.addFields({
                        name: "Les utilisateurs :",
                        value: usersNames.join(", ")
                    });
                }
            }
        }
        return this.response(true, {embeds});
    }

    static async listeningMessageExist(listening: {channelId: string, messageId: string}, guild: Guild) {
        const channel: undefined | TextChannel = <TextChannel>guild.channels.cache.get(listening.channelId);
        if (!channel)
            return false;

        let message: null | Message = null;
        try {
            message = await channel.messages.fetch(listening.messageId);
        } catch (e) {
        }
        if (!message) return false;


        return {channel, message};
    }

    static listenMessageTicket(message: Message, emoteName, _idConfigTicket, _idMessageToListen) {
        const guild: Guild = <Guild>message.guild;
        let userWhoReact: User;
        const filter = (reaction, user) => {
            userWhoReact = user;
            return reaction.emoji.name == emoteName;
        };
        message.awaitReactions({ max: 1 , filter})
            .then(async _ => {
                if (!userWhoReact) return;
                const ticketConfig: ITicketConfig = await TicketConfig.findOne({
                    _id: _idConfigTicket,
                    'messagesToListen._id': _idMessageToListen
                });
                if (ticketConfig == null) return;
                let category: CategoryChannel;

                if (userWhoReact.id != (<ClientUser>client.user).id &&
                    ticketConfig.enabled &&
                    ticketConfig.categoryId != null &&
                    (category = <CategoryChannel>guild.channels.cache.get(ticketConfig.categoryId)) != undefined) {

                    if (!(ticketConfig.ticketChannels instanceof Array)) ticketConfig.ticketChannels = [];

                    const ticketChannel = ticketConfig.ticketChannels.find(ticketChannel => ticketChannel.userId == userWhoReact.id);
                    let channel: TextChannel|undefined = ticketChannel ? <TextChannel>guild.channels.cache.get(ticketChannel.channelId) : undefined;

                    if (!channel || channel.parentId != category.id) {
                        if (!ticketConfig.blacklist.includes(userWhoReact.id)) {

                            const moderatorRole: Role | undefined = ticketConfig.moderatorId ? guild.roles.cache.get(ticketConfig.moderatorId) : undefined;

                            let member: null|GuildMember = null
                            try {
                                member = await guild.members.fetch(userWhoReact.id);
                            } catch (e) {
                            }
                            const username = member && member.nickname ? member.nickname : userWhoReact.username;
                            channel = await guild.channels.create('Ticket de ' + username + " " + userWhoReact.id, {
                                type: "GUILD_TEXT"
                            });
                            await channel.setParent(category);
                            await channel.permissionOverwrites.set([
                                ...[
                                    {
                                        id: guild.roles.everyone,
                                        deny: toDenyToEveryone
                                    },
                                    {
                                        id: userWhoReact.id,
                                        allow: toAllowToAuthorAndModerators
                                    }
                                ],
                                ...(moderatorRole ? [
                                    {
                                        id: moderatorRole.id,
                                        allow: toAllowToAuthorAndModerators
                                    }
                                ] : [])
                            ]);
                            channel.send((moderatorRole ? '<@&' + moderatorRole.id + '> ! ' : '') + "Nouveau ticket de <@" + userWhoReact.id + ">");
                            if (ticketChannel)
                                ticketChannel.channelId = channel.id;
                            else
                                ticketConfig.ticketChannels.push({channelId: channel.id, userId: userWhoReact.id});

                            //@ts-ignore
                            ticketConfig.save();

                        } else
                            userWhoReact.send("Vous ne pouvez créer de ticket sur le serveur "+guild.name+" car vous êtes dans la blacklist").catch(() => {});
                    }
                }
                ConfigTicket.listenMessageTicket(message, emoteName, _idConfigTicket, _idMessageToListen);
            })
            .catch(e => {
                console.log("Catch event in listenMessageTicket() function ");
                console.error(e);
            });
    }

    static async initListeningAllMessages() {
        console.log("Start listening all messages for ticketing");
        const ticketConfigs: Array<ITicketConfig> = await TicketConfig.find();

        for (const ticketConfig of ticketConfigs) {
            const guild = client.guilds.cache.get(ticketConfig.serverId);
            if (!guild) {
                TicketConfig.deleteOne({_id: ticketConfig._id});
                console.log("server "+ticketConfig.serverId+" does not exist");
                continue;
            }
            let category: CategoryChannel|undefined = undefined;
            if (ticketConfig.categoryId == undefined || (category = <CategoryChannel>guild.channels.cache.get(ticketConfig.categoryId)) == undefined) {
                console.log("Category of "+guild.name+" is not defined or not found");
            }

            if (!(ticketConfig.messagesToListen instanceof Array)) continue;
            for (let i=0;i<ticketConfig.messagesToListen.length;i++) {
                const listening = ticketConfig.messagesToListen[i];
                const exist = await ConfigTicket.listeningMessageExist(listening,guild);
                if (exist) {
                    ConfigTicket.listenMessageTicket(exist.message,listening.emoteName,ticketConfig._id,listening._id);
                } else {
                    ticketConfig.messagesToListen.splice(i,1);
                    i -= 1;
                }
            }// @ts-ignore
            ticketConfig.save();
        }
        console.log("All ticketing message listened");
    }

    help() {
        return new MessageEmbed()
            .setTitle("Exemples :")
            .addFields([
                {
                    name: "set 475435899654125637",
                    value: "Définir la catégorie dans l'aquelle apparaitrons les tickets"
                },
                {
                    name: "show",
                    value: "Afficher cette catégorie"
                },
                {
                    name: "enable",
                    value: "Activer les tickets sur ce serveur"
                },
                {
                    name: "disable",
                    value: "Désactiver les tickets sur ce serveur"
                },
                {
                    name: "blacklist add @unUtilisateur",
                    value: "Interdir @unUtilisateur de créer des tickets"
                },
                {
                    name: "blacklist remove @unUtilisateur",
                    value: "Ré autoriser @unUtilisateur à créer des tickets"
                },
                {
                    name: "blacklist show",
                    value: "Afficher la blacklist"
                },
                {
                    name: "listen add #channel idDuMessageAEcouter :emote:",
                    value: "Ajouter une écoute de réaction permettant de créer des tickets"
                },
                {
                    name: "listen remove #channel idDuMessageANePlusEcouter :emote:",
                    value: "Retirer une écoute de réaction"
                },
                {
                    name: "listen remove #channel idDuMessageANePlusEcouter",
                    value: "Retirer toutes les écoutes de réaction d'un message spécifié sur un channel spécifié"
                },
                {
                    name: "listen remove #channel",
                    value: "Retirer toutes les écoutes de réaction du channel spécifié"
                },
                {
                    name: "listen remove --all|-a",
                    value: "Retirer toutes les écoutes de réaction du serveur"
                },
                {
                    name: "listen show",
                    value: "Afficher les écoutes du serveur"
                },
                {
                    name: "listen show #channel",
                    value: "Afficher les écoutes sur channel spécifié"
                },
                {
                    name: "listen show #channel idDunMessage",
                    value: "Afficher les écoutes d'un message spécifié sur channel spécifié"
                },
                {
                    name: "set-moderator @&moderateurs",
                    value: "Définir le rôle modérateurs qui sera pingé à chaque création d'un ticket"
                },
                {
                    name: "unset-moderator",
                    value: "'Déconfigurer' le rôle modérateur"
                },
                {
                    name: "show-moderator",
                    value: "Afficher la rôle modérateur configuré"
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
