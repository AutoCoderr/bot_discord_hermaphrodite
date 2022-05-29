import TextAskInviteBack from "../Models/Text/TextAskInviteBack";
import VocalAskInviteBack from "../Models/Vocal/VocalAskInviteBack";
import TextConfig from "../Models/Text/TextConfig";
import VocalConfig from "../Models/Vocal/VocalConfig";
import TextInvite from "../Models/Text/TextInvite";
import VocalInvite from "../Models/Vocal/VocalInvite";
import TextSubscribe from "../Models/Text/TextSubscribe";
import VocalSubscribe from "../Models/Vocal/VocalSubscribe";
import TextUserConfig from "../Models/Text/TextUserConfig";
import VocalUserConfig from "../Models/Vocal/VocalUserConfig";
import History from "../Models/History";
import MonitoringMessage from "../Models/MonitoringMessage";
import Permissions from "../Models/Permissions";
import StoredNotifyOnReact from "../Models/StoredNotifyOnReact";
import TicketConfig from "../Models/TicketConfig";
import WelcomeMessage from "../Models/WelcomeMessage";

import {propAccess, propUpdate} from "../Classes/OtherFunctions";

import client from "../client";
import config from "../config";
import {BaseGuildTextChannel, Guild, GuildChannel} from "discord.js";
import textUserConfig from "../Models/Text/TextUserConfig";

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


const getNeededs = () => ({
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
        if (!(channel instanceof BaseGuildTextChannel))
            return null;

        try {
            return await channel.messages.fetch(id)
        } catch (e) {
            console.log("message '"+id+"' does not exist on channel '"+channel.name+"' on guild '"+channel.guild.name+"'")
            return null;
        }
    }
}


async function updateDatasDict(dict: any,element, cols: string[], type: 'member'|'channel'|'message'|'role'|'emote'|'server', guildsOrChannels: null|Array<Guild|GuildChannel> = null) { //@ts-ignore
    return await (cols ?? []).promiseReduce(async (acc, col) => {
        const colName = col.col??col;
        const attrInItem = col.attr??null;
        const neededForThisCol = col.needed??null;
        return {
            ...acc,
            ...(propAccess(element, colName) === undefined ? {} :
                    await (propAccess(element,colName) instanceof Array ? propAccess(element,colName): [propAccess(element,colName)]).promiseReduce(async (acc,item) => ({
                        ...acc,
                        [propAccess(item,attrInItem)]: acc[propAccess(item,attrInItem)] !== undefined ? acc[propAccess(item,attrInItem)] :
                            guildsOrChannels ? //@ts-ignore
                                await guildsOrChannels.promiseFindElem(guildOrChannel =>
                                    (neededForThisCol === null || propAccess(element,neededForThisCol) === guildOrChannel.id) &&
                                    getters[type](propAccess(item,attrInItem), guildOrChannel)
                                ) :
                                await getters[type](propAccess(item,attrInItem))
                    }), acc)
            )
        }
    },  dict??{})
}

function someNonGettedData(dict: any, cols: Array<string|{col: string, needed?: string, attr?: string}>, element) {
    return (cols??[]).some(col => {
        const colName = typeof(col) == "string" ? col : col.col;
        return propAccess(element,colName) !== undefined && !dict[propAccess(element,colName)]
    });
}

async function checkDatas(types, colsTypes, datas, element, guildsOrChannels: null|Array<Guild|GuildChannel> = null) {
    if (types.length === 0)
        return {success: true, datas};

    const type = types[0];
    const cols = colsTypes[type];

    const newDatas = {
        ...datas,
        [type+'s']: await updateDatasDict(datas[type+'s'], element, cols, type, guildsOrChannels)
    }

    if (someNonGettedData(newDatas[type+'s'],cols,element))
        return {success: false, datas: newDatas};

    return checkDatas(types.slice(1), colsTypes, newDatas, element, guildsOrChannels);
}

