import Command from "../Classes/Command";
import TicketCommunication, { ITicketCommunication } from "../Models/TicketCommunication";
import {getUserFromCache} from "../Classes/OtherFunctions";

export class CommunicateTicketModeratorSide extends Command {
    static ticketCommunication = {};

    static async match(message) {
        return await this.checkIfItIsTicketChannel(message) && !message.author.bot;
    }

    static async action(message, bot) {
        const userCommunication: ITicketCommunication = await TicketCommunication.findOne({ticketChannelId: message.channel.id});
        if (userCommunication == null) return false;

        const userToWrite = getUserFromCache(userCommunication.customerId,bot);
        if (userToWrite == null) {
            message.channel.send("L'utilisateur auteur de ce ticket n'est pas présent dans le cache et ne peux donc pas être contacté");
            return false;
        }

        const currentTime = new Date();
        if (currentTime.getTime() - userCommunication.lastUse > 5 * 60 * 1000) {
            userToWrite.send("Un modérateur de '"+message.guild.name+"' vous répond :");
        }
        userCommunication.lastUse = currentTime.getTime(); // @ts-ignore
        userCommunication.save();
        userToWrite.send(message.content);
        message.channel.send("Votre message a été envoyé").then(sentMessage => {
            setTimeout(() => {
                sentMessage.delete();
            }, 5000)
        })

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