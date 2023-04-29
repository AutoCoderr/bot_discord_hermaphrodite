import StatsConfig, { IStatsConfig } from "../../../Models/Stats/StatsConfig";
import { getDateWithPrecision } from "../../../libs/stats/statsCounters";
import {tryCatchProcess} from "../../../logging/catchers";

let lastDate: Date = getDateWithPrecision();

async function addMinute(serverId: string) {
    if (
        process.send === undefined ||
        (await StatsConfig.findOne({
            serverId,
            listenVocal: true
        })) === null
    )
        process.exit();

    const newDate = getDateWithPrecision();
    if (lastDate.getTime() !== newDate.getTime()) {
        lastDate = newDate;
        process.send({tag: "vocalStats", key: serverId, data: {type: "vocalConnections", serverId}})
    }
    process.send({tag: "vocalStats", key: serverId, data: {type: "vocalMinutes", serverId}})
}

tryCatchProcess(({setTimeout, setInterval}) => {
    setTimeout(() => {
        const [serverId] = process.argv.slice(2);
    
        addMinute(serverId);
    
        setInterval(() => addMinute(serverId), 60*1000)
    }, 50*1000)
})


