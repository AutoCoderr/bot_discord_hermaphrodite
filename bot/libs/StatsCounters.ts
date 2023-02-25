import { Message, VoiceState } from "discord.js";
import StatsConfig, { IStatsConfig } from "../Models/Stats/StatsConfig";
import VocalStats, { IVocalStats } from "../Models/Stats/VocalStats";
import MessagesStats, { IMessagesStats } from "../Models/Stats/MessagesStats";

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

function getDateWithPrecision(date: Date = new Date, precision: keyof typeof precisions = 'hour') {
    return precisions[precision](date);
}

export async function countingStatsMessages(message: Message) {
    if (message.guild === null)
        return;

    const statsConfig: null|IStatsConfig = await StatsConfig.findOne({
        serverId: message.guild.id,
        listenMessages: true
    })
    if (statsConfig === null)
        return;

    const date = getDateWithPrecision();

    const messageStats: null|IMessagesStats = await MessagesStats.findOne({
        serverId: message.guild.id,
        date
    });

    if (messageStats === null) {
        await MessagesStats.create({
            serverId: message.guild.id,
            date,
            nbMessages: 1
        });
        return;
    }

    messageStats.nbMessages += 1;
    await messageStats.save();
}

export async function countingStatsVoiceConnections(oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    if (newVoiceState.channelId === null || newVoiceState.channelId === oldVoiceState.channelId)
        return;

    const statsConfig: null|IStatsConfig = await StatsConfig.findOne({
        serverId: newVoiceState.guild.id,
        listenVocal: true
    })
    if (statsConfig === null)
        return;

    const date = getDateWithPrecision();

    const vocalStats: null|IVocalStats = await VocalStats.findOne({
        serverId: newVoiceState.guild.id,
        date
    })

    if (vocalStats === null) {
        await VocalStats.create({
            serverId: newVoiceState.guild.id,
            date,
            nbVocalConnections: 1
        });
        return;
    }

    vocalStats.nbVocalConnections += 1;
    await vocalStats.save();
}