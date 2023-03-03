import { countingStats } from "../../../libs/stats/statsCounters";
import createQueue from "../../../libs/createQueue";


createQueue(
    ({type, serverId}) => countingStats(type,serverId),
    ({type}) => type
)