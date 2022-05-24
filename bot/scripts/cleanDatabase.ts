import TextAskInviteBack from "../Models/Text/TextAskInviteBack";
import client from "../client";
import config from "../config";

//@ts-ignore
Array.prototype.promiseReduce = async function(callback,acc) {
    const arr: Array<any> = <Array<any>>this.valueOf();
    if (arr.length === 0)
        return acc;
    //@ts-ignore
    return arr.slice(1).promiseReduce(callback, await callback(acc, arr[0]))
}

//@ts-ignore
Array.prototype.promiseFind = function(callback) {
    //@ts-ignore
    return this.valueOf().promiseReduce(async (acc,elem) =>
        acc ?? (await callback(elem) ? elem : undefined)
        , undefined)
}

function filterElementsToDelete(elements: Array<typeof TextAskInviteBack>, colsTypes) {
    const acc: {
        serversById?: {[id: string]: string},
        membersById?: {[id: string]: string},
        toDelete?: any[]
    } = {}
    //@ts-ignore
    return elements.promiseReduce(async ({serversById,membersById,toDelete},element) => {
        const newServersById = {
        ...(serversById??{}),
        ...(colsTypes.server??[]).reduce((acc,colName) => ({
                ...acc,
                ...((!serversById || serversById[element[colName]] === undefined) ?
                        {[element[colName]] : client.guilds.cache.get(element[colName])??null} :
                        {}
                )
            }), {})
        }
        if ((colsTypes.server??[]).some(colName => !newServersById[element[colName]]))
            return {
                serversById: newServersById,
                membersById,
                toDelete: [...(toDelete??[]), element]
            };

        const newMembersById = {
            ...(membersById??{}),
            ...(await (colsTypes.member??[]).promiseReduce(async (acc,colName) => ({
                ...acc,
                ...((!membersById || membersById[element[colName]] === undefined) ?
                        {[element[colName]] : await colsTypes.server.promiseFind(async colName => {
                                try {
                                    return await newServersById[element[colName]].members.fetch(element[colName]);
                                } catch (e) {
                                    return false;
                                }
                            }).then(res => res??null)} :
                        {}
                )
            }), {}))
        }
        console.log({memberId: element[colsTypes.member[0]]});
        console.log({serverId: newServersById[element[colsTypes.server[0]]].id})
        try {
            console.log(newServersById[element[colsTypes.server[0]]].members.fetch(element[colsTypes.member[0]]));
        } catch(e) {
            console.log("nothing member")
        }
        if ((colsTypes.member??[]).some(colName => !newMembersById[element[colName]]))
            return {
                serversById: newServersById,
                membersById: newMembersById,
                toDelete: [...(toDelete??[]), element]
            };

        return {
            serversById: newServersById,
            membersById: newMembersById,
            toDelete: toDelete??[]
        }
    }, acc)
}

async function cleanDatabase() {
    const textAskInvitesBack = await TextAskInviteBack.find();

    const res = await filterElementsToDelete(textAskInvitesBack, {
        server: ['serverId'],
        member: ['requesterId','requestedId']
    });

    console.log({res});

    process.exit();
}

client.login(config.token);

client.on('ready', () => {
    cleanDatabase();
})
