import { Guild, GuildMember } from "discord.js";
import client from "../client";
import XPData from "../Models/XP/XPData";

const enabledXPServersById: {[id: string]: boolean} = {};
const guildsById: {[id: string]: null|Guild} = {};
const membersById: {[id: string]: null|GuildMember} = {};

export async function serverHasXPsEnabled(serverId: string) {
    if (enabledXPServersById[serverId] === undefined) {
        enabledXPServersById[serverId] = await XPData.findOne({serverId, enabled: true}) !== null
    }
    return enabledXPServersById[serverId];
}

export async function getGuildById(serverId: string) {
    if (guildsById[serverId] === undefined) {
        guildsById[serverId] = client.guilds.cache.get(serverId) ?? null
    }
    return guildsById[serverId];
}

export async function getMemberById(serverId: string, memberId: string) {
    if (membersById[memberId] === undefined) {
        const guild = await getGuildById(serverId);
        membersById[memberId] = guild !== null ? await guild.members.fetch(memberId).catch(() => null) : null
    }
    return membersById[memberId];
}