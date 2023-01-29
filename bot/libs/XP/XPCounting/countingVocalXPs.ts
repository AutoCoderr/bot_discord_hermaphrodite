import {GuildChannel, GuildMember, VoiceBasedChannel, VoiceState} from "discord.js";
import {spawn} from "node:child_process";
import {IXPData} from "../../../Models/XP/XPData";
import {XPCanBeCount} from "./countingOtherFunctions";

const subProcessVoiceCounterByMemberId: {[id: string]: AbortController|NodeJS.Timeout} = {};
const mutedMembersById: {[id: string]: boolean} = {};

function abortMemberSubProcessVoiceCounter(member: GuildMember) {
    if (subProcessVoiceCounterByMemberId[member.id] instanceof AbortController) {
        (<AbortController>subProcessVoiceCounterByMemberId[member.id]).abort();
    } else if (subProcessVoiceCounterByMemberId[member.id]) {
        clearTimeout(<NodeJS.Timeout>subProcessVoiceCounterByMemberId[member.id]);
    }
    if (subProcessVoiceCounterByMemberId[member.id] !== undefined)
        delete subProcessVoiceCounterByMemberId[member.id];
}

function createMemberSubProcessVoiceCounter(member: GuildMember) {
    if (subProcessVoiceCounterByMemberId[member.id] === undefined) {
        subProcessVoiceCounterByMemberId[member.id] = setTimeout(() => {
            const controller = new AbortController();
            const {signal} = controller;
            const process = spawn("node", [
                "/bot/scripts/XP/XPVoiceCounter.js",
                member.guild.id,
                member.id
            ], {signal});
            process.on("error", () => {})
            subProcessVoiceCounterByMemberId[member.id] = controller;
        }, 10_000)
    }
}

type ICountAndGetUnMutedMembers = {nbUnMutedMembers: number, lastUnMutedMember: null|GuildMember};

function countAndGetUnMutedMembers(channel: VoiceBasedChannel, currentMember: GuildMember|null = null): ICountAndGetUnMutedMembers {
    return <ICountAndGetUnMutedMembers>Array.from(channel.members.values())
        .filter(member => currentMember === null || member.id !== currentMember.id)
        .reduce(({nbUnMutedMembers, lastUnMutedMember},member) => ({
            nbUnMutedMembers: !mutedMembersById[member.id] ? nbUnMutedMembers+1 : nbUnMutedMembers,
            lastUnMutedMember: !mutedMembersById[member.id] ? member : lastUnMutedMember
        }), <ICountAndGetUnMutedMembers>{nbUnMutedMembers: 0, lastUnMutedMember: null})
}

export default async function countingVocalXPs(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member;

    if (member === null)
        return;

    if (
        newState.channel === null ||
        newState.selfMute ||
        newState.selfDeaf
    ) {
        abortMemberSubProcessVoiceCounter(member)

        if (oldState.channel !== null && oldState.channelId !== newState.channelId) {
            const {nbUnMutedMembers, lastUnMutedMember} = countAndGetUnMutedMembers(oldState.channel);
            if (nbUnMutedMembers === 1)
                abortMemberSubProcessVoiceCounter(<GuildMember>lastUnMutedMember)
        }

        if (newState.channel !== null) {
            mutedMembersById[member.id] = true;

            const {nbUnMutedMembers, lastUnMutedMember} = countAndGetUnMutedMembers(newState.channel, member);
            if (nbUnMutedMembers === 1)
                abortMemberSubProcessVoiceCounter(<GuildMember>lastUnMutedMember)
        }

        return;
    }

    const {guild , channel} = newState;
    if (guild === null || channel === null)
        return;

    const XPServerConfig: null|IXPData = await XPCanBeCount(guild, member, <GuildChannel>channel)

    mutedMembersById[member.id] = false;

    const {nbUnMutedMembers, lastUnMutedMember} = countAndGetUnMutedMembers(newState.channel, member);

    if (nbUnMutedMembers < 1 || !XPServerConfig || oldState.guild.id !== newState.guild.id)
        abortMemberSubProcessVoiceCounter(member);

    if (nbUnMutedMembers >= 1) {
        if (XPServerConfig)
            createMemberSubProcessVoiceCounter(member);

        if (nbUnMutedMembers === 1 && await XPCanBeCount(guild, <GuildMember>lastUnMutedMember, <GuildChannel>channel, XPServerConfig))
            createMemberSubProcessVoiceCounter(<GuildMember>lastUnMutedMember);
    }

    if (oldState.channel !== null && oldState.channelId !== newState.channelId) {
        const {nbUnMutedMembers, lastUnMutedMember} = countAndGetUnMutedMembers(oldState.channel, member);
        if (nbUnMutedMembers === 1)
            abortMemberSubProcessVoiceCounter(<GuildMember>lastUnMutedMember)
    }

}