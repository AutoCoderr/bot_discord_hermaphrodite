import Command from "../Classes/Command";
import TicketCommunication, { ITicketCommunication } from "../Models/TicketCommunication";
import TicketConfig, {ITicketConfig} from "../Models/TicketConfig";
import {Message} from "discord.js";

const ticketCommunicationChannels = {};

export class CommunicateTicketModeratorSide extends Command {

    constructor(message: Message) {
        super(message, null);
    }

    async match() {
        return await this.checkIfItIsTicketChannel() && !this.message.author.bot;
    }

    async action(bot) {
        if (this.message.guild == null || this.message.member == null) {
            this.message.channel.send("*Ni le serveur ni le membre associé à ce message n'ont put être trouvé*");
            return false;
        }
        const ticketConfig: ITicketConfig = await TicketConfig.findOne({
            serverId: this.message.guild.id,
            enabled: true
        });

        if (ticketConfig == null) {
            this.message.channel.send("*Ce message ne peut être envoyé, car les tickets ne sont pas correctement configurés sur ce serveur*");
            return false;
        }

        const usedCommunication: ITicketCommunication = await TicketCommunication.findOne({ticketChannelId: this.message.channel.id});
        if (usedCommunication == null) return false;

        if (ticketConfig.blacklist.includes(usedCommunication.customerId)) {
            this.message.channel.send("*Ce message ne peut être envoyé, car l'utilisateur de ce ticket se trouve dans la blacklist*");
            return false;
        }

        let userToWrite;
        try {
            userToWrite = await this.message.guild.members.fetch(usedCommunication.customerId);
        } catch(e) {
            this.message.channel.send("*L'utilisateur auteur de ce ticket n'est pas présent sur ce serveur et ne peut donc pas être contacté*");
            return false;
        }
        try {
            const currentTime = new Date();
            if (currentTime.getTime() - usedCommunication.lastUse > 5 * 60 * 1000 || !usedCommunication.usedByUser) {
                await userToWrite.send("*Un modérateur de '" + this.message.guild.name + "' vous répond :*");
                usedCommunication.usedByUser = true;
                TicketCommunication.updateMany(
                    {
                        customerId: usedCommunication.customerId,
                        serverId: { $ne: usedCommunication.serverId }
                    },
                    {
                        $set: { usedByUser: false }
                    }).then(_ => {
                });
            }
            usedCommunication.lastUse = currentTime.getTime();
            await userToWrite.send(this.message.content);
        } catch(e) {
            if (e.message == "Cannot send messages to this user") {
                this.message.channel.send("Cet utilisateur n'accepte pas les messages privés")
            }
            return false;
        }// @ts-ignore
        usedCommunication.save();
        return false;
    }

    async checkIfItIsTicketChannel() {
        if (ticketCommunicationChannels[this.message.channel.id] == undefined) {
            const ticketCommunication: ITicketCommunication = await TicketCommunication.findOne({ticketChannelId: this.message.channel.id});
            ticketCommunicationChannels[this.message.channel.id] = ticketCommunication != null;
        }
        return ticketCommunicationChannels[this.message.channel.id];
    }
}
