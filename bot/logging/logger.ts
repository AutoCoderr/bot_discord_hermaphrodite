import {createLogger, format, transports} from "winston";
import logFormatter from "./logFormatter";
import IReportedData from "../interfaces/IReportedDatas";
const {combine, splat} = format;

const getLoggerByType = (type: 'error'|'debug') => (message: string, meta: {data: null|IReportedData, stack: null|string[]}) => createLogger({
    level: type,
    format: combine(
        splat(),
        logFormatter
    ),
    transports: [
        new transports.Console(),
        new transports.File({
            level: type,
            filename: "/logs/"+type+"/"+(new Date().toISOString())+".json"
        })
    ]
})[type](message, meta)

export const logError = getLoggerByType('error');
export const logDebug = getLoggerByType('debug');