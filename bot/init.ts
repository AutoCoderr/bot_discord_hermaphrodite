import {existingCommands} from "./Classes/CommandsDescription";
import {setUserInCache, userCache} from "./Classes/Cache";
import TicketConfig, {ITicketConfig} from "./Models/TicketConfig";

export default function init(bot) {
    setTimeout(async () => {
        console.log("Detect stored notifyOnReacts in the database and apply them")
        existingCommands.notifyOnReact.commandClass.applyNotifyOnReactAtStarting(bot);
        console.log("Check messages to fill the user cache");
        let checkeds = 0;
        for (const guildArray of bot.guilds.cache) {
            const guild = guildArray[1];
            let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: guild.id});

            if (ticketConfig == null) {
                ticketConfig = {
                    enabled: false,
                    categoryId: null,
                    blacklist: [],
                    whitelist: [],
                    serverId: guild.id
                };
                ticketConfig = await TicketConfig.create(ticketConfig);
            }

            for (const channelArray of guild.channels.cache) {
                const channel = channelArray[1];
                if (channel.type == "text") {
                    const messages = await channel.messages.fetch({limit: 50});
                    for (const messageArray of messages) {
                        const message = messageArray[1];
                        for (const mentionArray of message.mentions.users) {
                            const mentionnedUser = mentionArray[1];
                            if (!ticketConfig.whitelist.includes(mentionnedUser.id))
                                ticketConfig.whitelist.push(mentionnedUser.id);
                            setUserInCache(mentionnedUser);
                        }
                        if (!ticketConfig.whitelist.includes(message.author.id))
                            ticketConfig.whitelist.push(message.author.id);

                        setUserInCache(message.author);
                        checkeds += 1;
                        console.log(checkeds+" messages checked");
                    }
                }
            } // @ts-ignore
            ticketConfig.save()
        }
        console.log("All message checked and "+Object.keys(userCache).length+" users stored in the cache");
    }, 5000);
}
