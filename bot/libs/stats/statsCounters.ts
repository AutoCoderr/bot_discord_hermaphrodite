import { Guild, Message, VoiceState } from "discord.js";
import StatsConfig, { defaultStatsExpiration, IStatsConfig } from "../../Models/Stats/StatsConfig";
import VocalConnectionsStats, { IVocalConnectionsStats } from "../../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats, { IVocalMinutesStats } from "../../Models/Stats/VocalMinutesStats";
import MessagesStats, { IMessagesStats } from "../../Models/Stats/MessagesStats";
import { abortProcess, contactProcess, createProcess } from "../subProcessManager";
import { addMissingZero, getDateGettersAndSettersFromUnit } from "../../Classes/OtherFunctions";
const precisions = {
    month: (date: Date) => {
        date.setDate(1);
        return precisions.day(date)
    },
    day: (date: Date) => {
        date.setHours(0);
        return precisions.hour(date)
    },
    hour: (date: Date) => {
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
    }
}

const unitsTexts = {
    hour: "Heure",
    day: "Jour",
    month: "Mois"
}
export function getStatsUnitText(unit: keyof typeof unitsTexts) {
    return unitsTexts[unit]
}
export function getAllStatsUnitTexts() {
    return unitsTexts;
}

export function getStatsUnitIndex(unit: keyof typeof precisions) {
    return Object.keys(precisions).indexOf(unit);
}

export function statsPrecisionExists(precision: string) {
    return precisions[precision] !== undefined
}

export type IStatsPrecisionUnits = keyof typeof precisions;

export function getDateWithPrecision(date: Date = new Date, precision: keyof typeof precisions = 'hour') {
    return precisions[precision](date);
}


function getDateTag(date: Date, precision: keyof typeof precisions) {
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

export async function exportStatsInCsv(guild: Guild, startDate: Date, type: 'messages'|'vocal', precision: keyof typeof precisions) {
    const models = type === "messages" ?
        [
            [MessagesStats, 'nbMessages', "Nombre de messages"]
        ] :
        [
            [VocalConnectionsStats, 'nbVocalConnections', "Nombre de connexions vocales"],
            [VocalMinutesStats, 'nbMinutes', "Nombre de minutes en vocal"]
        ];

    const datas = await Promise.all(models.map(([model]) => model.find({
        serverId: guild.id,
        date: {$gte: startDate}
    })))

    const aggregatedStats = {};

    for (let i=0;i<datas.length;i++) {
        for (const data of datas[i]) {
            const dateTag = getDateTag(data.date, precision);
            if (aggregatedStats[dateTag] === undefined) {
                aggregatedStats[dateTag] = {
                    [models[i][1]]: data[models[i][1]]
                }
                continue;
            }
            aggregatedStats[dateTag][models[i][1]] = (aggregatedStats[dateTag][models[i][1]]??0)+data[models[i][1]]
        }
    }

    let csv = "date;"+models.map(([_,__,labelCol]) => labelCol).join(";");
    
    const [getter,setter] = getDateGettersAndSettersFromUnit(precision);

    const currentDate = new Date();
    while (startDate.getTime() < currentDate.getTime()) {
        const dateTag = getDateTag(startDate, precision);
        const stat = aggregatedStats[dateTag];

        csv += "\n"+dateTag+";"+models.map(([_,col]) => (stat && stat[col]) ? stat[col] : 0).join(";");

        startDate[setter](startDate[getter]()+1)
    }
    
    return csv;
}

export async function countingStats(
    type: 'vocalMinutes'|'vocalConnections'|'messages', 
    serverId: string, 
    statsObjState: null|IMessagesStats|IVocalConnectionsStats|IVocalMinutesStats
) {
    const date = getDateWithPrecision();

    const [model,colToIncrement] = {
        vocalMinutes: [VocalMinutesStats,'nbMinutes'],
        vocalConnections: [VocalConnectionsStats, 'nbVocalConnections'],
        messages: [MessagesStats, 'nbMessages']
    }[type]

    const statsObj: null|IMessagesStats|IVocalConnectionsStats|IVocalMinutesStats = statsObjState === null ? await model.findOne({
        serverId,
        date
    }) : statsObjState

    if (statsObj === null || statsObj.date.getTime() !== date.getTime()) {
        return Promise.all([
            model.create({
                serverId,
                date,
                [colToIncrement]: 1
            }),
            clearExpiredDatas(type, serverId)
        ]).then(([statsObj]) => statsObj)
    }

    statsObj[colToIncrement] += 1;
    await statsObj.save();

    return statsObj;
}

export async function countingStatsMessagesEvent(message: Message) {
    if (message.guild === null)
        return;

    const statsConfig: null|IStatsConfig = await StatsConfig.findOne({
        serverId: message.guild.id,
        listenMessages: true
    })
    if (statsConfig === null)
        return;

    createProcess("/bot/scripts/queues/stats/messageCounter.js", "messageStats", message.guild.id);
    contactProcess(message.guild.id, "messageStats", message.guild.id);
}

export async function countingStatsVoiceConnectionsAndMinutesEvent(oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    const statsConfig: null|IStatsConfig = await StatsConfig.findOne({
        serverId: newVoiceState.guild.id,
        listenVocal: true
    })
    if (statsConfig === null)
        return;

    countingStatsVoicesMinutes(oldVoiceState, newVoiceState);

    if (newVoiceState.channelId === null || newVoiceState.channelId === oldVoiceState.channelId)
        return;

    createProcess("/bot/scripts/queues/stats/vocalCounter.js", "vocalStats", newVoiceState.guild.id);
    contactProcess({type: "vocalConnections", serverId: newVoiceState.guild.id}, "vocalStats", newVoiceState.guild.id)
    
}

function countingStatsVoicesMinutes(oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    if (newVoiceState.member === null)
        return;
    if (oldVoiceState.channelId !== null && (newVoiceState.channelId === null || oldVoiceState.guild.id !== newVoiceState.guild.id)) {
        abortProcess("voiceMinutesCounter", newVoiceState.member.id);
    }
    if (newVoiceState.channelId !== null && (oldVoiceState.channelId === null || oldVoiceState.guild.id !== newVoiceState.guild.id)) {
        createProcess("/bot/scripts/statsVocalMinutesCounter.js", "voiceMinutesCounter", newVoiceState.member.id, [newVoiceState.guild.id], 10_000);
    }
}

export async function clearExpiredDatas(type: 'vocalMinutes'|'vocalConnections'|'messages', serverId: string) {
    const model = {
        vocalMinutes: VocalMinutesStats,
        vocalConnections: VocalConnectionsStats,
        messages: MessagesStats
    }[type];

    const statsConfig = await StatsConfig.findOne({
        serverId,
    })

    const nbDays = statsConfig[type === "messages" ? "messagesExpiration" : "vocalExpiration"] ?? defaultStatsExpiration;

    return model.deleteMany({
        serverId,
        date: {$lt: new Date(new Date().getTime() - nbDays * 24 * 60 * 60 * 1000)}
    })
}