async function checkDatasByNeededFields(neededs, colsTypes, datas, element) {
    const neededsArray = neededs instanceof Array ? neededs : Object.entries(neededs);
    if (neededsArray.length === 0)
        return {success: true, datas};

    const [needed, types] = neededsArray[0];

    const neededDatas = needed === "none" ?
        null :
        Object.values(<{[id: string]: Guild|GuildChannel}>(colsTypes[needed]??[])
            .reduce((acc,col) => {
                const colName = col.col ?? col;
                return {
                    ...acc,
                    [propAccess(element, colName)]: acc[propAccess(element, colName)]??datas[needed + 's'][propAccess(element, colName)]
                }
            },{}));

    const {success, datas: newDatas} = await checkDatas(types, colsTypes, datas, element, neededDatas);

    if (!success)
        return {success: false, datas: newDatas};

    return checkDatasByNeededFields(neededsArray.slice(1), colsTypes, newDatas, element)
}

function filterElementsToDelete(elements: Array<any>, colsTypes) {
    const acc: {
        servers?: {[id: string]: string},
        members?: {[id: string]: string},
        channels?: {[id: string]: string},
        roles?: {[id: string]: string},
        messages?: {[id: string]: string},

        toDelete?: any[],
        toKeep?: any[]
    } = {}
    //@ts-ignore
    return elements.promiseReduce(async ({toDelete, toKeep, ...datas},element) => {
        const {success, datas: newDatas} = await checkDatasByNeededFields(getNeededs(), colsTypes, datas, element);

        return {
            ...newDatas,
            toDelete: [...(toDelete??[]), ...(!success ? [element]: [])],
            toKeep: [...(toKeep??[]), ...(success ? [element]: [])]
        };
    }, acc)
}

function updateElementWithNewLists(element, cols, dict, updated = false) {
    if (cols.length === 0) {
        return {element, updated};
    }

    const col = cols[0];
    const colName = col.col??col;
    const attrInItem = col.attr??null;

    if (propAccess(element,colName) === undefined)
        return updateElementWithNewLists(element, cols.slice(1), dict, updated);

    const list = propAccess(element,colName)??[];
    const newList = list.filter(item => propAccess(item,attrInItem) === undefined || dict[propAccess(item,attrInItem)]);

    return updateElementWithNewLists(
        newList.length < list.length ? propUpdate(element, colName, newList) : element,
        cols.slice(1),
        dict,
        updated||(newList.length < list.length)
    )
}

async function checkDatasAndDeleteItemsInElementList(types, element: any, listTypes, datas, guildsOrChannel: Array<Guild|GuildChannel>|null, updated = false) {
    if (types.length === 0) {
        return {element, datas, updated};
    }

    const type = types[0];
    const cols = listTypes[type]??[];

    const newDatas = {
        ...datas,
        [type+'s']: await updateDatasDict(datas[type+'s'],element, cols, type, guildsOrChannel)
    }

    const {element: newElement, updated: newUpdated} = updateElementWithNewLists(element, cols, newDatas[type+'s'], updated)

    return checkDatasAndDeleteItemsInElementList(
        types.slice(1),
        newElement,
        listTypes,
        newDatas,
        guildsOrChannel,
        updated||newUpdated
    )
}

async function checkDatasByNeededToDeleteItemsInElementList(neededs, element, listTypes, colsTypes, datas, updated = false) {
    const neededsArray = neededs instanceof Array ? neededs : Object.entries(neededs);
    if (neededsArray.length === 0) {
        return {element, updated};
    }

    const [needed,types] = neededsArray[0];

    const neededDatas = needed === "none" ?
        null :
        Object.values(<{[id: string]: Guild|GuildChannel}>(colsTypes[needed]??[])
            .reduce((acc,col) => {
                const colName = col.col ?? col;
                return {
                    ...acc,
                    [propAccess(element, colName)]: acc[propAccess(element, colName)]??datas[needed + 's'][propAccess(element, colName)]
                }
            },{}));

    const {element: newElement, datas: newDatas, updated: newUpdated} = await checkDatasAndDeleteItemsInElementList(types, element, listTypes, datas, neededDatas)

    return checkDatasByNeededToDeleteItemsInElementList(
        neededsArray.slice(1),
        newElement,
        listTypes,
        colsTypes,
        newDatas,
        updated||newUpdated
    )
}

