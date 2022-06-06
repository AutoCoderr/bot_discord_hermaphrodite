import {propAccess, propUpdate} from "../../Classes/OtherFunctions";
import {Guild, GuildChannel} from "discord.js";
import {getNeededs, updateDatasDict} from "./datasGet";

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
        return {element, updated, datas};
    }

    const [needed,types] = neededsArray[0];

    const neededDatas = needed === "none" ?
        null :
        Object.values(<{[id: string]: Guild|GuildChannel}>[...(colsTypes[needed]??[]), ...(listTypes[needed]??[])]
            .reduce((acc,col) => {
                const colName = col.col ?? col;
                const attrInItem = col.attr ?? null;
                return {
                    ...acc,
                    ...(propAccess(element, colName) instanceof Array ? propAccess(element, colName) : [propAccess(element, colName)]).reduce((acc,item) => ({
                        ...acc,
                        [propAccess(item, attrInItem)]: acc[propAccess(item, attrInItem)]??datas[needed + 's'][propAccess(item, attrInItem)]
                    }), acc)
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

export default async function getToUpdateElements(elements: Array<{_doc: any}>, datas, listsTypes, colsTypes, toUpdate: any[] = []) {
    if (elements.length === 0)
        return toUpdate;

    const element = elements[0];

    const {updated, element: newElement, datas: newDatas} = await checkDatasByNeededToDeleteItemsInElementList(
        getNeededs(),
        element._doc,
        listsTypes,
        colsTypes,
        datas
    )

    return getToUpdateElements(
        elements.slice(1),
        newDatas,
        listsTypes,
        colsTypes,
        [...toUpdate, ...(updated ? [newElement] : [])]
    )
}
