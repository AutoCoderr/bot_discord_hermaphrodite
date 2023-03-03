import MessagesStats from "../../Models/Stats/MessagesStats";
import StatsConfig, { defaultStatsExpiration } from "../../Models/Stats/StatsConfig";
import VocalConnectionsStats from "../../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats from "../../Models/Stats/VocalMinutesStats";

export default async function clearExpiredDatas(type: 'vocalMinutes'|'vocalConnections'|'messages', serverId: string) {
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