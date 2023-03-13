import { rand } from "../../../Classes/OtherFunctions";
import MessagesStats from "../../../Models/Stats/MessagesStats";
import VocalConnectionsStats from "../../../Models/Stats/VocalConnectionsStats";
import VocalNewConnectionsStats, { IVocalNewConnectionsStats } from "../../../Models/Stats/VocalNewConnectionsStats";
import VocalMinutesStats from "../../../Models/Stats/VocalMinutesStats";
import { getDateWithPrecision } from "../../../libs/stats/statsCounters"
import client from "../../../client";
import { Guild } from "discord.js";

client.on('ready', async () => {
    const serverId = process.argv[2];
    if (serverId === undefined) {
        console.log("You need to mention a serverId !");
        process.exit();
    }

    const guild: undefined|Guild = client.guilds.cache.get(serverId);
    if (guild === undefined) {
        console.log("The guild '"+serverId+"' has not found");
        process.exit();
    }

    const currentDate = new Date();

    const date = getDateWithPrecision(new Date(currentDate.getTime() - 120 * 24 * 60 * 60 * 1000));

    await Promise.all([MessagesStats, VocalConnectionsStats, VocalNewConnectionsStats, VocalMinutesStats].map(model => model.deleteMany({})))

    let lastNbVocalConnections = 0;

    while (date.getTime() < currentDate.getTime()) {
        const [,[,vocalConnectionsStats]] = await Promise.all([
            [MessagesStats,'nbMessages', [0,10]],
            [VocalNewConnectionsStats, 'nbVocalNewConnections', [0,5], (vocalNewConnectionsStat: IVocalNewConnectionsStats) =>
                VocalConnectionsStats.create({
                    serverId,
                    date,
                    nbVocalConnections: vocalNewConnectionsStat.nbVocalNewConnections+rand(0,Math.min(5,lastNbVocalConnections))
                })
            ],
            [VocalMinutesStats, 'nbMinutes', [0,10]]
        ].map(async ([model, col, [a,b], func]) => {
            const created = await model.create({
                serverId,
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

    console.log("generation terminated");
    process.exit();
})