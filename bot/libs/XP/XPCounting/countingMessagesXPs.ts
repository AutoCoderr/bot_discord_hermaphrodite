import {GuildChannel, Message} from "discord.js";
import {IXPData} from "../../../Models/XP/XPData";
import {IXPUserData} from "../../../Models/XP/XPUserData";
import {detectUpgradeAndLevel, getXPUserConfig, XPCanBeCount} from "./countingOtherFunctions";

export async function listenUserXPMessages(message: Message) {
    const {guild,member,channel} = message;
    if (guild === null || member === null || channel === null)
        return;

    let XPServerConfig: null|IXPData;
    if (!(XPServerConfig = await XPCanBeCount(guild, member, <GuildChannel>channel)))
        return;

    const XPUserConfig: IXPUserData = await getXPUserConfig(guild.id, member.id);

    if (
        XPUserConfig.lastDayMessageTimestamp !== undefined &&
        new Date().getTime()-XPUserConfig.lastDayMessageTimestamp.getTime() < XPServerConfig.timeLimitMessage
    )
        return;

    XPUserConfig.lastDayMessageTimestamp = new Date();

    XPUserConfig.XP += XPServerConfig.XPByMessage;
    XPUserConfig.todayXP += XPServerConfig.XPByMessage;

    await detectUpgradeAndLevel(member, XPUserConfig, XPServerConfig);
}