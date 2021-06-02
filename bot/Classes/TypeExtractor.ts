import {Channel, GuildChannel, Message} from "discord.js";
import {checkTypes} from "./TypeChecker";

export const extractTypes = {
    channel: (field, message: Message): GuildChannel|boolean|undefined => {
        let channelId = field.split("<#")[1];
        channelId = channelId.substring(0,channelId.length-1);
        return message.guild != null && message.guild.channels.cache.get(channelId);
    },
    listenerReactMessage: async (field, message: Message) => {
        const channelMention = field.split("/")[0];
        const channel: GuildChannel|boolean|undefined = extractTypes.channel(channelMention, message);
        let messageToGet = null
        if (channel) {
            const messageId = field.split("/")[1].replaceAll(" ","");
            // @ts-ignore
            messageToGet = await channel.messages.fetch(messageId);
        }
        return {message: messageToGet,channel};
    }
}
;