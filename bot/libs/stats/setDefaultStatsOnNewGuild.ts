import { Guild } from "discord.js";
import StatsConfig, { IStatsConfig } from "../../Models/Stats/StatsConfig";

export default async function setDefaultStatsOnNewGuild(guild: Guild) {
    const [defaultStatsConfig,currentStatsConfig]: (null|IStatsConfig)[] = await Promise.all(
        ["default",guild.id].map(serverId =>
            StatsConfig.findOne({serverId})    
        )
    );

    if (currentStatsConfig !== null || defaultStatsConfig === null)
        return;
    
    await StatsConfig.create({
        serverId: guild.id,

        listenVocal: defaultStatsConfig.listenVocal,
        vocalActivePeriods: defaultStatsConfig.listenVocal ?
                                [{
                                    startDate: new Date()
                                }] : [],
        vocalExpiration: defaultStatsConfig.vocalExpiration,
                                

        listenMessages: defaultStatsConfig.listenMessages,
        messagesActivePeriods: defaultStatsConfig.listenMessages ?
                                [{
                                    startDate: new Date()
                                }] : [],
        messagesExpiration: defaultStatsConfig.messagesExpiration,
    })
}