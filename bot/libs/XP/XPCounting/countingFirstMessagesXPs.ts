import {GuildChannel, Message} from "discord.js";
import {IXPData} from "../../../Models/XP/XPData";
import {IXPUserData} from "../../../Models/XP/XPUserData";
import {detectUpgradeAndLevel, getXPUserConfig, XPCanBeCount} from "./countingOtherFunctions";
import {convertTimeNumberToMomentTimeZoneFormat,getTimezoneDatas} from "../../timezones"
import reportDebug from "../../../logging/reportDebug";
import moment from "moment-timezone"

export default async function countingFirstMessagesXPs(message: Message) {
    const {guild,member,channel} = message;
    if (guild === null || member === null || channel === null)
        return;

    let XPServerConfig: null|IXPData;
    if (!(XPServerConfig = await XPCanBeCount(guild, member, <GuildChannel>channel)))
        return;

    const XPUserConfig: IXPUserData = await getXPUserConfig(guild.id, member.id);

    const {zones} = await getTimezoneDatas();
    if (zones[XPServerConfig.timezone] === undefined) {
        return reportDebug("Server '"+guild.id+"' has invalid configured timezone : '"+XPServerConfig.timezone+"'");
    }

    const date = new Date();

    if (XPUserConfig.lastFirstDayMessageTimestamp !== undefined) {
        const currentFirstDayMessageDate = new Date(
                moment.tz(
                    convertTimeNumberToMomentTimeZoneFormat(XPServerConfig.firstMessageTime),
                    XPServerConfig.timezone
                )
                .utc()
                .format()
        )

        const msIn24h = 24*60*60*1000;

        if (![currentFirstDayMessageDate.getTime()-msIn24h, currentFirstDayMessageDate.getTime(), currentFirstDayMessageDate.getTime()+msIn24h]
            .some(firstDayMessageDate =>
                date.getTime() >= firstDayMessageDate &&
                (<Date>XPUserConfig.lastFirstDayMessageTimestamp).getTime() < firstDayMessageDate
            ))
            return
    }

    XPUserConfig.lastFirstDayMessageTimestamp = date;

    await detectUpgradeAndLevel(member, XPUserConfig, XPServerConfig, XPUserConfig.XP+XPServerConfig.XPByFirstMessage);
}