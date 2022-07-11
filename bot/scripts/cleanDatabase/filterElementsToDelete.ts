import {Guild, GuildChannel} from "discord.js";
import {propAccess} from "../../Classes/OtherFunctions";
import {getNeededs, updateDatasDict} from "./datasGet";
import {extractDurationTime, extractUTCDate, extractUTCTime, showDate, showTime} from "../../Classes/DateTimeManager";

function someNonGettedData(dict: any, cols: Array<string|{col: string, needed?: string, attr?: string}>, element) {
    return (cols??[]).some(col => {
        const colName = typeof(col) == "string" ? col : col.col;
        return propAccess(element,colName) !== undefined && propAccess(element,colName) !== null && !dict[propAccess(element,colName)]
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
                    [propAccess(element, colName)]: acc[propAccess(element, colName)] ?? datas[needed + 's'][propAccess(element, colName)]
                }
            },{}));

    const {success, datas: newDatas} = await checkDatas(types, colsTypes, datas, element, neededDatas);

    if (!success)
        return {success: false, datas: newDatas};

    return checkDatasByNeededFields(neededsArray.slice(1), colsTypes, newDatas, element)
}

function checkExpiredFields(element: Array<any>, colsExpires, success = true) {
    const colsExpiresArray = colsExpires instanceof Array ? colsExpires : Object.entries(colsExpires);

    if (!success || colsExpiresArray.length === 0)
        return success;

    const [colName, expireTime] = colsExpiresArray[0];

    const col = propAccess(element,colName);

    if (!(col instanceof Date) && typeof(col) !== "number")
        return checkExpiredFields(
            element,
            colsExpiresArray.splice(1),
            true
        )

    const elementDate = col instanceof Date ? col : new Date(col);

    const newSuccess = elementDate.getTime() >= Date.now()-expireTime;

    if (!newSuccess) {
        console.log("timestamp "+showDate(extractUTCDate(elementDate), 'fr')+" expired after "+showTime(extractDurationTime(expireTime), 'classic'))
    }

    return checkExpiredFields(
        element,
        colsExpiresArray.splice(1),
        newSuccess
    )
}

export default function filterElementsToDelete(elements: Array<any>, colsTypes, colsExpires) {
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
        const checkedDatas = await checkDatasByNeededFields(getNeededs(), colsTypes, datas, element);
        const {datas: newDatas} = checkedDatas;
        const success = checkedDatas.success && checkExpiredFields(element,colsExpires);

        return {
            ...newDatas,
            toDelete: [...(toDelete??[]), ...(!success ? [element]: [])],
            toKeep: [...(toKeep??[]), ...(success ? [element]: [])]
        };
    }, acc)
}
