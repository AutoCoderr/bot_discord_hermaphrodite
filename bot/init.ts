import {existingCommands} from "./Classes/CommandsDescription";
import {setUserInCache, userCache} from "./Classes/Cache";

export default function init(bot) {
    setTimeout(async () => {
        console.log("Detect stored notifyOnReacts in the database and apply them")
        existingCommands.notifyOnReact.commandClass.applyNotifyOnReactAtStarting(bot);
        console.log("Check messages to fill the user cache");
        let checkeds = 0;
        for (const guildArray of bot.guilds.cache) {
            const guild = guildArray[1];
            for (const channelArray of guild.channels.cache) {
                const channel = channelArray[1];
                if (channel.type == "text") {
                    const messages = await channel.messages.fetch({limit: 50});
                    for (const messageArray of messages) {
                        const message = messageArray[1];
                        for (const mentionArray of message.mentions.users) {
                            const mentionnedUser = mentionArray[1];
                            setUserInCache(mentionnedUser);
                        }
                        setUserInCache(message.author);
                        checkeds += 1;
                        console.log(checkeds+" messages checked");
                    }
                }
            }
        }
        console.log("All message checked and "+Object.keys(userCache).length+" users stored in the cache");
    }, 5000);
}