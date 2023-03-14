import StatsConfig, { IStatsConfig } from "../../Models/Stats/StatsConfig";

export function getStatsConfigsByGuildsIds(guildsIds: string[]): Promise<{[serverId: string]: IStatsConfig}> {
    return StatsConfig.find({
        serverId: {$in: guildsIds}
    }).then(statsConfigs => statsConfigs.reduce((acc,statsConfig) => ({
        ...acc,
        [statsConfig.serverId]: statsConfig
    }), {}))
}