import { GuildMember } from "discord.js";
import {spawn} from "node:child_process";

const subProcessByTagAndMemberId: {
    [tag: string]: AbortController|NodeJS.Timeout|{[id: string] : AbortController|NodeJS.Timeout}
} = {};

export function abortProcess(tag: string, member: null|GuildMember = null) {
    const process = getProcess(tag, member);
    if (process === undefined)
        return;
    if (process instanceof AbortController) {
        (<AbortController>process).abort();
    } else {
        clearTimeout(<NodeJS.Timeout>process);
    }
    if (member !== null) {
        delete subProcessByTagAndMemberId[tag][member.id];
    } else {
        delete subProcessByTagAndMemberId[tag];
    }
}

export function createProcess(file: string, tag: string, member: null|GuildMember = null, params: any[] = [], timeout: null|number = null) {
    if (getProcess(tag,member) === undefined) {
        setProcess(
            tag,
            member,
            timeout === null ?
                createProcessObject(file, params) :
                setTimeout(() => {
                    setProcess(tag,member,createProcessObject(file,params))
                }, timeout)
        )
    }
}

function createProcessObject(file: string, params: any[] = []) {
    const controller = new AbortController();
    const {signal} = controller;
    const process = spawn("node", [
        file, ...params
    ], {signal});
    process.on("error", () => {})
    return controller;
}

function setProcess(tag: string, member: null|GuildMember, process: AbortController|NodeJS.Timeout) {
    if (member === null) {
        subProcessByTagAndMemberId[tag] = process;
        return;
    }
    if (subProcessByTagAndMemberId[tag] === undefined) {
        subProcessByTagAndMemberId[tag] = {}
    }
    subProcessByTagAndMemberId[tag][member.id] = process
}

function getProcess(tag: string, member: null|GuildMember) {
    return (subProcessByTagAndMemberId[tag] && member !== null) ?
                subProcessByTagAndMemberId[tag][member.id] :
                subProcessByTagAndMemberId[tag]
}