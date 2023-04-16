import { Guild } from "discord.js";
import { addMissingZero, getDateGettersAndSettersFromUnit, incrementUnitToDate, round } from "../../Classes/OtherFunctions";
import MessagesStats, {IMessagesStats} from "../../Models/Stats/MessagesStats";
import VocalConnectionsStats, { IVocalConnectionsStats } from "../../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats, {IVocalMinutesStats} from "../../Models/Stats/VocalMinutesStats";
import VocalNewConnectionsStats, { IVocalNewConnectionsStats } from "../../Models/Stats/VocalNewConnectionsStats";
import { IPrecision, getDateWithPrecision } from "./statsCounters";
import { Model } from "mongoose";
import { RequireAtLeastOne } from "../../interfaces/CommandInterfaces";
import { convertDateToMomentTimeZoneFormat, removeTimeZoneFromISODate } from "../timezones";
import moment from "moment-timezone";
import StatsConfig, { IStatsActivePeriod, IStatsConfig } from "../../Models/Stats/StatsConfig";

type IAllStatsModels = IMessagesStats|IVocalConnectionsStats|IVocalMinutesStats|IVocalNewConnectionsStats;

type IStatsDataInfosToExport = RequireAtLeastOne<{
    model: typeof Model,
    models: (typeof Model)[],
    col: string,
    text: string,
    aggregate?: (
        precision: IPrecision, 
        data: any, 
        date: Date, 
        state: {
            activePeriodIndexByServerId: {[serverId: string]: number},
            statsConfigsByServerId: {[id: string]: IStatsConfig|null}
        }) => number
}, 'model'|'models'>

const datasInfosToExportByType: {[type: string]: IStatsDataInfosToExport[]} = {
    messages: [
        {
            model: MessagesStats, 
            col: 'nbMessages', 
            text: "Nombre de messages"
        }
    ],
    vocal: [
        {
            models: [VocalConnectionsStats,VocalNewConnectionsStats],
            col: 'nbVocalConnections', 
            text: "Nombre de connexions vocales",
            aggregate: (precision, data: IVocalNewConnectionsStats|IVocalConnectionsStats, date, {activePeriodIndexByServerId, statsConfigsByServerId}) => {
                if (
                    data instanceof VocalNewConnectionsStats &&
                    precision !== "hour" &&
                    (
                        date.getHours() > 0 || (precision === "month" && date.getDate() > 1)
                    )
                ) {
                    return (<IVocalNewConnectionsStats>data).nbVocalNewConnections;
                }
                if (
                    data instanceof VocalConnectionsStats && (
                        precision === "hour" || (
                            date.getHours() === 0 && (precision === "day" || date.getDate() === 1 )
                        )
                    )
                ) {
                    return (<IVocalConnectionsStats>data).nbVocalConnections;
                }

                return 0;
            }
        },
        {
            model: VocalMinutesStats,
            col: 'nbMinutes', 
            text: "Nombre de minutes en vocal"
        }
    ]
}

export type IAggregatedStatsByGuildId = {[guildId: string]: {[time: string]: {[col: string]: number}}};
export type IExportedCsvs = {[key: string]: string};
export type IExportType = 'default'|'sum'|'avg'|'max'|'min';

function completeCoefFromOtherPeriods(startDate: Date, periodIndex: number, activePeriods: IStatsActivePeriod[]) {
    let coef = 0;
    while (
        periodIndex < activePeriods.length &&
        (<Date>activePeriods[periodIndex].endDate).getTime() > startDate.getTime()
    ) {
        coef += (<Date>activePeriods[periodIndex].endDate).getTime() - Math.max(startDate.getTime(),activePeriods[periodIndex].startDate.getTime());
        periodIndex += 1;
    }
    return coef;
}

export function calculCoefActivationByPrecision(startDate: Date, precision: IPrecision, periodIndex: null|number, activePeriods: IStatsActivePeriod[]): {coef: number, periodIndex: null|number} {
    const endDate = incrementUnitToDate(startDate, precision, 1);
    while (
        periodIndex === null || 
        endDate.getTime() < activePeriods[periodIndex].startDate.getTime()
    ) {
        if (activePeriods.length <= (periodIndex??-1)+1)
            return {coef: 0, periodIndex};

        periodIndex = periodIndex !== null ? periodIndex+1 : 0;
    }

    return {
        periodIndex,
        coef: (
            (
            activePeriods[periodIndex].endDate &&
            endDate.getTime() > (<Date>activePeriods[periodIndex].endDate).getTime()    
        ) ? 
            completeCoefFromOtherPeriods(startDate, periodIndex, activePeriods) :
            (Math.min(endDate.getTime(),new Date().getTime()) - Math.max(startDate.getTime(),activePeriods[periodIndex].startDate.getTime())) + completeCoefFromOtherPeriods(startDate, periodIndex+1,activePeriods)
        )/(endDate.getTime()-startDate.getTime())
    }
}

