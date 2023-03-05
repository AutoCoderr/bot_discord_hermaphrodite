import { rand } from "../Classes/OtherFunctions";
import MessagesStats from "../Models/Stats/MessagesStats";
import VocalConnectionsStats from "../Models/Stats/VocalConnectionsStats";
import VocalMinutesStats from "../Models/Stats/VocalMinutesStats";
import { getDateWithPrecision } from "../libs/stats/statsCounters"


(async () => {
    const serverId = process.argv[2];
    if (serverId === undefined) {
        console.log("You need to mention a serverId !");
        process.exit();
    }

    const date = getDateWithPrecision(new Date(new Date().getTime() - 180 * 24 * 60 * 60 * 1000));

    await Promise.all([MessagesStats, VocalConnectionsStats, VocalMinutesStats].map(model => model.deleteMany({})))

    const currentDate = new Date();

    while (date.getTime() < currentDate.getTime()) {
        await Promise.all([
            [MessagesStats,'nbMessages'],
            [VocalConnectionsStats, 'nbVocalConnections'],
            [VocalMinutesStats, 'nbMinutes']
        ].map(([model, col]) => model.create({
            serverId,
            date,
            [col]: rand(0,10)
        })))

        date.setHours(date.getHours()+1)
    }

    console.log("generation terminated");
    process.exit();
})()