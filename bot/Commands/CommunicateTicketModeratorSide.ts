import Command from "../Classes/Command";
import TicketCommunication, { ITicketCommunication } from "../Models/TicketCommunication";
import {getUserFromCache} from "../Classes/Cache";

export class CommunicateTicketModeratorSide extends Command {
    static ticketCommunication = {};

    static async match(message) {
        return await this.checkIfItIsTicketChannel(message) && !message.author.bot;
    }

    static async action(message, bot) {
        const usedCommunication: ITicketCommunication = await TicketCommunication.findOne({ticketChannelId: message.channel.id});
        if (usedCommunication == null) return false;

        const userToWrite = getUserFromCache(usedCommunication.customerId,bot);
        if (userToWrite == null) {
            message.channel.send("*L'utilisateur auteur de ce ticket n'est pas présent dans le cache et ne peux donc pas être contacté*");
            return false;
        }

        const currentTime = new Date();
        if (currentTime.getTime() - usedCommunication.lastUse > 5 * 60 * 1000 || !usedCommunication.usedByUser) {
            userToWrite.send("*Un modérateur de '"+message.guild.name+"' vous répond :*");
            usedCommunication.usedByUser = true;
            TicketCommunication.updateMany(
                    {
                        customerId: usedCommunication.customerId,
                        serverId: { $ne: usedCommunication.serverId }
                    },
                    {
                        $set: { usedByUser: false }
                    }).then(_ => {});
        }
        usedCommunication.lastUse = currentTime.getTime(); // @ts-ignore
        usedCommunication.save();
        userToWrite.send(message.content);

        return false;
    }

    static async checkIfItIsTicketChannel(message) {
        if (this.ticketCommunication[message.channel.id] == undefined) {
            const ticketCommunication: ITicketCommunication = await TicketCommunication.findOne({ticketChannelId: message.channel.id});
            this.ticketCommunication[message.channel.id] = ticketCommunication != null;
        }
        return this.ticketCommunication[message.channel.id];
    }
}
