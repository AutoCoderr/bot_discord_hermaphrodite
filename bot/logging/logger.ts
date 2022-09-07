import {createLogger, format, transports} from "winston";
import logFormatter from "./logFormatter";
const {combine, splat} = format;

export default () => createLogger({
    level: 'error',
    format: combine(
        splat(),
        logFormatter
    ),
    transports: [
        new transports.Console(),
        new transports.File({
            level: 'error',
            filename: "/logs/error/"+(new Date().toISOString())+".json"
        })
    ]
})