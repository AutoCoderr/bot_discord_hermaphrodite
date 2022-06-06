import client from "../../client";
import {BaseGuildTextChannel, Guild, GuildChannel} from "discord.js";
import {propAccess} from "../../Classes/OtherFunctions";

export const getNeededs = () => ({
    none: ['server','emote'],
    server: ['member','channel','role'],
    channel: ['message']
});

const getters = {
    server: id => {
        const guild = client.guilds.cache.get(id);
        if (!guild)
            console.log("Guild '"+id+"' does not exist")
        return guild??null;
    },
    emote: id => {
        if (new RegExp("^[^\u0000-\u007F]+$").test(id)) return id;
        const emote = client.emojis.cache.get(id);
        if (!emote)
            console.log("Emote '"+id+"' does not exist");
        return emote??null;
    },
    member: async (id: string, guild: Guild|null = null) => {
        if (!guild)
            return null;

        try {
            return await guild.members.fetch(id);
        } catch (e) {
            console.log("Member '"+id+"' does not exist on guild '"+guild.name+"'");
            return null;
        }
    },
    channel: async (id: string, guild: Guild|null = null) => {
        if (!guild)
            return null;

        try {
            return await guild.channels.fetch(id);
        } catch (e) {
            console.log("Channel '"+id+"' does not exist on guild '"+guild.name+"'")
            return null;
        }
    },
    role: async (id: string, guild: Guild|null = null) => {
        if (!guild)
            return null;

        try {
            return await guild.roles.fetch(id);
        } catch (e) {
            console.log("Role '"+id+"' does not exist on guild '"+guild.name+"'")
            return null;
        }
    },
    message: async (id: string, channel: BaseGuildTextChannel|null = null) => {
        if (!channel)
            return null;

        try {
            return await channel.messages.fetch(id);
        } catch (e) {
            console.log("message '"+id+"' does not exist on channel '"+channel.name+"' on guild '"+channel.guild.name+"'")
            return null;
        }
    }
}

function getNeededData(needed,item,element) {
    const splittedNeeded = needed.split(".");
    return splittedNeeded[0] === "$item" ? propAccess(item,splittedNeeded.slice(1)) : propAccess(element,splittedNeeded);
}

export async function updateDatasDict(dict: any,element, cols: string[], type: 'member'|'channel'|'message'|'role'|'emote'|'server', guildsOrChannels: null|Array<Guild|GuildChannel> = null) {// @ts-ignore
    return (cols ?? []).promiseReduce(async (acc, col) => {
        const colName = col.col??col;
        const attrInItem = col.attr??null;
        const neededForThisCol = col.needed??null;
        return {
            ...acc,
            ...(
                [undefined,null].includes(propAccess(element, colName)) ?
                    {} :
                    await (propAccess(element,colName) instanceof Array ? propAccess(element,colName) : [propAccess(element,colName)]).promiseReduce(async (acc,item) => ({
                        ...acc,
                        ...((propAccess(item,attrInItem) !== undefined) ? {
                            [propAccess(item,attrInItem)]:
                                acc[propAccess(item,attrInItem)] !== undefined ? acc[propAccess(item,attrInItem)] :
                                    guildsOrChannels ? //@ts-ignore
                                        await guildsOrChannels.promiseFindElem(guildOrChannel =>
                                            (neededForThisCol === null || getNeededData(neededForThisCol,item,element) === guildOrChannel.id) &&
                                            getters[type](propAccess(item,attrInItem), guildOrChannel)
                                        ) :
                                        await getters[type](propAccess(item,attrInItem))
                        }: {})

                    }), acc)
            )
        }
    },  dict??{})
}
