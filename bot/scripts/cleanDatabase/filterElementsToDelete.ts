import {Guild, GuildChannel} from "discord.js";
import {propAccess} from "../../Classes/OtherFunctions";
import {getNeededs, updateDatasDict} from "./datasGet";

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
                    [propAccess(element, colName)]: acc[propAccess(element, colName)]??datas[needed + 's'][propAccess(element, colName)]
                }
            },{}));

    const {success, datas: newDatas} = await checkDatas(types, colsTypes, datas, element, neededDatas);

    if (!success)
        return {success: false, datas: newDatas};

    return checkDatasByNeededFields(neededsArray.slice(1), colsTypes, newDatas, element)
}

export default function filterElementsToDelete(elements: Array<any>, colsTypes) {
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
