import { Message, VoiceState } from "discord.js";
import StatsConfig, { IStatsConfig } from "../../Models/Stats/StatsConfig";
import VocalConnectionsStats, { IVocalConnectionsStats } from "../../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats, { IVocalMinutesStats } from "../../Models/Stats/VocalMinutesStats";
import MessagesStats, { IMessagesStats } from "../../Models/Stats/MessagesStats";
import { abortProcess, contactProcess, createProcess } from "../subProcessManager";
import VocalNewConnectionsStats, { IVocalNewConnectionsStats } from "../../Models/Stats/VocalNewConnectionsStats";
import clearExpiredDatas from "./clearExpiredDatas";

export type IPrecision = keyof typeof precisions;

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

export function getStatsUnitIndex(unit: IPrecision) {
    return Object.keys(precisions).indexOf(unit);
}

export function statsPrecisionExists(precision: IPrecision) {
    return precisions[precision] !== undefined
}

export type IStatsPrecisionUnits = keyof typeof precisions;

export function getDateWithPrecision(date: Date = new Date(), precision: IPrecision = 'hour') {
    return precisions[precision](date);
}

export async function countingStats(
    type: 'vocalMinutes'|'vocalConnections'|'vocalNewConnections'|'messages', 
    serverId: string, 
    statsObjState: null|IMessagesStats|IVocalConnectionsStats|IVocalNewConnectionsStats|IVocalMinutesStats
) {
    const date = getDateWithPrecision();

    const [model,colToIncrement] = {
        vocalMinutes: [VocalMinutesStats,'nbMinutes'],
        vocalConnections: [VocalConnectionsStats, 'nbVocalConnections'],
        vocalNewConnections: [VocalNewConnectionsStats, 'nbVocalNewConnections'],
        messages: [MessagesStats, 'nbMessages']
    }[type]

    const statsObj: null|IMessagesStats|IVocalConnectionsStats|IVocalNewConnectionsStats|IVocalMinutesStats = statsObjState === null ? await model.findOne({
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

    try {
        statsObj[colToIncrement] += 1;
        await statsObj.save();
    } catch (e) {
        const msg = "No document found for query";
        if ((<Error>e).message.substring(0,msg.length) === msg) {
            return  model.create({
                serverId,
                date,
                [colToIncrement]: 1
            })
        }
        throw e;
    }

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
    contactProcess({type: "vocalNewConnections", serverId: newVoiceState.guild.id}, "vocalStats", newVoiceState.guild.id)
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