import { incrementUnitToDate } from "../../Classes/OtherFunctions";
import MessagesStats from "../../Models/Stats/MessagesStats";
import StatsConfig, { defaultStatsExpiration } from "../../Models/Stats/StatsConfig";
import VocalConnectionsStats from "../../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats from "../../Models/Stats/VocalMinutesStats";
import VocalNewConnectionsStats from "../../Models/Stats/VocalNewConnectionsStats";
import { getDateWithPrecision } from "./statsCounters";

export default async function clearExpiredDatas(type: 'vocalMinutes'|'vocalConnections'|'vocalNewConnections'|'messages', serverId: string) {
    const model = {
        vocalMinutes: VocalMinutesStats,
        vocalConnections: VocalConnectionsStats,
        vocalNewConnections: VocalNewConnectionsStats,
        messages: MessagesStats
    }[type];

    const statsConfig = await StatsConfig.findOne({
        serverId,
    })

    const nbDays = statsConfig[type === "messages" ? "messagesExpiration" : "vocalExpiration"] ?? defaultStatsExpiration;

    return model.deleteMany({
        serverId,
        date: {$lt: incrementUnitToDate(getDateWithPrecision(), 'day', -nbDays)}
    })
}