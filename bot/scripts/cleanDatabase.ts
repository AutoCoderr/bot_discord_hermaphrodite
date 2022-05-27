import TextAskInviteBack from "../Models/Text/TextAskInviteBack";
import VocalAskInviteBack from "../Models/Vocal/VocalAskInviteBack";
import TextConfig from "../Models/Text/TextConfig";
import VocalConfig from "../Models/Vocal/VocalConfig";

import {propAccess, propUpdate} from "../Classes/OtherFunctions";

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
}


async function updateDatasDict(dict: any,element, cols: string[], type: 'member'|'channel'|'server', guilds: Guild[]|null = null) { //@ts-ignore
    return await (cols ?? []).promiseReduce(async (acc, colName) => ({
        ...acc,
        ...(await (propAccess(element,colName) instanceof Array ? propAccess(element,colName): [propAccess(element,colName)]).promiseReduce(async (acc,id) => ({
            ...acc,
            [id]: acc[id] ? acc[id] :
                guilds ? //@ts-ignore
                    await guilds.promiseFindElem(guild => getters[type](id, guild)) :
                    await getters[type](id)
        }), acc))
    }),  dict??{})
}

function someNonGettedData(dict: any, cols: string[], element) {
    return (cols??[]).some(colName => !dict[propAccess(element,colName)]);
}

async function checkDatas(colsTypes, datas, element, guilds: Guild[]) {
    if (colsTypes.length === 0)
        return {success: true, datas};

    const [type,cols] = colsTypes[0];

    const newDatas = {
        ...datas,
        [type+'s']: await updateDatasDict(datas[type+'s'], element, cols, type, guilds)
    }
    if (someNonGettedData(newDatas[type+'s'],cols,element))
        return {success: false, datas: newDatas}

    return checkDatas(colsTypes.slice(1), newDatas, element, guilds);
}

function filterElementsToDelete(elements: Array<any>, colsTypes) {
    const acc: {
        servers?: {[id: string]: string},
        members?: {[id: string]: string},
        channels?: {[id: string]: string},
        roles?: {[id: string]: string},
        toDelete?: any[],
        toKeep?: any[]
    } = {}
    //@ts-ignore
    return elements.promiseReduce(async ({toDelete, toKeep, servers, ...datas},element) => {
        const newServers = await updateDatasDict(servers,element,colsTypes.server,"server");

        if (someNonGettedData(newServers, colsTypes.server, element))
            return {
                servers: newServers,
                ...datas,
                toDelete: [...(toDelete??[]), element],
                toKeep: toKeep??[]
            };

        const {success, datas: newDatas} = await checkDatas(
            Object.entries(colsTypes),
            datas,
            element,
            colsTypes.server.map(colName => newServers[propAccess(element,colName)])
        )
        if (!success) {
            return {
                servers: newServers,
                ...newDatas,
                toDelete: [...(toDelete??[]), element],
                toKeep: toKeep??[]
            };
        }

        return {
            servers: newServers,
            ...newDatas,
            toDelete: toDelete??[],
            toKeep: [...(toKeep??[]), element],
        }
    }, acc)
}

function updateElementWithNewLists(element, cols, dict, updated = false) {
    if (cols.length === 0)
        return {element,updated};
    const newList = propAccess(element,cols[0]).filter(id => dict[id]);
    return updateElementWithNewLists(
        newList.length < propAccess(element,cols[0]).length ? propUpdate(element, cols[0], newList) : element,
        cols.slice(1),
        dict,
        updated||(newList.length < propAccess(element,cols[0]).length)
    )
}

async function checkDatasAndDeleteItemsInElementList(element: any, listTypes, datas, guilds: Guild[], updated = false) {
    if (listTypes.length === 0)
        return {element, updated};

    const [type, cols] = listTypes[0];

    const newDatas = {
        ...datas,
        [type+'s']: await updateDatasDict(datas[type+'s'],element, cols, type, guilds)
    }

    const {element: newElement, updated: newUpdated} = updateElementWithNewLists(element, cols, newDatas[type+'s'], updated)

    return checkDatasAndDeleteItemsInElementList(
        newElement,
        listTypes.slice(1),
        newDatas,
        guilds,
        newUpdated
    )
}

function checkAndDeleteUselessEntries(model, name, colsTypes, listsTypes = {}) {
    return model.find()
        .then(elements => filterElementsToDelete(elements, colsTypes))
        .then(({toDelete, toKeep, servers, ...datas}) => {
            if (toDelete.length === 0) {
                console.log("nothing to delete for "+name);
            }

            return Promise.all([
                ...toDelete.map(element => {
                    console.log("\nDelete "+name+" => ");
                    console.log(element);
                    return element.remove();
                }),
                ...toKeep.map(async element => {
                    const {updated, element: newElement} = await checkDatasAndDeleteItemsInElementList(
                        element._doc,
                        Object.entries(listsTypes),
                        datas,
                        colsTypes.server.map(colName => servers[propAccess(element,colName)])
                    )
                    if (updated) {
                        console.log('Update '+name+' '+element._id+' with new lists ');
                        await model.updateOne({
                            _id: element._id
                        }, newElement)
                    }
                })
            ])
        })
}

async function cleanDatabase() {

    await Promise.all([
        checkAndDeleteUselessEntries(TextAskInviteBack, "textAskInviteBack", {
            server: ['serverId'],
            member: ['requesterId','requestedId']
        }, {
            channel: ['channelsId']
        }),
        checkAndDeleteUselessEntries(VocalAskInviteBack, "vocalAskInviteBack", {
            server: ['serverId'],
            member: ['requesterId','requestedId']
        }),
        checkAndDeleteUselessEntries(TextConfig, "textConfig", {
            server: ['serverId']
        }, {
            channel: ['channelBlacklist'],
            member: ['listenerBlacklist.users'],
            role: ['listenerBlacklist.roles']
        }),
        checkAndDeleteUselessEntries(VocalConfig, "vocalConfig", {
            server: ['serverId']
        }, {
            channel: ['channelBlacklist'],
            member: ['listenerBlacklist.users'],
            role: ['listenerBlacklist.roles']
        })
    ])

    process.exit();
}

client.login(config.token);

client.on('ready', () => {
    cleanDatabase();
})
