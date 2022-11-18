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

    if (
        lastMessage !== null &&
        lastMessage.createdAt.getDate() === message.createdAt.getDate() &&
        lastMessage.createdAt.getMonth() === message.createdAt.getMonth() &&
        lastMessage.createdAt.getFullYear() === message.createdAt.getFullYear()
    )
        return;

    const XPUserConfig: IXPUserData = await getXPUserConfig(guild.id, member.id);
    XPUserConfig.XP += XPServerConfig.XPByMidNightMessage;
    XPUserConfig.todayXP += XPServerConfig.XPByMidNightMessage;

    await detectUpgradeAndLevel(member, XPUserConfig, XPServerConfig);
}