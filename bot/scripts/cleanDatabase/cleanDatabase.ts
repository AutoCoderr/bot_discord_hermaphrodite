import TextAskInviteBack, { ITextAskInviteBack, TextAskInviteBackTimeoutWithoutMessageId } from "../../Models/Text/TextAskInviteBack";
import VocalAskInviteBack, { IVocalAskInviteBack, VocalAskInviteBackTimeoutWithoutMessageId } from "../../Models/Vocal/VocalAskInviteBack";
import TextConfig from "../../Models/Text/TextConfig";
import VocalConfig from "../../Models/Vocal/VocalConfig";
import TextInvite, { ITextInvite, TextInviteTimeoutWithoutMessageId } from "../../Models/Text/TextInvite";
import VocalInvite, { IVocalInvite, VocalInviteTimeoutWithoutMessageId } from "../../Models/Vocal/VocalInvite";
import TextSubscribe from "../../Models/Text/TextSubscribe";
import VocalSubscribe from "../../Models/Vocal/VocalSubscribe";
import TextUserConfig from "../../Models/Text/TextUserConfig";
import VocalUserConfig from "../../Models/Vocal/VocalUserConfig";
import History from "../../Models/History";
import MonitoringMessage from "../../Models/MonitoringMessage";
import StoredNotifyOnReact from "../../Models/StoredNotifyOnReact";
import TicketConfig from "../../Models/TicketConfig";
import WelcomeMessage from "../../Models/WelcomeMessage";
import filterElementsToDelete from "./filterElementsToDelete";

import client from "../../client";
import getToUpdateElements from "./getToUpdateElements";
import MessagesStats from "../../Models/Stats/MessagesStats";
import VocalConnectionsStats from "../../Models/Stats/VocalConnectionsStats";
import VocalNewConnectionsStats from "../../Models/Stats/VocalNewConnectionsStats";
import VocalMinutesStats from "../../Models/Stats/VocalMinutesStats";
import StatsConfig from "../../Models/Stats/StatsConfig";
import { tryCatchCron } from "../../logging/catchers";

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

function checkAndDeleteUselessEntries<ModelType = any>(
    model, 
    name, 
    colsTypes, 
    listsTypes = {}, 
    colsExpires = {}, 
    filtersForDelete: null|((ModelType) => boolean) = null,
    groupedLoggingForDelete: boolean = false,
    groupedLoggingForUpdate: boolean = false
) {
    return model.find()
        .then(elements => filterElementsToDelete(elements, colsTypes, colsExpires, filtersForDelete))
        .then(({toDelete, toKeep, ...datas}) => {
            if (!toDelete || toDelete.length === 0) {
                console.log("nothing to delete for " + name);
            }

            return Promise.all([
                Promise.all((toDelete ?? []).map(element => {
                    if (!groupedLoggingForDelete) {
                        console.log("\nDelete " + name + " => ");
                        console.log(element);
                        }
                    return element.remove();
                })).then(() => {
                    if (groupedLoggingForDelete && toDelete && toDelete.length > 0) {
                        console.log("\nDelete " + name + " => ");
                        console.log(toDelete.length+" elements deleted")
                    }
                }),
                getToUpdateElements(toKeep ?? [], datas, listsTypes, colsTypes)
            ])
        })
        .then(([, toUpdateElements]) =>
            Promise.all(toUpdateElements.map(element => {
                if (!groupedLoggingForUpdate) {
                    console.log('\nUpdate ' + name + ' ' + element._id + ' with new lists\n');
                    console.log(element);
                }
                return model.updateOne({
                    _id: element._id
                }, element)
            })).then(() => {
                if (groupedLoggingForUpdate && toUpdateElements.length > 0) {
                    console.log("\nUpdate " + name + " => ");
                    console.log(toUpdateElements.length+" elements updated")
                }
            })
        )
}

client.on('ready', () => {
    tryCatchCron(() =>
        Promise.all([
            checkAndDeleteUselessEntries<ITextAskInviteBack>(TextAskInviteBack, "textAskInviteBack", {
                server: ['serverId'],
                member: ['requesterId', 'requestedId']
            }, {
                channel: ['channelsId']
            }, {
                timestamp: TextAskInviteBackTimeoutWithoutMessageId
            }, (elem) => elem.messageId === undefined),
            checkAndDeleteUselessEntries<IVocalAskInviteBack>(VocalAskInviteBack, "vocalAskInviteBack", {
                server: ['serverId'],
                member: ['requesterId', 'requestedId']
            }, {}, {
                timestamp: VocalAskInviteBackTimeoutWithoutMessageId
            }, (elem) => elem.messageId === undefined),
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
            checkAndDeleteUselessEntries<ITextInvite>(TextInvite, "textInvite", {
                server: ['serverId'],
                member: ['requesterId', 'requestedId']
            }, {
                channel: ['channelsId']
            }, {
                timestamp: TextInviteTimeoutWithoutMessageId
            }, (elem) => elem.messageId === undefined),
            checkAndDeleteUselessEntries<IVocalInvite>(VocalInvite, "vocalInvite", {
                server: ['serverId'],
                member: ['requesterId', 'requestedId']
            }, {}, {
                timestamp: VocalInviteTimeoutWithoutMessageId
            }, (elem) => elem.messageId === undefined),
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
            }),
            checkAndDeleteUselessEntries(MessagesStats, "messagesStats", {
                server: ['serverId']
            }, {}, {}, null, true),
            checkAndDeleteUselessEntries(VocalConnectionsStats, "vocalConnectionsStats", {
                server: ['serverId']
            }, {}, {}, null, true),
            checkAndDeleteUselessEntries(VocalNewConnectionsStats, "vocalNewConnectionsStats", {
                server: ['serverId']
            }, {}, {}, null, true),
            checkAndDeleteUselessEntries(VocalMinutesStats, "vocalMinutesStats", {
                server: ['serverId']
            }, {}, {}, null, true),
            checkAndDeleteUselessEntries(StatsConfig, "statsConfig", {
                server: ['serverId']
            })
        ]).then(() => process.exit())
    )
})
