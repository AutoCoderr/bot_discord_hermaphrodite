import { countingStats } from "../../../libs/stats/statsCounters";
import createQueue from "../../../libs/createQueue";

createQueue((serverId) => countingStats('messages', serverId))