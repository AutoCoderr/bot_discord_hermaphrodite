import TextAskInviteBack from "../Models/Text/TextAskInviteBack";
import VocalAskInviteBack from "../Models/Vocal/VocalAskInviteBack";
import TextConfig from "../Models/Text/TextConfig";
import VocalConfig from "../Models/Vocal/VocalConfig";

import client from "../client";
import config from "../config";
import {Guild} from "discord.js";

//@ts-ignore
Array.prototype.promiseReduce = async function(callback,acc) {
    const arr: Array<any> = <Array<any>>this.valueOf();
    if (arr.length === 0)
        return acc;
    //@ts-ignore
    return arr.slice(1).promiseReduce(callback, await callback(acc, arr[0]))
}

//@ts-ignore
Array.prototype.promiseFindElem = async function(callback,elem = null) {
    if (elem)
        return elem;
    const arr: Array<any> = <Array<any>>this.valueOf();
    if (arr.length === 0)
        return elem;
    //@ts-ignore
    return arr.slice(1).promiseFindElem(callback, await callback(arr[0]))
}

const getters = {
    server: id => {
        const guild = client.guilds.cache.get(id);
        if (!guild)
            console.log("Guild '"+id+"' does not exist")
        return guild;
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
    }
}


async function updateDatasDict(dict: any,element, cols: string[], type: 'member'|'channel'|'server', servers: Guild[]|null = null) {
    return {
        ...(dict ?? {}), //@ts-ignore
        ...(await (cols ?? []).promiseReduce(async (acc, colName) => ({
            ...acc,
            ...((!dict || dict[element[colName]] === undefined) ?
                {
                    [element[colName]]: servers ? //@ts-ignore
                        await servers.promiseFindElem(server => getters[type](element[colName], server)) :
                        await getters[type](element[colName])
                } :
                {})
        }), {}))
    }
}

function someNonGettedData(dict: any, cols: string[], element) {
    return (cols??[]).some(colName => !dict[element[colName]]);
}

function filterElementsToDelete(elements: Array<any>, colsTypes) {
    const acc: {
        serversById?: {[id: string]: string},
        membersById?: {[id: string]: string},
        toDelete?: any[],
        toKeep?: any[]
    } = {}
    //@ts-ignore
    return elements.promiseReduce(async ({serversById,membersById,toDelete, toKeep},element) => {
        const newServersById = await updateDatasDict(serversById,element,colsTypes.server,"server");

        if (someNonGettedData(newServersById, colsTypes.server, element))
            return {
                serversById: newServersById,
                membersById,
                toDelete: [...(toDelete??[]), element],
                toKeep: toKeep??[]
            };
        const newMembersById = await updateDatasDict(membersById, element, colsTypes.member, "member",
            colsTypes.server.map(colName => newServersById[element[colName]])
        );
        if (someNonGettedData(newMembersById,colsTypes.member,element))
            return {
                serversById: newServersById,
                membersById: newMembersById,
                toDelete: [...(toDelete??[]), element],
                toKeep: toKeep??[]
            };

        return {
            serversById: newServersById,
            membersById: newMembersById,
            toDelete: toDelete??[],
            toKeep: [...(toKeep??[]), element],
        }
    }, acc)
}

function checkAndDeleteUselessEntries(model, name, colsTypes) {
    return model.find()
        .then(elements => filterElementsToDelete(elements, colsTypes))
        .then(({toDelete, toKeep}) => {
            if (toDelete.length === 0) {
                console.log("nothing to delete for "+name);
            }
            return Promise.all(toDelete.map(element => {
                console.log("\nDelete "+name+" => ");
                console.log(element);
                //return elem.remove();
            }));
            /*console.log(name);
            console.log({toDelete: toDelete.length})
            console.log({toKeep: toKeep.length})*/
        })
}

async function cleanDatabase() {

    await Promise.all([
        checkAndDeleteUselessEntries(TextAskInviteBack, "textAskInviteBack", {
            server: ['serverId'],
            member: ['requesterId','requestedId']
        }),
        checkAndDeleteUselessEntries(VocalAskInviteBack, "vocalAskInviteBack", {
            server: ['serverId'],
            member: ['requesterId','requestedId']
        }),
        checkAndDeleteUselessEntries(TextConfig, "textConfig", {
            server: ['serverId']
        }),
        checkAndDeleteUselessEntries(VocalConfig, "vocalConfig", {
            server: ['serverId']
        })
    ])

    process.exit();
}

client.login(config.token);

client.on('ready', () => {
    cleanDatabase();
})
