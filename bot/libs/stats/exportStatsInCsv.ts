import { Guild } from "discord.js";
import { addMissingZero, getDateGettersAndSettersFromUnit } from "../../Classes/OtherFunctions";
import MessagesStats, {IMessagesStats} from "../../Models/Stats/MessagesStats";
import VocalConnectionsStats, { IVocalConnectionsStats } from "../../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats, {IVocalMinutesStats} from "../../Models/Stats/VocalMinutesStats";
import VocalNewConnectionsStats, { IVocalNewConnectionsStats } from "../../Models/Stats/VocalNewConnectionsStats";
import { IPrecision, getDateWithPrecision } from "./statsCounters";
import { Model } from "mongoose";
import { RequireAtLeastOne } from "../../interfaces/CommandInterfaces";

type IAllStatsModels = IMessagesStats|IVocalConnectionsStats|IVocalMinutesStats|IVocalNewConnectionsStats;

type IStatsDataInfosToExport = RequireAtLeastOne<{
    model: typeof Model,
    models: (typeof Model)[],
    col: string,
    text: string,
    increment?: (precision: IPrecision, data: any) => number
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
            increment: (precision, data: IVocalNewConnectionsStats|IVocalConnectionsStats) => {
                if (
                    data instanceof VocalNewConnectionsStats &&
                    precision !== "hour" &&
                    (
                        data.date.getHours() > 0 || (precision === "month" && data.date.getDate() > 1)
                    )
                ) {
                    return (<IVocalNewConnectionsStats>data).nbVocalNewConnections;
                }
                if (
                    data instanceof VocalConnectionsStats && (
                        precision === "hour" || (
                            data.date.getHours() === 0 && (precision === "day" || data.date.getDate() === 1 )
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

export default async function exportStatsInCsv(guild: Guild, startDate: Date, type: 'messages'|'vocal', precision: IPrecision) {
    const datasInfosToExport: IStatsDataInfosToExport[] = datasInfosToExportByType[type]

    const datas: (IAllStatsModels[]|IAllStatsModels[][])[] = await Promise.all(datasInfosToExport.map(({model,models}) => 
        model ?
            model.find({
                serverId: guild.id,
                date: {$gte: startDate}
            }) :
            Promise.all((<(typeof Model)[]>models).map(model =>
                model.find({
                    serverId: guild.id,
                    date: {$gte: startDate}
                })  
            ))
    ))

    const aggregatedStats = {};

    for (let i=0;i<datas.length;i++) {
        for (const dataOrDataArray of datas[i]) {
            for (const data of (dataOrDataArray instanceof Array ? dataOrDataArray : [dataOrDataArray])) {
                const dateTag = getDateTag(data.date, precision);
                const col = datasInfosToExport[i].col;

                const oldValue = (aggregatedStats[dateTag] && aggregatedStats[dateTag][col] !== undefined) ? aggregatedStats[dateTag][col] : 0
                const newValue = oldValue + (
                    (datasInfosToExport[i].increment !== undefined) ?
                        (<Required<IStatsDataInfosToExport>['increment']>datasInfosToExport[i].increment)(precision, data) : 
                        data[col]
                    )
                if (aggregatedStats[dateTag] === undefined) {
                    aggregatedStats[dateTag] = {
                        [col]: newValue
                    }
                    continue;
                }
                aggregatedStats[dateTag][col] = newValue;
            }
        }
    }

    let csv = "Date;"+datasInfosToExport.map(({text}) => text).join(";");
    
    const [getter,setter] = getDateGettersAndSettersFromUnit(precision);

    const date = getDateWithPrecision();
    while (date.getTime() >= startDate.getTime()) {
        const dateTag = getDateTag(date, precision);
        const stat = aggregatedStats[dateTag];

        csv += "\n"+dateTag+";"+datasInfosToExport.map(({col}) => (stat && stat[col]) ? stat[col] : 0).join(";");

        date[setter](date[getter]()-1)
    }
    
    return csv;
}

function getDateTag(date: Date, precision: IPrecision) {
    let tag = "";
    switch (precision) {
        case 'hour':
        case 'day':
            tag = addMissingZero(date.getDate())+"/"
        case 'month':
            tag += addMissingZero(date.getMonth()+1)+"/"
        default:
            tag += date.getFullYear()
    }

    if (precision === "hour")
        tag += " "+addMissingZero(date.getHours())+"h"
    
    return tag;
}