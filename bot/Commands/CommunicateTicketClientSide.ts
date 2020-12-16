import Command from "../Classes/Command";
import TicketCommunication, {ITicketCommunication} from "../Models/TicketCommunication";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";

export class CommunicateTicketClientSide extends Command {
    static usersInPrompt = {};

    static match(message) {
        return message.channel.type == "dm" && !message.author.bot && !this.usersInPrompt[message.author.id];
    }

    static async action(message,bot) {
        const ticketConfigs: Array<ITicketConfig> = await TicketConfig.find({enabled: true});
        if (ticketConfigs.length == 0) {
            message.channel.send("Il n'y aucun serveur avec la fonctionnalité ticket activée de disponible");
            return false;
        }
        let serverIds: Array<string> = [];
        for (let ticketConfig of ticketConfigs) { // Récupère les id des serveurs sur lesquels les tickets sont activés
            serverIds.push(ticketConfig.serverId);
        }

        const ticketCommunications: Array<ITicketCommunication> = await TicketCommunication.find({
            DMChannelId: message.channel.id,
            serverId: { $in: serverIds }
        });

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
                usedCommunication.save();
                usedCommunication = null;
            }
        }
        if (usedCommunication == null) {
            if (ticketConfigs.length == 1) {
                this.getOrCreateTicketCommunication(bot, message, ticketCommunications, ticketConfigs[0]);
            } else {
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
                message.channel.send("Veuillez choisir un des serveurs suivant, pour envoyer le ticket :");
                message.channel.send(serversToChooseString).then(sentMessage => {
                    const listener = response => {
                        if (response.author.bot) return;
                        if (response.author.id == message.author.id && response.channel.id == message.channel.id) {
                            if (typeof(serverIds[parseInt(response.content)]) == "undefined") {
                                message.channel.send("Veuillez rentrer le numéro d'un des serveurs ci dessus pour lui envoyer le ticket");
                            } else {
                                this.getOrCreateTicketCommunication(bot, message, ticketCommunications, ticketConfigs[parseInt(response.content)]);
                                delete this.usersInPrompt[message.author.id];
                                bot.off("message", listener);
                            }
                        }
                    };
                    this.usersInPrompt[message.author.id] = true;
                    bot.on("message", listener);
                });
            }
        } else {
            for (let ticketConfig of ticketConfigs) {
                if (ticketConfig.serverId == usedCommunication.serverId) {
                    this.sendTicket(bot, message, usedCommunication, ticketConfig);
                }
            }
        }

        return false;
    }

    static getOrCreateTicketCommunication(bot, message, ticketCommunications, ticketConfig: ITicketConfig) {
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
            usedCommunication.save();
            this.sendTicket(bot, message, usedCommunication, ticketConfig);
        } else {
            usedCommunication = {
                serverId: ticketConfig.serverId,
                ticketChannelId: null,
                DMChannelId: message.channel.id,
                usedByUser: true,
                lastUse: (new Date()).getTime()
            };
            TicketCommunication.create(usedCommunication).then(usedCommunication => {
                this.sendTicket(bot,message, usedCommunication, ticketConfig);
            });
        }
    }

    static async sendTicket(bot, message, usedCommunication: ITicketCommunication, ticketConfig: ITicketConfig) {
        const server = bot.guilds.cache.get(usedCommunication.serverId);
        const categoryChannel = server.channels.cache.get(ticketConfig.categoryId);
        if (categoryChannel == undefined || categoryChannel.type != "category") {
            message.channel.send("On dirait que la catégorie configurée sur le serveur n'est pas correcte");
            return;
        }
        let channelToWrite;
        if (usedCommunication.ticketChannelId != null) {
            channelToWrite = server.channels.cache.get(usedCommunication.ticketChannelId);
            if (channelToWrite == undefined) usedCommunication.ticketChannelId = null;
        }
        if (usedCommunication.ticketChannelId == null) {
            channelToWrite = await server.channels.create("Ticket de " + message.author.username + " [" + message.author.id.substring(0, 4) + "]", 'text')
            await channelToWrite.setParent(categoryChannel.id);
            usedCommunication.ticketChannelId = channelToWrite.id; // @ts-ignore
            usedCommunication.save();
        }

        channelToWrite.send(message.content);
        message.channel.send("Votre message a été envoyé sur le serveur '"+server.name+"'");
    }
}