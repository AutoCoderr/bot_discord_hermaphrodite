import {GuildChannel, Message, } from "discord.js";
import {IXPData} from "../../../Models/XP/XPData";
import {detectUpgradeAndLevel, getXPUserConfig, XPCanBeCount} from "./countingOtherFunctions";
import {IXPUserData} from "../../../Models/XP/XPUserData";

export default async function countingMidnightMessagesXPs(message: Message) {
    const {guild,member,channel} = message;
    if (guild === null || member === null || channel === null)
        return;

    let XPServerConfig: null|IXPData;
    if (!(XPServerConfig = await XPCanBeCount(guild, member, <GuildChannel>channel)))
        return;

    const lastMessage: null|Message= await channel.messages.fetch({ limit: 2 })
        .then(messages => messages.size >= 2 ? messages.at(1) : null);

    const timezoneConvertedToMs = XPServerConfig.timezone * 60 * 60 * 1000;

    const lastMessageDate = lastMessage !== null ?
        new Date(lastMessage.createdAt.getTime() + timezoneConvertedToMs) :
        null;

    const currentMessageDate = new Date(message.createdAt.getTime() + timezoneConvertedToMs);

    if (
        lastMessageDate !== null &&
        lastMessageDate.getUTCDate() === currentMessageDate.getUTCDate() &&
        lastMessageDate.getUTCMonth() === currentMessageDate.getUTCMonth() &&
        lastMessageDate.getUTCFullYear() === currentMessageDate.getUTCFullYear()
    )
        return;

    const XPUserConfig: IXPUserData = await getXPUserConfig(guild.id, member.id);
    XPUserConfig.XP += XPServerConfig.XPByMidNightMessage;
    XPUserConfig.todayXP += XPServerConfig.XPByMidNightMessage;

    await detectUpgradeAndLevel(member, XPUserConfig, XPServerConfig);
}