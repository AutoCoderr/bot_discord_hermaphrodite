import { rand } from "../../Classes/OtherFunctions";
import VocalAskInviteBack from "../../Models/Vocal/VocalAskInviteBack";
import VocalConfig from "../../Models/Vocal/VocalConfig";
import VocalInvite from "../../Models/Vocal/VocalInvite";
import VocalSubscribe from "../../Models/Vocal/VocalSubscribe";
import VocalUserConfig from "../../Models/Vocal/VocalUserConfig";
import { IConfig } from "./interfaces";

export default async function prepareVocal(config: IConfig) {
    if (!config.vocal)
        return;

    console.log("Configuring vocal ...");

    const date = new Date();
    const servers = config.servers instanceof Array ? config.servers : [config.servers];

    const serversIds = servers.map(({id}) => id);
    await Promise.all([
        VocalConfig, VocalSubscribe, VocalAskInviteBack, VocalInvite, VocalUserConfig
    ].map(model => model.deleteMany({serverId: {$in: serversIds}})));

    console.log("Old vocal config reset");

    await Promise.all(
        servers.map(async server => {
            await VocalConfig.create({
                enabled: true,
                serverId: server.id,
                channelBlacklist: [],
                listenerBlacklist: {roles: [], users: []}
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
                            VocalSubscribe.create({
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
    console.log("new vocal config generated");
}