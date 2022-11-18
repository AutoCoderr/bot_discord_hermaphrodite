import {GuildChannel, Message} from "discord.js";
import {IXPData} from "../../../Models/XP/XPData";
import {IXPUserData} from "../../../Models/XP/XPUserData";
import {detectUpgradeAndLevel, getXPUserConfig, XPCanBeCount} from "./countingOtherFunctions";

export async function listenUserXPFirstMessages(message: Message) {
    const {guild,member,channel} = message;
    if (guild === null || member === null || channel === null)
        return;

    let XPServerConfig: null|IXPData;
    if (!(XPServerConfig = await XPCanBeCount(guild, member, <GuildChannel>channel)))
        return;

    const XPUserConfig: IXPUserData = await getXPUserConfig(guild.id, member.id);

    const date = new Date();

    if (XPUserConfig.lastFirstDayMessageTimestamp !== undefined) {
        const currentTime = date.getUTCHours()*60*60*1000 + date.getUTCMinutes()*60*1000 + date.getUTCSeconds()*1000 + date.getUTCMilliseconds();
        const currentDateWithoutTime = new Date().getTime()-currentTime;
        const currentFirstDayMessageDate = currentDateWithoutTime + XPServerConfig.firstMessageTime;

        if (
            date.getTime() < currentFirstDayMessageDate ||
            XPUserConfig.lastFirstDayMessageTimestamp.getTime() >= currentFirstDayMessageDate
        )
            return;
    }

    XPUserConfig.lastFirstDayMessageTimestamp = date;

    XPUserConfig.XP += XPServerConfig.XPByFirstMessage;
    XPUserConfig.todayXP += XPServerConfig.XPByFirstMessage;

    await detectUpgradeAndLevel(member, XPUserConfig, XPServerConfig);
}