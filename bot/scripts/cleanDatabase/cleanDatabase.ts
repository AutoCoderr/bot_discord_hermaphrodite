import TextAskInviteBack from "../../Models/Text/TextAskInviteBack";
import VocalAskInviteBack from "../../Models/Vocal/VocalAskInviteBack";
import TextConfig from "../../Models/Text/TextConfig";
import VocalConfig from "../../Models/Vocal/VocalConfig";
import TextInvite from "../../Models/Text/TextInvite";
import VocalInvite from "../../Models/Vocal/VocalInvite";
import TextSubscribe from "../../Models/Text/TextSubscribe";
import VocalSubscribe from "../../Models/Vocal/VocalSubscribe";
import TextUserConfig from "../../Models/Text/TextUserConfig";
import VocalUserConfig from "../../Models/Vocal/VocalUserConfig";
import History from "../../Models/History";
import MonitoringMessage from "../../Models/MonitoringMessage";
import Permissions from "../../Models/Permissions";
import StoredNotifyOnReact from "../../Models/StoredNotifyOnReact";
import TicketConfig from "../../Models/TicketConfig";
import WelcomeMessage from "../../Models/WelcomeMessage";
import filterElementsToDelete from "./filterElementsToDelete";

import client from "../../client";
import textUserConfig from "../../Models/Text/TextUserConfig";
import getToUpdateElements from "./getToUpdateElements";
import Text from "../../Commands/Text";
import Vocal from "../../Commands/Vocal";

//@ts-ignore
Array.prototype.promiseReduce = async function (callback, acc) {
    const arr: Array<any> = <Array<any>>this.valueOf();
    if (arr.length === 0)
        return acc;
    //@ts-ignore
    return arr.slice(1).promiseReduce(callback, await callback(acc, arr[0]))
}

//@ts-ignore
Array.prototype.promiseFindElem = async function (callback, elem = null) {
    if (elem)
        return elem;
    const arr: Array<any> = <Array<any>>this.valueOf();
    if (arr.length === 0)
        return elem;
    //@ts-ignore
    return arr.slice(1).promiseFindElem(callback, await callback(arr[0]))
}

function checkAndDeleteUselessEntries(model, name, colsTypes, listsTypes = {}, colsExpires = {}) {
    return model.find()
        .then(elements => filterElementsToDelete(elements, colsTypes, colsExpires))
        .then(({toDelete, toKeep, ...datas}) => {
            if (!toDelete || toDelete.length === 0) {
                console.log("nothing to delete for " + name);
            }

            return Promise.all([
                Promise.all((toDelete ?? []).map(element => {
                    console.log("\nDelete " + name + " => ");
                    console.log(element);
                    return element.remove();
                })),
                getToUpdateElements(toKeep ?? [], datas, listsTypes, colsTypes)
            ])
        })
        .then(([, toUpdateElements]) =>
            Promise.all(toUpdateElements.map(element => {
                console.log('\nUpdate ' + name + ' ' + element._id + ' with new lists\n');
                console.log(element);
                return model.updateOne({
                    _id: element._id
                }, element)
            }))
        )
}

async function cleanDatabase() {
    await Promise.all([
        checkAndDeleteUselessEntries(TextAskInviteBack, "textAskInviteBack", {
            server: ['serverId'],
            member: ['requesterId', 'requestedId']
        }, {
            channel: ['channelsId']
        }, {
            timestamp: Text.buttonsTimeout
        }),
        checkAndDeleteUselessEntries(VocalAskInviteBack, "vocalAskInviteBack", {
            server: ['serverId'],
            member: ['requesterId', 'requestedId']
        }, {}, {
            timestamp: Vocal.buttonsTimeout
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
            member: ['requesterId', 'requestedId']
        }, {
            channel: ['channelsId']
        }, {
            timestamp: Text.buttonsTimeout
        }),
        checkAndDeleteUselessEntries(VocalInvite, "vocalInvite", {
            server: ['serverId'],
            member: ['requesterId', 'requestedId']
        }, {}, {
            timestamp: Vocal.buttonsTimeout
        }),
        checkAndDeleteUselessEntries(TextSubscribe, "textSubscribe", {
            server: ['serverId'],
            member: ['listenerId', 'listenedId'],
            channel: ['channelId']
        }),
        checkAndDeleteUselessEntries(VocalSubscribe, "vocalSubscribe", {
            server: ['serverId'],
            member: ['listenerId', 'listenedId'],
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
            channel: ['channelToListenId', 'channelToWriteId'],
            message: [{col: 'messageToListenId', needed: 'channelToListenId'}]
        }),
        checkAndDeleteUselessEntries(TicketConfig, "ticketConfig", {
            server: ['serverId'],
            channel: ['categoryId'],
            role: ['moderatorId']
        }, {
            member: ['blacklist', { col:'ticketChannels', attr: 'userId' }],
            channel: [
                { col: 'ticketChannels', attr: 'channelId' },
                { col: 'messagesToListen', attr: 'channelId' }
            ],
            message: [{ col: 'messagesToListen', attr: 'messageId', needed: '$item.channelId' }],
            emote: [{ col: 'messagesToListen', attr: 'emoteId' }]
        }),
        checkAndDeleteUselessEntries(WelcomeMessage, "welcomeMessage", {
            server: ['serverId'],
        })
    ])

    process.exit();
}

client.on('ready', () => {
    cleanDatabase();
})
