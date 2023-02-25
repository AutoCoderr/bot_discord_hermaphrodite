import VocalStats, { IVocalStats } from "../Models/Stats/VocalStats";
import { getDateWithPrecision } from "../libs/StatsCounters";

const [serverId] = process.argv.slice(2);
    
setInterval(async () => {
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
}, 60*1000)