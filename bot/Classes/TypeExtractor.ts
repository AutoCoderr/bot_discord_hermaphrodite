import {GuildChannel, Message} from "discord.js";

export const extractTypes = {
    channel: (field, message: Message): GuildChannel|boolean => {
        if (message.guild == null) return false;
        let channelId = field.split("<#")[1];
        channelId = channelId.substring(0,channelId.length-1);
        const channel = message.guild.channels.cache.get(channelId);
        return channel != undefined ? channel : false;
    },
    message: async (field, message: Message, channel: GuildChannel|boolean) => {
        if (channel) {
            try { // @ts-ignore
                return await channel.messages.fetch(field)
            } catch (e) {
                return false;
            }
        }
        return false;
    },
    listenerReactMessage: async (field, message: Message) => {
        const channelMention = field.split("/")[0];
        const channel: GuildChannel|boolean|undefined = extractTypes.channel(channelMention, message);
        let messageToGet = null
        if (channel) {
            const messageId = field.split("/")[1].replaceAll(" ","");
            // @ts-ignore
            messageToGet = await extractTypes.message(messageId,message,channel);
        } else {
            return false;
        }
        return messageToGet ? {message: messageToGet,channel} : false;
    }
}
;