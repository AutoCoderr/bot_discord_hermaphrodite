import { rand } from "../../../Classes/OtherFunctions";
import MessagesStats from "../../../Models/Stats/MessagesStats";
import VocalConnectionsStats from "../../../Models/Stats/VocalConnectionsStats";
import VocalNewConnectionsStats, { IVocalNewConnectionsStats } from "../../../Models/Stats/VocalNewConnectionsStats";
import VocalMinutesStats from "../../../Models/Stats/VocalMinutesStats";
import { getDateWithPrecision } from "../../../libs/stats/statsCounters"
import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";

function cmdError(msg) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_generate_fake_datas <servers: all|server_id1, server_id2, server_idn>")
    process.exit();
}

client.on('ready', async () => {
    const ids = process.argv.slice(2);

    const guilds = checkAndGetGivenGuilds(ids, client, cmdError);

    const currentDate = new Date();

    console.log("Les guilds suivants vont avoir leur stats purgées et regénérées aléatoirement :");
    console.log("\n"+guilds.map(({name,id}) => name+" ("+id+")").join("\n")+"\n")

    await Promise.all([MessagesStats, VocalConnectionsStats, VocalNewConnectionsStats, VocalMinutesStats].map(model => 
        model.deleteMany({serverId: {$in: guilds.map(({id}) => id)}})
    ))

    await Promise.all(
        guilds.map(async guild => {
            const date = getDateWithPrecision(new Date(currentDate.getTime() - 120 * 24 * 60 * 60 * 1000));

            let lastNbVocalConnections = 0;

            while (date.getTime() < currentDate.getTime()) {
                const [,[,vocalConnectionsStats]] = await Promise.all([
                    [MessagesStats,'nbMessages', [0,10]],
                    [VocalNewConnectionsStats, 'nbVocalNewConnections', [0,5], (vocalNewConnectionsStat: IVocalNewConnectionsStats) =>
                        VocalConnectionsStats.create({
                            serverId: guild.id,
                            date,
                            nbVocalConnections: vocalNewConnectionsStat.nbVocalNewConnections+rand(0,Math.min(5,lastNbVocalConnections))
                        })
                    ],
                    [VocalMinutesStats, 'nbMinutes', [0,10]]
                ].map(async ([model, col, [a,b], func]) => {
                    const created = await model.create({
                        serverId: guild.id,
                        date,
                        [col]: rand(a,b)
                    });
                    
                    return func ?
                        [created, await func(created)] :
                        created;
                }))
        
                lastNbVocalConnections = vocalConnectionsStats.nbVocalConnections;
        
                date.setHours(date.getHours()+1)
            }
        })
    )

    console.log("generation terminated");
    process.exit();
})