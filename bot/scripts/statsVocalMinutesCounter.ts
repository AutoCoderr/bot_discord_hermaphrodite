import VocalStats, { IVocalStats } from "../Models/Stats/VocalStats";
import { getDateWithPrecision } from "../libs/StatsCounters";

async function addMinute(serverId: string) {
    const date = getDateWithPrecision();
    const vocalStats: null|IVocalStats = await VocalStats.findOne({
        serverId,
        date,
    });
    if (vocalStats == null) {
        await VocalStats.create({
            serverId,
            date,
            nbMinutes: 1
        })
        return;
    }
    vocalStats.nbMinutes += 1;
    await vocalStats.save()
}

setTimeout(() => {
    const [serverId] = process.argv.slice(2);

    addMinute(serverId);

    setInterval(() => addMinute(serverId), 60*1000)
}, 50*1000)