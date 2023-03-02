import { Message, VoiceState } from "discord.js";
import StatsConfig, { IStatsConfig } from "../Models/Stats/StatsConfig";
import VocalConnectionsStats, { IVocalConnectionsStats } from "../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats, { IVocalMinutesStats } from "../Models/Stats/VocalMinutesStats";
import MessagesStats, { IMessagesStats } from "../Models/Stats/MessagesStats";
import { abortProcess, contactProcess, createProcess } from "./subProcessManager";

const precisions = {
    year: (date: Date) => {
        date.setMonth(0);
        return precisions.month(date);
    },
    month: (date: Date) => {
        date.setDate(0);
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

export function statsPrecisionExists(precision: string) {
    return precisions[precision] !== undefined
}

export type IStatsPrecisionUnits = keyof typeof precisions;

export function getDateWithPrecision(date: Date = new Date, precision: keyof typeof precisions = 'hour') {
    return precisions[precision](date);
}

export async function countingStats(type: 'vocalMinutes'|'vocalConnections'|'messages', serverId: string) {
    const date = getDateWithPrecision();

    const [model,colToIncrement] = {
        vocalMinutes: [VocalMinutesStats,'nbMinutes'],
        vocalConnections: [VocalConnectionsStats, 'nbVocalConnections'],
        messages: [MessagesStats, 'nbMessages']
    }[type]

    const statsObj: null|IMessagesStats|IVocalConnectionsStats|IVocalMinutesStats = await model.findOne({
        serverId,
        date
    });

    if (statsObj === null) {
        await model.create({
            serverId,
            date,
            [colToIncrement]: 1
        });
        return;
    }

    statsObj[colToIncrement] += 1;
    await statsObj.save();
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