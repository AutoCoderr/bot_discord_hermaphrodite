import IReportedData from "../interfaces/IReportedDatas";
import {logDebug} from "./logger";

export default function reportDebug(message: string, data: null|IReportedData = null) {
    const e = new Error();
    logDebug(message, {stack: e.stack ? e.stack.split("\n").slice(2) : null, data})
}