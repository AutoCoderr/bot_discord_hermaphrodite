import IReportedData from "../interfaces/IReportedDatas";
import CustomError from "./CustomError";

export type ISetTimeoutOrInterval = (func: () => any, ms: number) => any

export function returnProcessError(e: CustomError|Error) {
    return {
        error: {
            message: e.message,
            name: e.name,
            stack: e.stack,
            data: e instanceof CustomError ? e.data : undefined
        }
    }
}

const setTimeoutOrIntervalCatchProcess = (setTimeoutOrInterval: ISetTimeoutOrInterval) =>
    (data: IReportedData) => 
        (func: () => any, ms: number) => {
            setTimeoutOrInterval(async () => {
                if (process.send === undefined)
                    return;
                try {
                    await func();
                } catch(e) {
                    process.send(returnProcessError(new CustomError(<Error>e, data)));
                    process.exit();
                }
            }, ms)
        }

export const setTimeoutCatchProcess = setTimeoutOrIntervalCatchProcess(setTimeout);
export const setIntervalCatchProcess = setTimeoutOrIntervalCatchProcess(setInterval);

export async function tryCatchProcess(
    func: (args: {setTimeout: ISetTimeoutOrInterval, setInterval: ISetTimeoutOrInterval}) => any
) {
    if (process.send === undefined)
        return;
    const errorsData: IReportedData = {from: "processScript", processParams: process.argv.slice(2)}
    try {
        await func({
            setTimeout: setTimeoutCatchProcess(errorsData),
            setInterval: setIntervalCatchProcess(errorsData)
        });
    } catch(e) {
        process.send(returnProcessError(new CustomError(<Error>e, errorsData)));
        process.exit();
    }
}