function aggregateCsvColumn(aggregatedLine: {[col: string]: string|number}, col: string, newValue: number, exportType: IExportType, guild: Guild) {
    const value = <null|number>(aggregatedLine[col] ?? null);
    if (['sum','avg'].includes(exportType)) {
        aggregatedLine[col] = (value??0)+newValue;
        return;
    }
    if (value === null || (exportType === "max" && newValue > value) || (exportType === "min" && newValue < value)) {
        aggregatedLine[col] = newValue;
        aggregatedLine["server_"+col] = guild.name+" ("+guild.id+")"
    }
}

function addDatasToCsv(
    csvs: IExportedCsvs,
    dateTag: string,
    aggregatedStatsByGuildId: IAggregatedStatsByGuildId,
    colsToGet: string[], 
    exportType: IExportType,
    guilds: Guild[],
    enabledGuildsOrNot: boolean[]
) {
    if (exportType === "default") {
        for (let i=0;i<guilds.length;i++) {
            const {id} = guilds[i];
            const enabled = enabledGuildsOrNot[i];

            csvs[id] += "\n"+dateTag+";"+
                colsToGet.map(
                    (col) => enabled ?
                                (aggregatedStatsByGuildId[id][dateTag] && aggregatedStatsByGuildId[id][dateTag][col]) ? 
                                aggregatedStatsByGuildId[id][dateTag][col] : 
                                0 :
                             "-"
                ).join(";")
        }
        return;
    }
    const aggregatedLine = {};
    for (const col of colsToGet) {
        for (let i=0;i<guilds.length;i++) {
            if (!enabledGuildsOrNot[i])
                continue;
            const guild = guilds[i];
            aggregateCsvColumn(
                aggregatedLine, 
                col, 
                (aggregatedStatsByGuildId[guild.id][dateTag] && aggregatedStatsByGuildId[guild.id][dateTag][col]) ? 
                    aggregatedStatsByGuildId[guild.id][dateTag][col] : 
                    0, 
                exportType, 
                guild
            )
        }
    }
    csvs.all += "\n"+dateTag+";"+colsToGet
        .map(col => 
            aggregatedLine[col] ? 
                (
                    exportType === "avg" ? 
                        round(
                            aggregatedLine[col]/enabledGuildsOrNot.filter(enabled => enabled).length,
                            2
                        ) : 
                        aggregatedLine[col]
                ) : 
                0
        ).join(";")+(
            ["max","min"].includes(exportType) ? 
                ";"+ colsToGet.map(col => aggregatedLine["server_"+col] ?? "").join(";") : 
                ""
        )+(["avg","sum"].includes(exportType) ? 
                ";"+enabledGuildsOrNot.filter(enabled => enabled).length :
                ""
        )
}

