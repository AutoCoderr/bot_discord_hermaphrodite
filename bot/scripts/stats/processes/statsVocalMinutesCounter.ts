import { getDateWithPrecision } from "../../../libs/stats/statsCounters";
import {tryCatchProcess} from "../../../logging/catchers";

let lastDate: Date = getDateWithPrecision();

function addMinute(serverId: string) {
    if (process.send === undefined)
        return;
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


