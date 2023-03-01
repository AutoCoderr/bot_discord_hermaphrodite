import { countingStats } from "../../../libs/StatsCounters";
import createQueue from "../../../libs/createQueue";


createQueue(
    ({type, serverId}) => countingStats(type,serverId),
    ({type}) => type
)