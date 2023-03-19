import { Model } from "mongoose"
import TextConfig from "../../Models/Text/TextConfig"
import VocalConfig from "../../Models/Vocal/VocalConfig"
import TicketConfig from "../../Models/TicketConfig"
import WelcomeMessage from "../../Models/WelcomeMessage"
import XPData from "../../Models/XP/XPData"
import MonitoringMessage, { IMonitoringMessage } from "../../Models/MonitoringMessage"
import StoredNotifyOnReact, { IStoredNotifyOnReact } from "../../Models/StoredNotifyOnReact"
import StatsConfig, { IStatsConfig } from "../../Models/Stats/StatsConfig"
import { Guild } from "discord.js"

interface IConfigResource {
    model: typeof Model,
    is_enabled?: (model: any) => boolean
}

export type IConfigResourceKey = keyof typeof configResourcesKeys

interface IGroupedConfigByResourcesByModel {
    [collectionName: string]: {
        model: typeof Model,
        keys: {
            [key: IConfigResourceKey]: Omit<IConfigResource, 'model'>
        }
    }
}

export const configResourcesKeys: {[key: string]: IConfigResource} = {
    text: {
        model: TextConfig
    },
    vocal: {
        model: VocalConfig
    },
    tickets: {
        model: TicketConfig
    },
    welcome: {
        model: WelcomeMessage
    },
    XP: {
        model: XPData
    },
    monitor: {
        model: MonitoringMessage,
        is_enabled: (_: IMonitoringMessage) => true
    },
    notify_on_react: {
        model: StoredNotifyOnReact,
        is_enabled: (_: IStoredNotifyOnReact) => true
    },
    vocal_stats: {
        model: StatsConfig,
        is_enabled: (statsConfig: IStatsConfig) => statsConfig.listenVocal
    },
    messages_stats: {
        model: StatsConfig,
        is_enabled: (statsConfig: IStatsConfig) => statsConfig.listenMessages
    }
}

export default async function getServerConfigResources(keys: null|(keyof typeof configResourcesKeys)[], guilds: Guild[]) {
    const keysGroupedByModel: IGroupedConfigByResourcesByModel = (keys??Object.keys(configResourcesKeys)).reduce((acc,key) => {
        const collectionName = configResourcesKeys[key].model.collection.collectionName;
        return {
            ...acc,
            [collectionName]: {
                model: configResourcesKeys[key].model,
                keys: {
                    ...(acc[collectionName] ? acc[collectionName].keys : {}),
                    [key]: {
                        ...configResourcesKeys[key],
                        model: undefined
                    }
                }
            }
        }
    }, {})
    
    const fetchedModelsWithKeys = await Promise.all(
        Object.values(keysGroupedByModel)
            .map(({model, keys}) =>
                model.find({
                    serverId: {$in: guilds.map(({id}) => id)}
                })
                .then(configs => ({
                    datas: configs.reduce((acc,config) => ({
                        ...acc,
                        [config.serverId]: config
                    }), {}),
                    keys
                }))
            )
    )

    return fetchedModelsWithKeys.reduce((acc,{datas,keys}) => (
        Object.entries(keys).reduce((acc,[key,{is_enabled}]) => ({
            ...acc,
            [key]: guilds.reduce((acc,guild) => ({
                ...acc,
                [guild.id]: datas[guild.id] ? 
                                (is_enabled ? is_enabled(datas[guild.id]) : datas[guild.id].enabled) :
                                false
            }), {})
        }), acc)
    ), {})
}