function checkAndDeleteUselessEntries(model, name, colsTypes, listsTypes = {}) {
    return model.find()
        .then(elements => filterElementsToDelete(elements, colsTypes))
        .then(({toDelete, toKeep, ...datas}) => {
            if (!toDelete || toDelete.length === 0) {
                console.log("nothing to delete for "+name);
            }

            return Promise.all([
                ...(toDelete??[]).map(element => {
                    console.log("\nDelete "+name+" => ");
                    console.log(element);
                    return element.remove();
                }),
                ...(toKeep??[]).map(async element => {
                    const {updated, element: newElement} = await checkDatasByNeededToDeleteItemsInElementList(
                        getNeededs(),
                        element._doc,
                        listsTypes,
                        colsTypes,
                        datas
                    )

                    if (updated) {
                        console.log('\nUpdate '+name+' '+element._id+' with new lists\n');
                        console.log(newElement);
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
        }),
        checkAndDeleteUselessEntries(TextInvite, "textInvite", {
            server: ['serverId'],
            member: ['requesterId','requestedId']
        }, {
            channel: ['channelsId']
        }),
        checkAndDeleteUselessEntries(VocalInvite, "vocalInvite", {
            server: ['serverId'],
            member: ['requesterId','requestedId']
        }),
        checkAndDeleteUselessEntries(TextSubscribe, "textSubscribe", {
            server: ['serverId'],
            member: ['listenerId','listenedId'],
            channel: ['channelId']
        }),
        checkAndDeleteUselessEntries(VocalSubscribe, "vocalSubscribe", {
            server: ['serverId'],
            member: ['listenerId','listenedId'],
        }),
        checkAndDeleteUselessEntries(TextUserConfig, "textUserConfig", {
            server: ['serverId'],
            member: ['userId']
        }, {
            channel: [{col: 'blocking', attr: 'channelId'}],
            member: [{col: 'blocking', attr: 'userId'}]
        }),
        checkAndDeleteUselessEntries(VocalUserConfig, "vocalUserConfig", {
            server: ['serverId'],
            member: ['userId']
        }, {
            member: ['blocked.users'],
            role: ['blocked.roles']
        }),
        checkAndDeleteUselessEntries(History, "history", {
            server: ['serverId'],
            member: ['userId'],
            channel: ['channelId']
        }),
        checkAndDeleteUselessEntries(MonitoringMessage, "monitoringMessage", {
            server: ['serverId'],
            channel: ['channelId'],
            message: ['messageId']
        }),
        checkAndDeleteUselessEntries(Permissions, "permission", {
            server: ['serverId']
        }, {
            role: ['roles']
        }),
        checkAndDeleteUselessEntries(StoredNotifyOnReact, "storedNotifyOnReact", {
            server: ['serverId'],
            emote: ['emoteId'],
            channel: ['channelToListenId','channelToWriteId'],
            message: [{col: 'messageToListenId', needed: 'channelToListenId'}]
        }),
        checkAndDeleteUselessEntries(TicketConfig, "ticketConfig", {
            server: ['serverId'],
            channel: ['categoryId'],
            role: ['moderatorId']
        }, {
            member: ['blacklist']
        }),
        checkAndDeleteUselessEntries(WelcomeMessage, "welcomeMessage", {
            server: ['serverId'],
        })
    ])

    process.exit();
}

client.login(config.token);

client.on('ready', () => {
    cleanDatabase();
})
