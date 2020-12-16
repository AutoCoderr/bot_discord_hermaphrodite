import Command from "../Classes/Command";
import TicketCommunication, {ITicketCommunication} from "../Models/TicketCommunication";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";

export class CommunicateTicket extends Command {
    static usersInPrompt = {};

    static match(message) {
        return /*message.channel.type == "text" || */message.channel.type == "dm" && !message.author.bot && !this.usersInPrompt[message.author.id];
    }

    static async action(message,bot) {
        const ticketConfigs: Array<ITicketConfig> = await TicketConfig.find({enabled: true});
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
            if (date.getTime()-usedCommunication.latestUtilisation > 60*60*1000) { // Si le dernier ticket date de plus d'une heure, on se ne se base pas dessus
                usedCommunication.usedByUser = false;// @ts-ignore
                usedCommunication.save();
                usedCommunication = null;
            }
        }
        if (usedCommunication == null) {
            if (ticketConfigs.length == 1) {
                this.sendTicket(serverIds[0]);
                this.getOrCreateTicketCommunication(message, ticketCommunications, serverIds[0]);
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
                                let serverChoosedId = serverIds[parseInt(response.content)];
                                this.getOrCreateTicketCommunication(message, ticketCommunications, serverChoosedId);
                                delete this.usersInPrompt[message.author.id];
                                bot.off("message", listener);
                            }
                        }
                    };
                    this.usersInPrompt[message.author.id] = true;
                    bot.on("message", listener);
                });
            //}
        } else {
            this.sendTicket(usedCommunication);
        }

        return false;
    }

    static getOrCreateTicketCommunication(message, ticketCommunications, serverChoosedId) {
        let usedCommunication: ITicketCommunication|null = null;
        for (let ticketCommunication of ticketCommunications) {
            if (ticketCommunication.serverId == serverChoosedId) {
                usedCommunication = ticketCommunication;
                break;
            }
        }
        if (usedCommunication != null) {
            usedCommunication.usedByUser = true; // @ts-ignore
            usedCommunication.save();
            this.sendTicket(usedCommunication);
        } else {
            usedCommunication = {
                serverId: serverChoosedId,
                ticketChannelId: null,
                DMChannelId: message.channel.id,
                usedByUser: true,
                latestUtilisation: (new Date()).getTime()
            };
            TicketCommunication.create(usedCommunication).then(usedCommunication => {
                this.sendTicket(usedCommunication);
            });
        }
    }

    static sendTicket(usedCommunication) {
        console.log("sendTicket");
        console.log(usedCommunication);
    }
}