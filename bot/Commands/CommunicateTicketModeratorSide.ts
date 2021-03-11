import Command from "../Classes/Command";
import TicketCommunication, { ITicketCommunication } from "../Models/TicketCommunication";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";

export class CommunicateTicketModeratorSide extends Command {
    static ticketCommunication = {};

    static async match(message) {
        return await this.checkIfItIsTicketChannel(message) && !message.author.bot;
    }

    static async action(message, bot) {
        const ticketConfig: ITicketConfig = await TicketConfig.findOne({
            serverId: message.guild.id,
            enabled: true
        });

        if (ticketConfig == null) {
            message.channel.send("*Ce message ne peut être envoyé, car les tickets ne sont pas correctement configurés sur ce serveur*");
            return false;
        }

        const usedCommunication: ITicketCommunication = await TicketCommunication.findOne({ticketChannelId: message.channel.id});
        if (usedCommunication == null) return false;

        if (ticketConfig.blacklist.includes(usedCommunication.customerId)) {
            message.channel.send("*Ce message ne peut être envoyé, car l'utilisateur de ce ticket se trouve dans la blacklist*");
            return false;
        }

        let userToWrite;
        try {
            userToWrite = await message.guild.members.fetch(usedCommunication.customerId);
        } catch(e) {
            message.channel.send("*L'utilisateur auteur de ce ticket n'est pas présent sur ce serveur et ne peut donc pas être contacté*");
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
