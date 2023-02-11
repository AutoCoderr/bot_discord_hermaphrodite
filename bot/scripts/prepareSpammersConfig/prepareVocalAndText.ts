import { Model, Schema } from "mongoose";
import { rand } from "../../Classes/OtherFunctions";
import TextAskInviteBack from "../../Models/Text/TextAskInviteBack";
import TextConfig from "../../Models/Text/TextConfig";
import TextInvite from "../../Models/Text/TextInvite";
import TextSubscribe from "../../Models/Text/TextSubscribe";
import TextUserConfig from "../../Models/Text/TextUserConfig";
import VocalAskInviteBack from "../../Models/Vocal/VocalAskInviteBack";
import VocalConfig from "../../Models/Vocal/VocalConfig";
import VocalInvite from "../../Models/Vocal/VocalInvite";
import VocalSubscribe from "../../Models/Vocal/VocalSubscribe";
import VocalUserConfig from "../../Models/Vocal/VocalUserConfig";
import { IConfig, INotificationConfig } from "./interfaces";

const checkAndSetConfigs = (configFields: [keyof IConfig,string][]) =>
    (config: IConfig) =>
        configFields.reduce((acc,[configField,wantedField]) => ({
            ...acc,
            ...(
                config[configField] !== undefined ?
                    {
                        [wantedField]: config[configField]
                    } : {}
            )
        }), {})

const datasByTypes: {
    [type: string]: INotificationConfig
} = {
    vocal: {
        configModel: VocalConfig,
        subscribeModel: VocalSubscribe,
        allModels: [VocalConfig, VocalSubscribe, VocalAskInviteBack, VocalInvite, VocalUserConfig],
        getNbListenByUser: (config: IConfig) => config.vocalNbListenByUser,
        additionnalConfigParams: checkAndSetConfigs([
            ['vocalDelay','delay'],
            ['vocalDefaultLimit', 'defaultLimit']
        ])
    },
    text: {
        configModel: TextConfig,
        subscribeModel: TextSubscribe,
        allModels: [TextConfig, TextSubscribe, TextAskInviteBack, TextInvite, TextUserConfig],
        getNbListenByUser: (config: IConfig) => config.textNbListenByUser,
        additionnalConfigParams: checkAndSetConfigs([
            ['textDefaultLimit', 'defaultLimit']
        ])
    }
}


export default async function prepareVocalAndText(config: IConfig, type: 'vocal'|'text') {
    if (!config[type])
        return;

    console.log("\nConfiguring "+type+" ...");

    const date = new Date();
    const servers = config.servers instanceof Array ? config.servers : [config.servers];

    const serversIds = servers.map(({id}) => id);
    await Promise.all(datasByTypes[type].allModels.map(model => model.deleteMany({serverId: {$in: serversIds}})));

    console.log("Old "+type+" config reset");

    await Promise.all(
        servers.map(async server => {
            await datasByTypes[type].configModel.create({
                enabled: true,
                serverId: server.id,
                channelBlacklist: [],
                listenerBlacklist: {roles: [], users: []},
                ...datasByTypes[type].additionnalConfigParams(config)
            });

            const spammersSubscribes: {listenerId: string, listenedIds: string[]}[] = server.spammersIds
                .map(spammerId => {
                    const nbListened = config.vocalNbListenByUser ?
                        config.vocalNbListenByUser instanceof Array ?
                            rand(config.vocalNbListenByUser[0],config.vocalNbListenByUser[1]) :
                            config.vocalNbListenByUser :
                        rand(1,3);
                    return {
                        listenerId: spammerId,
                        listenedIds: ((n: number) => {
                            const spammersIds: string[] = server.spammersIds.filter(id => id !== spammerId)
                            const toInvites: string[] = [];
                            for (let i=0;i<n;i++) {
                                const index = rand(0,spammersIds.length-1)
                                toInvites.push(spammersIds[index]);
                                spammersIds.splice(index,1)
                            }
                            return toInvites;
                        })(Math.min(nbListened,server.spammersIds.length-1))
                    }
                })
            
            return Promise.all(
                spammersSubscribes.map(({listenerId, listenedIds}) =>
                    Promise.all(
                        listenedIds.map(listenedId =>
                            datasByTypes[type].subscribeModel.create({
                                serverId: server.id,
                                listenerId,
                                listenedId,
                                timestamp: date,
                                enabled: true
                            })    
                        )
                    )
                )
            )
        })
    )
    console.log("New "+type+" config generated");
}