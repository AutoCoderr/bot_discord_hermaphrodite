import IReportedData from "../interfaces/IReportedDatas";
import CustomError from "./CustomError";
import reportError from "./reportError";

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
    (data: IReportedData, isProcess: boolean = false) => 
        (func: () => any, ms: number) => {
            setTimeoutOrInterval(async () => {
                if (isProcess && process.send === undefined)
                    return;
                try {
                    await func();
                } catch(e) {
                    if (isProcess && process.send) {
                        process.send(returnProcessError(new CustomError(<Error>e, data)));
                        process.exit();
                    } else
                        reportError(new CustomError(<Error>e, data))
                        .then(() => {
                            process.exit();
                        })
                }
            }, ms)
        }

export const setTimeoutCatchProcess = setTimeoutOrIntervalCatchProcess(setTimeout);
export const setIntervalCatchProcess = setTimeoutOrIntervalCatchProcess(setInterval);

async function tryCatch(
    func: (args: {setTimeout: ISetTimeoutOrInterval, setInterval: ISetTimeoutOrInterval}) => any,
    isProcess: boolean = false
) {
    if (isProcess && process.send === undefined)
        return;
    const errorsData: IReportedData = {from: isProcess ? "processScript" : "cronScript", processParams: process.argv.slice(2)}
    try {
        await func({
            setTimeout: setTimeoutCatchProcess(errorsData, isProcess),
            setInterval: setIntervalCatchProcess(errorsData, isProcess)
        });
    } catch(e) {
        if (isProcess && process.send) {
            process.send(returnProcessError(new CustomError(<Error>e, errorsData)));
            process.exit();
        } else {
            reportError(new CustomError(<Error>e, errorsData))
                .then(() => {
                    process.exit();
                })
        }
    }
}

export async function tryCatchProcess(
    func: (args: {setTimeout: ISetTimeoutOrInterval, setInterval: ISetTimeoutOrInterval}) => any
) {
    return tryCatch(func, true)
}

export async function tryCatchCron(
    func: (args: {setTimeout: ISetTimeoutOrInterval, setInterval: ISetTimeoutOrInterval}) => any
) {
    return tryCatch(func)
}