import Command from "../Classes/Command";
import TicketCommunication, {ITicketCommunication} from "../Models/TicketCommunication";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";
import config from "../config";
import {Message} from "discord.js";

const usersInPrompt = {};

export class CommunicateTicketClientSide extends Command {

    constructor(message: Message) {
        super(message, null);
    }

    async match() {
        return this.message.channel.type == "dm" && !this.message.author.bot && !usersInPrompt[this.message.author.id];
    }

    async action(bot) {
        const ticketConfigs: Array<ITicketConfig> = await TicketConfig.find(
            {
                enabled: true,
                blacklist: { $ne: this.message.author.id }
            });

        let serverIds: Array<string> = [];
        for (let i=0;i<ticketConfigs.length;i++) { // Récupère les id des serveurs sur lesquels les tickets sont activés
            const ticketConfig = ticketConfigs[i];
            try {
                const guild = await bot.guilds.fetch(ticketConfig.serverId);
                await guild.members.fetch(this.message.author.id);
                serverIds.push(ticketConfig.serverId);
            } catch(e) {
                ticketConfigs.splice(i,1);
                i -= 1;
            }
        }

        if (ticketConfigs.length == 0) {
            this.message.channel.send("Il n'y aucun serveur avec la fonctionnalité ticket activée de disponible");
            return false;
        }

        const ticketCommunications: Array<ITicketCommunication> = await TicketCommunication.find({
            customerId: this.message.author.id,
            serverId: { $in: serverIds }
        });

        if (this.message.content == config.command_prefix+"server") {
            if (ticketConfigs.length == 1) {
                this.message.channel.send("Le seul serveur disponible est déjà utilisé par défaut");
            } else {
                this.selectServer(ticketConfigs, ticketCommunications, serverIds, bot);
            }
            return false;
        }

        let usedCommunication: null|ITicketCommunication = null;
        for (let ticketCommunication of ticketCommunications) {
            if (ticketCommunication.usedByUser) {
                usedCommunication = ticketCommunication;
                break;
            }
        }
        if (usedCommunication != null) {
            const date = new Date();
            if (date.getTime()-usedCommunication.lastUse > 60*60*1000) { // Si le dernier ticket date de plus d'une heure, on se ne se base pas dessus
                usedCommunication.usedByUser = false;// @ts-ignore
                await usedCommunication.save();
                usedCommunication = null;
            } else {
                usedCommunication.lastUse = date.getTime();// @ts-ignore
                await usedCommunication.save();
            }
        }
        if (usedCommunication == null) {
            if (ticketConfigs.length == 1) {
                this.getOrCreateTicketCommunication(bot, ticketCommunications, ticketConfigs[0]);
            } else {
                this.selectServer(ticketConfigs, ticketCommunications, serverIds, bot);
            }
        } else {
            for (let ticketConfig of ticketConfigs) {
                if (ticketConfig.serverId == usedCommunication.serverId) {
                    this.sendTicket(bot, usedCommunication, ticketConfig);
                }
            }
        }

        return false;
    }

    selectServer(ticketConfigs: Array<ITicketConfig>, ticketCommunications: Array<ITicketCommunication>, serverIds, bot) {
        let serversToChooseString = "";
        for (let i = 0; i < ticketConfigs.length; i++) {
            const ticketConfig = ticketConfigs[i];
            const serverId = ticketConfig.serverId;
            const server = bot.guilds.cache.get(serverId);
            if (i > 0) {
                serversToChooseString += ", ";
            }
            serversToChooseString += "[" + i + "] " + server.name;
        }
        this.message.channel.send("Veuillez choisir un des serveurs suivant, pour envoyer le ticket :");
        this.message.channel.send(serversToChooseString).then(sentMessage => {
            const listener = response => {
                if (response.author.bot) return;
                if (response.author.id == this.message.author.id && response.channel.id == this.message.channel.id) {
                    if (typeof(serverIds[parseInt(response.content)]) == "undefined") {
                        this.message.channel.send("Veuillez rentrer le numéro d'un des serveurs ci dessus pour lui envoyer le ticket");
                    } else {
                        this.getOrCreateTicketCommunication(bot, ticketCommunications, ticketConfigs[parseInt(response.content)]);
                        delete usersInPrompt[this.message.author.id];
                        bot.off("message", listener);
                    }
                }
            };
            usersInPrompt[this.message.author.id] = true;
            bot.on("message", listener);
        });
    }

    async getOrCreateTicketCommunication(bot, ticketCommunications, ticketConfig: ITicketConfig) {
        let usedCommunication: ITicketCommunication|null = null;
        for (let ticketCommunication of ticketCommunications) {
            if (ticketCommunication.serverId == ticketConfig.serverId) {
                usedCommunication = ticketCommunication;
                break;
            }
        }
        if (usedCommunication != null) {
            usedCommunication.usedByUser = true;
            usedCommunication.lastUse = (new Date()).getTime(); // @ts-ignore
            await usedCommunication.save();
        } else {
            usedCommunication = {
                serverId: ticketConfig.serverId,
                ticketChannelId: null,
                customerId: this.message.author.id,
                usedByUser: true,
                lastUse: (new Date()).getTime()
            };
            usedCommunication = await TicketCommunication.create(usedCommunication);
        }
        TicketCommunication.updateMany(
            {
                customerId: this.message.author.id,
                serverId: { $ne: ticketConfig.serverId }
            },
            {
                $set: { usedByUser: false }
            }).then(_ => {});

        if (this.message.content == config.command_prefix+"server") {
            this.message.channel.send("*Serveur configuré*");
        } else {
            this.sendTicket(bot, <ITicketCommunication>usedCommunication, ticketConfig, true);
        }
    }

    async sendTicket(bot, usedCommunication: ITicketCommunication, ticketConfig: ITicketConfig, displayInfo = false) {
        const server = bot.guilds.cache.get(usedCommunication.serverId);
        const categoryChannel = server.channels.cache.get(ticketConfig.categoryId);
        if (categoryChannel == undefined || categoryChannel.type != "category") {
            this.message.channel.send("*On dirait que la catégorie configurée sur le serveur n'est pas correcte*");
            return;
        }
        let channelToWrite;
        if (usedCommunication.ticketChannelId != null) {
            channelToWrite = server.channels.cache.get(usedCommunication.ticketChannelId);
            if (channelToWrite == undefined) usedCommunication.ticketChannelId = null;
        }
        if (usedCommunication.ticketChannelId == null) {
            channelToWrite = await server.channels.create("Ticket de " + this.message.author.username + " [" + this.message.author.id.substring(0, 4) + "]", "text");
            channelToWrite.setParent(categoryChannel.id);
            channelToWrite.send("Ce ticket a été créé par <@"+this.message.author.id+">");
            usedCommunication.ticketChannelId = channelToWrite.id; // @ts-ignore
            usedCommunication.save();
        }

        channelToWrite.send(this.message.content);
        if (displayInfo) this.message.channel.send("*Votre message a été envoyé sur le serveur '"+server.name+"'*")
    }
}
