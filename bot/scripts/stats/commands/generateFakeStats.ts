import { rand } from "../../../Classes/OtherFunctions";
import MessagesStats from "../../../Models/Stats/MessagesStats";
import VocalConnectionsStats from "../../../Models/Stats/VocalConnectionsStats";
import VocalNewConnectionsStats, { IVocalNewConnectionsStats } from "../../../Models/Stats/VocalNewConnectionsStats";
import VocalMinutesStats from "../../../Models/Stats/VocalMinutesStats";
import { getDateWithPrecision } from "../../../libs/stats/statsCounters"
import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import { calculCoefActivationByPrecision } from "../../../libs/stats/exportStatsInCsv";
import StatsConfig, { IStatsConfig } from "../../../Models/Stats/StatsConfig";

function cmdError(msg) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_generate_fake_datas <servers: all|server_id1, server_id2, server_idn>")
    process.exit();
}

client.on('ready', async () => {
    const ids = process.argv.slice(2);

    const guilds = checkAndGetGivenGuilds(ids, client, cmdError);

    console.log("Les guilds suivants vont avoir leur stats purgées et regénérées aléatoirement :");
    console.log("\n"+guilds.map(({name,id}) => name+" ("+id+")").join("\n")+"\n")

    await Promise.all([MessagesStats, VocalConnectionsStats, VocalNewConnectionsStats, VocalMinutesStats].map(model => 
        model.deleteMany({serverId: {$in: guilds.map(({id}) => id)}})
    ))

    const statsConfigsByServerId: {[id: string]: IStatsConfig|null} = await Promise.all(
        guilds.map(guild =>
            StatsConfig.findOne({serverId: guild.id})    
        )
    ).then(statsConfigs => statsConfigs.reduce((acc,statsConfig,i) => ({
        ...acc,
        [guilds[i].id]: statsConfig
    }), {}));

    const activePeriodIndexByTypeAndServerId: {[type: string]: {[id: string]: number}} = {messages: {}, vocal: {}};

    const currentDate = getDateWithPrecision(new Date(), "hour");
    const startDate = getDateWithPrecision(new Date(currentDate.getTime() - 120 * 24 * 60 * 60 * 1000));

    await Promise.all(
        guilds.map(async guild => {
            
            const endDate = new Date(currentDate.getTime());

            let lastNbVocalConnections = 0;

            while (endDate.getTime() >= startDate.getTime()) {
                const [coefMessages,coefVocal] = [['messages','messagesActivePeriods'],['vocal','vocalActivePeriods']].map(([type,activePeriodCol]) => {
                    const {coef,periodIndex} = statsConfigsByServerId[guild.id] === null ? 
                        {coef: 0, periodIndex: activePeriodIndexByTypeAndServerId[type][guild.id]??null} : 
                        calculCoefActivationByPrecision(
                            endDate,
                            "hour",
                            activePeriodIndexByTypeAndServerId[type][guild.id]??null,
                            (<IStatsConfig>statsConfigsByServerId[guild.id])[activePeriodCol]
                        )
                    
                    if (periodIndex !== null)
                        activePeriodIndexByTypeAndServerId[type][guild.id] = periodIndex;

                    return coef
                })
                
                const [,vocalConnectionsStatsRes] = await Promise.all([
                    [MessagesStats,'nbMessages', [5,10], coefMessages],
                    [VocalNewConnectionsStats, 'nbVocalNewConnections', [4,5], coefVocal,(vocalNewConnectionsStat: IVocalNewConnectionsStats) =>
                        VocalConnectionsStats.create({
                            serverId: guild.id,
                            date: endDate,
                            nbVocalConnections: vocalNewConnectionsStat.nbVocalNewConnections+rand(0,Math.min(5,lastNbVocalConnections))
                        })
                    ],
                    [VocalMinutesStats, 'nbMinutes', [5,10], coefVocal]
                ]
                .map(async ([model, col, [a,b],coef, func]) => {
                    if (coef === 0)
                        return null;

                    const created = await model.create({
                        serverId: guild.id,
                        date: endDate,
                        [col]: rand(a,b)
                    });
                    
                    return func ?
                        [created, await func(created)] :
                        created;
                }))
                    
                lastNbVocalConnections = vocalConnectionsStatsRes === null ? 0 : vocalConnectionsStatsRes[1].nbVocalConnections;
        
                endDate.setHours(endDate.getHours()-1)
            }
        })
    )

    console.log("generation terminated");
    process.exit();
})