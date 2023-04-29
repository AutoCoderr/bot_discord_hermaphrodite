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

type IAggregateState = {
    activePeriodIndexByServerId: {[serverId: string]: number},
    statsConfigsByServerId: {[id: string]: IStatsConfig|null}
};
type IStatsDataInfosToExport = RequireAtLeastOne<{
    model: typeof Model,
    models: (typeof Model)[],
    col: string,
    text: string,
    aggregate?: (
        precision: IPrecision, 
        data: {date: Date, datas: any}, 
        date: Date, 
        state: IAggregateState) => [number,IAggregateState]
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
            models: [VocalNewConnectionsStats,VocalConnectionsStats],
            col: 'nbVocalConnections', 
            text: "Nombre de connexions vocales",
            aggregate: (precision, {date: UTCDate, datas: [newConnectionObj,connectionObj]}: {date: Date, datas: [IVocalNewConnectionsStats,IVocalConnectionsStats]}, date, {activePeriodIndexByServerId, statsConfigsByServerId}) => {
                const {coef, periodIndex} = (
                    precision === "hour" || (
                        date.getHours() === 0 && (precision === "day" || date.getDate() === 1 )
                    ) ? 
                        {
                            coef: 0,
                            periodIndex: activePeriodIndexByServerId[newConnectionObj.serverId]??null
                        } :
                        calculCoefActivationByPrecision(
                            incrementUnitToDate(UTCDate, "hour", -1), 
                            "hour", 
                            activePeriodIndexByServerId[newConnectionObj.serverId]??null,
                            (<IStatsConfig>statsConfigsByServerId[newConnectionObj.serverId]).vocalActivePeriods
                        )
                )
                if (periodIndex !== null)
                    activePeriodIndexByServerId[newConnectionObj.serverId] = periodIndex;

                const value = newConnectionObj.nbVocalNewConnections+(connectionObj.nbVocalConnections-newConnectionObj.nbVocalNewConnections)*(1-coef);
                
                return [
                    value,
                    {activePeriodIndexByServerId, statsConfigsByServerId}
                ];
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
        activePeriods.length <= periodIndex ||
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

function aggregateCsvColumn(aggregatedLine: {[col: string]: string|number}, col: string, newValue: number, exportType: IExportType, guild: Guild, coef: number) {
    if (coef === 0)
        return;
    const value = <null|number>(aggregatedLine[col] ?? null);
    if (exportType === "sum") {
        aggregatedLine[col] = (value??0)+newValue;
        return;
    }
    if (exportType === "avg") {
        aggregatedLine[col] = (value??0)+(newValue*coef);
        return;
    }
    const ponderedNewValue = newValue/coef;
    const ponderedValue = value !== null ? value/(<number>aggregatedLine["server_coef_"+col]) : null;
    if (ponderedValue === null || (exportType === "max" && ponderedNewValue > ponderedValue) || (exportType === "min" && ponderedNewValue < ponderedValue)) {
        aggregatedLine[col] = newValue;
        aggregatedLine["server_"+col] = guild.name+" ("+guild.id+") ("+round(coef,2)+")"
        aggregatedLine["server_coef_"+col] = coef
    }
}

function addDatasToCsv(
    csvs: IExportedCsvs,
    dateTag: string,
    aggregatedStatsByGuildId: IAggregatedStatsByGuildId,
    colsToGet: string[], 
    exportType: IExportType,
    guilds: Guild[],
    activeCoefsByGuild: number[]
) {
    if (exportType === "default") {
        for (let i=0;i<guilds.length;i++) {
            const {id} = guilds[i];
            const coef = activeCoefsByGuild[i];

            csvs[id] += "\n"+dateTag+";"+
                colsToGet.map(
                    (col) => coef > 0 ?
                                (aggregatedStatsByGuildId[id][dateTag] && aggregatedStatsByGuildId[id][dateTag][col]) ? 
                                round(aggregatedStatsByGuildId[id][dateTag][col], 2) : 
                                0 :
                             "-"
                ).join(";")+";"+round(coef,2)
        }
        return;
    }
    const aggregatedLine = {};
    for (const col of colsToGet) {
        for (let i=0;i<guilds.length;i++) {
            const guild = guilds[i];
            aggregateCsvColumn(
                aggregatedLine, 
                col, 
                (aggregatedStatsByGuildId[guild.id][dateTag] && aggregatedStatsByGuildId[guild.id][dateTag][col]) ? 
                    aggregatedStatsByGuildId[guild.id][dateTag][col] : 
                    0, 
                exportType, 
                guild,
                activeCoefsByGuild[i]
            )
        }
    }

    const sumCoefs = activeCoefsByGuild.reduce((acc,n) => acc+n ,0)

    csvs.all += "\n"+dateTag+";"+colsToGet
        .map(col => 
            aggregatedLine[col] ? 
                (
                    exportType === "avg" ? 
                        round(
                            aggregatedLine[col]/sumCoefs,
                            2
                        ) : 
                        round(aggregatedLine[col], 2)
                ) : 
                (sumCoefs > 0 ? 0 : "-")
        ).join(";")+(
            ["max","min"].includes(exportType) ? 
                ";"+ colsToGet.map(col => aggregatedLine["server_"+col] ?? "-").join(";") : 
                ""
        )+";"+round(sumCoefs,2)
}

export default async function exportStatsInCsv(
    guilds: Guild[], 
    exportType: IExportType,
    localSpecifiedDate: Date, 
    afterOrBefore: 'after'|'before', 
    type: 'messages'|'vocal', 
    precision: IPrecision,
    specifiedTimezone: null|string = null
): Promise<string|{[guildId: string]: string}> {

    const specifiedDate = specifiedTimezone === null ? 
            localSpecifiedDate :
            new Date(
                moment.tz(
                    convertDateToMomentTimeZoneFormat(localSpecifiedDate),
                    specifiedTimezone
                )
                .utc()
                .format()
            )

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
    // For each column data : A list of datas, grouped by hour. Stored datas are related to all mentionnel models for a column

    const datas: ({date: Date, datas: IAllStatsModels[]})[][][] = await Promise.all(
        guilds.map(guild =>
            Promise.all(datasInfosToExport.map(({model,models}) => 
                Promise.all((<(typeof Model)[]>(models??[model])).map(model =>
                    model.find({
                        serverId: guild.id,
                        date: {[afterOrBefore === "after" ? "$gte" : "$lt"]: specifiedDate}
                    }).sort({
                        date: -1
                    })
                )).then(datass => 
                        <({date: Date, datas: IAllStatsModels[]})[]>
                        Object.values(datass.reduce((acc,datas) => 
                            datas.reduce((acc,data) => {
                                const dateTag = getDateTag(data.date, "hour");
                                return {
                                    ...acc,
                                    [dateTag]: {
                                        date: <Date>data.date,
                                        datas: [
                                            ...(acc[dateTag] ? acc[dateTag].datas : []),
                                            data
                                        ]
                                    }
                                }
                            },acc)
                        , {}))
                )
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
            for (const data of datas[i][j]) {
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
                        )[0] : data.datas.reduce((acc,data) => acc+data[col] ,0)
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
    
    const [getter,setter] = getDateGettersAndSettersFromUnit(precision);

    const firstLine = "Date;"+datasInfosToExport.map(({text}) => text).join(";")+(
        ["max","min"].includes(exportType) ? 
            ";"+datasInfosToExport.map(({text}) => "Serveur - "+text[0].toLowerCase()+text.substring(1)).join(";") : 
            ""
        )+(
            exportType === "default" ?
              ";Coeficient" :
              ";Serveurs totaux"
        );
    let csvs: IExportedCsvs = (exportType === "default" ? guilds.map(({id}) => id) : ["all"])
        .reduce((acc,key) => ({
            ...acc,
            [key]: firstLine
        }), {});

    const colsToGet = datasInfosToExport.map(({col}) =>col);

    activePeriodIndexByServerId = {};

    const activePeriodCol = type === 'messages' ? 'messagesActivePeriods' : 'vocalActivePeriods';

    const now = new Date();
    const localNow = specifiedTimezone === null ?
                        now :
                        new Date(
                            removeTimeZoneFromISODate(
                                moment.utc(
                                    convertDateToMomentTimeZoneFormat(now)
                                )
                                .tz(specifiedTimezone)
                                .format()
                            )
                        )

    const localEndDate: Date = afterOrBefore === "after" ? 
                    getDateWithPrecision(localNow, precision) : 
                    incrementUnitToDate(getDateWithPrecision(localSpecifiedDate, precision), precision, -1);
    
    
    const localStartDate: Date = (afterOrBefore === "before" && oldestDate) ? 
                            getDateWithPrecision(oldestDate, precision) : 
                            getDateWithPrecision(localSpecifiedDate, precision);

    while (localEndDate.getTime() >= localStartDate.getTime()) {
        const UTCEndDate = specifiedTimezone === null ? 
            localEndDate :
            new Date(
                moment.tz(
                    convertDateToMomentTimeZoneFormat(localEndDate),
                    specifiedTimezone
                )
                .utc()
                .format()
            )
        const activeCoefsByGuild: number[] = guilds.map(guild => {
            if (statsConfigsByServerId[guild.id] === null)
                return 0

            const {coef, periodIndex} = calculCoefActivationByPrecision(
                UTCEndDate, 
                precision, 
                activePeriodIndexByServerId[guild.id]??null,
                (<IStatsConfig>statsConfigsByServerId[guild.id])[activePeriodCol]
            )

            if (periodIndex !== null)
                activePeriodIndexByServerId[guild.id] = periodIndex;
            
            return coef
        })

        const dateTag = getDateTag(
            localEndDate, 
            precision
        );

        addDatasToCsv(csvs, dateTag, aggregatedStatsByGuildId, colsToGet, exportType, guilds, activeCoefsByGuild);

        localEndDate[setter](localEndDate[getter]()-1)
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