import { countingStats } from "../../../libs/StatsCounters";
import createQueue from "../../../libs/createQueue";

createQueue((serverId) => countingStats('messages', serverId))