export default async function exportStatsInCsv(
    guilds: Guild[], 
    exportType: IExportType,
    specifiedDate: Date, 
    afterOrBefore: 'after'|'before', 
    type: 'messages'|'vocal', 
    precision: IPrecision,
    specifiedTimezone: null|string = null
): Promise<string|{[guildId: string]: string}> {
    const datasInfosToExport: IStatsDataInfosToExport[] = datasInfosToExportByType[type];

    const statsConfigsByServerId: {[id: string]: IStatsConfig|null} = await Promise.all(
        guilds.map(guild =>
            StatsConfig.findOne({serverId: guild.id})    
        )
    ).then(statsConfigs => statsConfigs.reduce((acc,statsConfig,i) => ({
        ...acc,
        [guilds[i].id]: statsConfig
    }), {}))

    // For each guild : a columns data list to calcul
    // For each column data : a list of element lists, each element list corresponding to a mongoose model
    const datas: IAllStatsModels[][][][] = await Promise.all(
        guilds.map(guild =>
            Promise.all(datasInfosToExport.map(({model,models}) => 
                Promise.all((<(typeof Model)[]>(models??[model])).map(model =>
                    model.find({
                        serverId: guild.id,
                        date: {[afterOrBefore === "after" ? "$gte" : "$lt"]: specifiedDate}
                    })  
                ))
            ))
        )
    )

    let activePeriodIndexByServerId: {[serverId: string]: number} = {};

    const aggregatedStatsByGuildId: IAggregatedStatsByGuildId = {};
    let oldestDate: null|Date = null;

    for (let i=0;i<datas.length;i++) {
        const guild = guilds[i];
        aggregatedStatsByGuildId[guild.id] = {}
        for (let j=0;j<datas[i].length;j++) {
            for (const modelDatas of datas[i][j]) {
                for (const data of modelDatas) {
                    const date = specifiedTimezone === null ?
                                    data.date :
                                    new Date(
                                        removeTimeZoneFromISODate(
                                            moment.utc(
                                                convertDateToMomentTimeZoneFormat(data.date)
                                            )
                                            .tz(specifiedTimezone)
                                            .format()
                                        )
                                    )
                    if (afterOrBefore === "before" && (oldestDate === null || date.getTime() < oldestDate.getTime())) {
                        oldestDate = date;
                    }
                    const dateTag = getDateTag(date, precision);
                    const col = datasInfosToExport[j].col;
    
                    const oldValue = (aggregatedStatsByGuildId[guild.id][dateTag] && aggregatedStatsByGuildId[guild.id][dateTag][col] !== undefined) ? aggregatedStatsByGuildId[guild.id][dateTag][col] : 0
                    const newValue = oldValue + (
                        (datasInfosToExport[j].aggregate !== undefined) ?
                            (<Required<IStatsDataInfosToExport>['aggregate']>datasInfosToExport[j].aggregate)(
                                precision, data, date, {activePeriodIndexByServerId, statsConfigsByServerId}
                            ) : 
                            data[col]
                        )
                    if (aggregatedStatsByGuildId[guild.id][dateTag] === undefined) {
                        aggregatedStatsByGuildId[guild.id][dateTag] = {
                            [col]: newValue
                        }
                        continue;
                    }
                    aggregatedStatsByGuildId[guild.id][dateTag][col] = newValue;
                }
            }
        }
    }
    
    const [getter,setter] = getDateGettersAndSettersFromUnit(precision);

    const endDate: Date = afterOrBefore === "after" ? 
                    getDateWithPrecision(new Date(), precision) : 
                    incrementUnitToDate(specifiedDate, precision, -1);
    const startDate: Date = afterOrBefore === "after" ? 
                    specifiedDate : 
                    (oldestDate ? getDateWithPrecision(oldestDate, precision) : specifiedDate);

    const firstLine = "Date;"+datasInfosToExport.map(({text}) => text).join(";")+(
        ["max","min"].includes(exportType) ? 
            ";"+datasInfosToExport.map(({text}) => "Serveur - "+text[0].toLowerCase()+text.substring(1)).join(";") : 
            ""
        )+(
            ["avg","sum"].includes(exportType) ?
              ";Serveurs actifs" :
              ""
        );
    let csvs: IExportedCsvs = (exportType === "default" ? guilds.map(({id}) => id) : ["all"])
        .reduce((acc,key) => ({
            ...acc,
            [key]: firstLine
        }), {});

    const colsToGet = datasInfosToExport.map(({col}) =>col);

    activePeriodIndexByServerId = {};

    const activePeriodCol = type === 'messages' ? 'messagesActivePeriods' : 'vocalActivePeriods';

    while (endDate.getTime() >= startDate.getTime()) {
        const enabledGuildsOrNot: boolean[] = guilds.map(guild => {
            const statsConfig: null|IStatsConfig = statsConfigsByServerId[guild.id];
            if (statsConfig === null)
                return false;
        
            while (
                activePeriodIndexByServerId[guild.id] === undefined || 
                endDate.getTime() < statsConfig[activePeriodCol][activePeriodIndexByServerId[guild.id]].startDate.getTime()
            ) {
                if (statsConfig[activePeriodCol].length <= (activePeriodIndexByServerId[guild.id]??-1)+1)
                    return false;

                activePeriodIndexByServerId[guild.id] = activePeriodIndexByServerId[guild.id] !== undefined ? activePeriodIndexByServerId[guild.id]+1 : 0;
            }

            if (
                statsConfig[activePeriodCol][activePeriodIndexByServerId[guild.id]].endDate && 
                endDate.getTime() > (<Date>statsConfig[activePeriodCol][activePeriodIndexByServerId[guild.id]].endDate).getTime()
            )
                return false;
            
            return true;
        })

        const dateTag = getDateTag(
            specifiedTimezone === null ?
            endDate :
                new Date(
                    removeTimeZoneFromISODate(
                        moment.utc(
                            convertDateToMomentTimeZoneFormat(endDate)
                        )
                        .tz(specifiedTimezone)
                        .format()
                    )
                ), 
            precision
        );

        addDatasToCsv(csvs, dateTag, aggregatedStatsByGuildId, colsToGet, exportType, guilds, enabledGuildsOrNot);

        endDate[setter](endDate[getter]()-1)
    }
    
    return csvs;
}

export function getDateTag(date: Date, precision: IPrecision, lang = "fr") {
    let tag = "";
    switch (precision) {
        case 'hour':
        case 'day':
            const day = addMissingZero(date.getDate());
            tag = lang === "fr" ? day+"/" : day
        case 'month':
            const month = addMissingZero(date.getMonth()+1);
            tag = lang === "fr" ? tag+month+"/" : month+"-"+tag
        default:
            const year = date.getFullYear()
            tag = lang === "fr" ? tag+year : year+"-"+tag
    }

    if (precision === "hour")
        tag += " "+addMissingZero(date.getHours())+"h"
    
    return tag;
}