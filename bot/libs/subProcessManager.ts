import {ChildProcess, fork} from "node:child_process";
import CustomError from "../logging/CustomError";
import reportError from "../logging/reportError";

type IForkProcess = {type: 'fork', abortController: AbortController, child: ChildProcess};
type ITimeoutProcess = {type: 'timeout', timeout: NodeJS.Timeout}
type IProcess = ITimeoutProcess|IForkProcess;

const subProcessByTagAndMemberId: {
    [tag: string]: IProcess|{[id: string] : IProcess}
} = {};

export function abortProcess(tag: string, key: null|string = null): boolean {
    const process = getProcess(tag, key);
    if (process === undefined)
        return false;
    if (process.type === "fork") {
        process.abortController.abort()
    } else {
        clearTimeout(process.timeout);
        deleteProcessRef(tag, key);
    }
    return true;
}

function deleteProcessRef(tag: string, key: null|string) {
    if (key !== null) {
        delete subProcessByTagAndMemberId[tag][key];
    } else {
        delete subProcessByTagAndMemberId[tag];
    }
}

export function contactProcess(data: any, tag: string, key: null|string = null): boolean {
    const process = getProcess(tag, key);
    if (process === undefined || process.type === "timeout")
        return false;
    
    return process.child.send(data);
}

export function createProcess(file: string, tag: string, key: null|string = null, params: any[] = [], timeout: null|number = null): boolean {
    if (getProcess(tag,key) === undefined) {
        setProcess(
            tag,
            key,
            timeout === null ?
                createForkProcess(tag, key, file, params) :
                {
                    type: "timeout", timeout: setTimeout(() => {
                        setProcess(tag,key,createForkProcess(tag,key,file,params))
                    }, timeout)
                }
        )
        return true;
    }
    return false;
}

function catchProcessErrors(tag: string, key: null|string , message: any): boolean {
    if (
        message.error && 
        typeof(message.error.message) === "string" &&

        (
            message.error.name === undefined || 
            typeof(message.error.name) === "string"
        ) &&

        (
            message.error.stack === undefined || 
            typeof(message.error.stack) === "string"
        ) &&

        (
            message.error.data === undefined ||
            (
                typeof(message.error.data) === "object" &&
                message.error.data !== null &&
                !(message.error.data instanceof Array)
            )
        )
    ) {
        reportError(new CustomError(
            message.error.message, 
            {
                ...(message.error.data ?? {}),
                processAddr: tag+(key ? "/"+key : "")
            }, 
            message.error.stack ?? null
        ))
        return true;
    }
    return false;
}

function createForkProcess(tag: string, key: null|string, file: string, params: any[] = []): IForkProcess {
    const abortController = new AbortController();
    const {signal} = abortController;
    const child = fork(file, params, {signal});
    child.on("error", () => {});
    child.on('exit', () => {
        deleteProcessRef(tag, key)
    });
    child.on('close', () => {
        deleteProcessRef(tag, key)
    });
    child.on('message', (message: any) => {
        if (catchProcessErrors(tag,key,message))
            return;

        if (message.tag === undefined || message.data === undefined)
            return;
        
        contactProcess(message.data, message.tag, message.key??null)
    })
    return {type: 'fork', abortController, child};
}

function setProcess(tag: string, key: null|string, process: IProcess) {
    if (key === null) {
        subProcessByTagAndMemberId[tag] = process;
        return;
    }
    if (subProcessByTagAndMemberId[tag] === undefined) {
        subProcessByTagAndMemberId[tag] = {}
    }
    subProcessByTagAndMemberId[tag][key] = process
}

function getProcess(tag: string, key: null|string): undefined|IProcess {
    return (subProcessByTagAndMemberId[tag] && key !== null) ?
                subProcessByTagAndMemberId[tag][key] :
                subProcessByTagAndMemberId[tag]
}