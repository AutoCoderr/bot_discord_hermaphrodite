import {createLogger, format, transports} from "winston";
import logFormatter from "./logFormatter";
import IReportedData from "../interfaces/IReportedDatas";
const {combine, splat} = format;

const getLoggerByType = (type: 'error'|'debug') => (message: string, meta: {data: null|IReportedData, stack: null|string[]}): Promise<void> => 
    new Promise(resolve => {
        const file = new transports.File({
            level: type,
            filename: "/logs/"+type+"/"+(new Date().toISOString())+".json"
        });

        const logger = createLogger({
            level: type,
            format: combine(
                splat(),
                logFormatter
            ),
            transports: [
                new transports.Console(),
                file
            ]
        })
        file.on('open', () => {
            logger[type](message, meta);
            file.on('finish', resolve);
            logger.end();
        })
})

export const logError = getLoggerByType('error');
export const logDebug = getLoggerByType('debug');