import { countingStats } from "../../../libs/stats/statsCounters";
import createQueue from "../../../libs/createQueue";

createQueue(
    ({type, serverId}, state) => countingStats(type,serverId,state),
    ({type}) => type
)