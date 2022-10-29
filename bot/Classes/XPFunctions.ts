import XPData, {IGrade, ILevelTip, IXPData} from "../Models/XP/XPData";
import {CategoryChannel, Guild, GuildChannel, GuildMember, Message, ThreadChannel} from "discord.js";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";
import {promises} from "dns";

export function setTipByLevel(level: number, content: string, tips: ILevelTip[]): ILevelTip[] {
    return tips.length === 0 ?
        [{
            level,
            content,
            userApproves: [],
            userUnapproves: []
        }] :
        tips.reduce((acc,tip, index) => [
            ...acc,
            ...(
                tip.level === level ?
                    [{
                        ...tip,
                        content
                    }] :
                    (tip.level > level && (index === 0 || (index > 0 && tips[index-1].level < level))) ?
                        [
                            {
                                level,
                                content,
                                userApproves: [],
                                userUnapproves: []
                            },
                            tip
                        ] :
                        (index === tips.length-1 && tip.level < level) ?
                            [
                                tip,
                                {
                                    level,
                                    content,
                                    userApproves: [],
                                    userUnapproves: []
                                }
                            ] :
                            [tip]
            )
        ], <ILevelTip[]>[])
}

export function findTipByLevel(level: number, tips: ILevelTip[], a = 0, b = tips.length-1): null|ILevelTip {
    if (tips.length === 0)
        return null;

    if (tips[a].level === level)
        return tips[a];

    if (tips[b].level === level)
        return tips[b];

    if (Math.abs(b-a) <= 1)
        return null

    const m = Math.floor((a+b)/2)

    if (tips[m].level === level)
        return tips[m];

    if (tips[m].level > level)
        return findTipByLevel(level, tips, a, m);

    return findTipByLevel(level, tips, m, b)
}

export function calculRequiredXPForNextGrade(grades: IGrade[], level: number, lastGradeIndex: number = grades.length-1): null|number {
    const lastGrade = grades[lastGradeIndex];
    const lastGradeLevel = lastGradeIndex === 0 ? 1 : lastGrade.atLevel;
    if (level <= lastGrade.atLevel)
        return null;


    return lastGrade.requiredXP + (level-lastGradeLevel)*lastGrade.XPByLevel
}

export function checkGradesListData(guild: Guild, grades: any) {
    return grades instanceof Array &&
        !grades.some((grade,index) => (
            typeof(grade) !== "object" ||
            grade === null ||
            grade instanceof Array ||

            typeof(grade.atLevel) !== "number" ||
            grade.atLevel%1 !== 0 ||
            grade.atLevel <= 0 ||

            (index === 0 && grade.atLevel !== 1) ||
            (index > 0 && grade.atLevel <= grades[index-1].atLevel) ||
            (index < grades.length-1 && grade.atLevel >= grades[index+1].atLevel) ||

            typeof(grade.requiredXP) !== "number" ||
            grade.requiredXP%1 !== 0 ||
            grade.requiredXP <= 0 ||

            (index > 0 && grade.requiredXP !== calculRequiredXPForNextGrade(grades, grade.atLevel, index-1)) ||

            typeof(grade.XPByLevel) !== "number" ||
            grade.XPByLevel%1 !== 0 ||
            grade.XPByLevel <= 0 ||

            typeof(grade.name) !== "string" ||
            typeof(grade.roleId) !== "string" ||

            guild.roles.cache.get(grade.roleId) === undefined ||

            Object.keys(grade).length > 5
        ))
}

export function checkTipsListData(tips: any) {
    return tips instanceof Array &&
        !tips.some((tip,index) => (
            typeof(tip) !== "object" ||
            tip === null ||
            tip instanceof Array ||

            typeof(tip.level) !== "number" ||
            tip.level%1 !== 0 ||
            tip.level <= 0 ||
            (index > 0 && tip.level <= tips[index-1].level) ||

            typeof(tip.content) !== "string" ||

            Object.keys(tip).length > 2
        ))
}

async function XPCanBeCount(guild: Guild, member: GuildMember, channel: GuildChannel): Promise<false|IXPData> {
    const XPServerConfig: IXPData|null = await XPData.findOne({
        serverId: guild.id,
        enabled: true
    })

    if (XPServerConfig === null)
        return false;

    if (!member.roles.cache.some(role => role.id === XPServerConfig.activeRoleId))
        return false;

    const channelWhichHasPermissions: GuildChannel|ThreadChannel|null = (<GuildChannel>channel).permissionsFor !== undefined ?
        <GuildChannel>channel :
        ((<GuildChannel>channel).parent && (<CategoryChannel>(<GuildChannel>channel).parent).permissionsFor) ?
            (<GuildChannel>channel).parent :
            null;

    if (!channelWhichHasPermissions)
        return false;

    const channelRole = guild.roles.cache.get(<string>XPServerConfig.channelRoleId??XPServerConfig.activeRoleId);

    if (channelRole === undefined)
        return false;

    const channelPermissions = channelWhichHasPermissions.permissionsFor(channelRole)
    if (!channelPermissions)
        return false;

    return channelPermissions.has('ViewChannel') &&
        (channelPermissions.has('SendMessages') || channelPermissions.has("Connect")) ?
        XPServerConfig : false;
}

function getXPUserConfig(guild: Guild, member: GuildMember): Promise<IXPUserData> {
    return XPUserData.findOne({
        serverId: guild.id,
        userId: member.id
    }).then((XPUserConfig: null|IXPUserData) => XPUserConfig ?? XPUserData.create({
        serverId: guild.id,
        userId: member.id
    }));
}

export async function listenUserXPFirstMessages(message: Message) {
    const {guild,member,channel} = message;
    if (guild === null || member === null || channel === null)
        return;

    let XPServerConfig: false|IXPData;
    if (!(XPServerConfig = await XPCanBeCount(guild, member, <GuildChannel>channel)))
        return;

    const XPUserConfig: IXPUserData = await getXPUserConfig(guild, member);

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

    await XPUserConfig.save();
}

export async function listenUserXPMessages(message: Message) {
    const {guild,member,channel} = message;
    if (guild === null || member === null || channel === null)
        return;

    let XPServerConfig: false|IXPData;
    if (!(XPServerConfig = await XPCanBeCount(guild, member, <GuildChannel>channel)))
        return;

    const XPUserConfig: IXPUserData = await getXPUserConfig(guild, member);

    if (
        XPUserConfig.lastDayMessageTimestamp !== undefined &&
        new Date().getTime()-XPUserConfig.lastDayMessageTimestamp.getTime() < XPServerConfig.timeLimitMessage
    )
        return;

    XPUserConfig.lastDayMessageTimestamp = new Date();

    XPUserConfig.XP += XPServerConfig.XPByMessage;
    XPUserConfig.todayXP += XPServerConfig.XPByMessage;

    await XPUserConfig.save();
}