import {existingCommands} from "./Classes/CommandsDescription";
import {setUserInCache, userCache} from "./Classes/Cache";
import TicketCommunication, {ITicketCommunication} from "./Models/TicketCommunication";

export default function init(bot) {
    setTimeout(async () => {
        console.log("Detect stored notifyOnReacts in the database and apply them")
        existingCommands.notifyOnReact.commandClass.applyNotifyOnReactAtStarting(bot);

        console.log("Check ticket messages to fill the user cache");
        const ticketCommunications: Array<ITicketCommunication> = await TicketCommunication.find({});
        let checkeds = 0;
        for (const ticketCommunication of ticketCommunications) {
            const server = bot.guilds.cache.get(ticketCommunication.serverId);
            const ticketChannel = server.channels.cache.get(ticketCommunication.ticketChannelId);

            if (ticketChannel != undefined) {
                const messages = await ticketChannel.messages.fetch();

                for (const messageArray of messages) {
                    const message = messageArray[1];
                    for (const mentionArray of message.mentions.users) {
                        const mentionnedUser = mentionArray[1];
                        setUserInCache(mentionnedUser);
                    }
                    setUserInCache(message.author);
                    checkeds += 1;
                    console.log(checkeds + " messages checked");
                }
            }
        }
        console.log("All ticket messages checked and "+Object.keys(userCache).length+" users stored in the cache");
    }, 5000);
}