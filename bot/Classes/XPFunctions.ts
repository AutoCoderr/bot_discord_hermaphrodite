import XPData, {IGrade, ILevelTip, IXPData} from "../Models/XP/XPData";
import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    CategoryChannel,
    Guild,
    GuildChannel,
    GuildMember,
    Message, Role,
    ThreadChannel, VoiceBasedChannel,
    VoiceState
} from "discord.js";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";
import {spawn} from "node:child_process";
import XPNotificationAskButton from "../Models/XP/XPNotificationAskButton";

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

export function roleCanBeManaged(guild: Guild, roleOrRoleId: Role|string) {
    const role: Role|undefined = roleOrRoleId instanceof Role ? roleOrRoleId : guild.roles.cache.get(roleOrRoleId);

    return role !== undefined && role.position < (<GuildMember>guild.members.me).roles.highest.position
}

async function detectUpgrade(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData): Promise<null|IGrade> {
    const grade = <null|IGrade>XPServerConfig.grades.reverse().find(grade => XPUserConfig.XP >= grade.requiredXP) ?? null;

    if (grade === null || (<string>grade._id).toString() === XPUserConfig.gradeId)
        return grade;

    console.log("After");
    console.log({
        id1: grade._id ? grade._id.toString() : undefined,
        id2: XPUserConfig.gradeId
    })

    let currentGrade: undefined|IGrade;
    if (
        XPUserConfig.gradeId !== undefined &&
        (currentGrade = XPServerConfig.grades.find(grade => grade._id == XPUserConfig.gradeId)) &&
        roleCanBeManaged(member.guild, currentGrade.roleId)
    )
        await member.roles.remove(currentGrade.roleId);

    if (roleCanBeManaged(member.guild, grade.roleId))
        await member.roles.add(grade.roleId);

    XPUserConfig.gradeId = grade._id;

    return grade;
}

async function detectUplevel(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData, grade: IGrade): Promise<void> {
    XPUserConfig.currentLevel = grade.atLevel + Math.floor((XPUserConfig.XP - grade.requiredXP)/grade.XPByLevel);


    for (let level=XPUserConfig.lastNotifiedLevel+1;level<=XPUserConfig.currentLevel;level++) {
        if (level > 1 && !XPUserConfig.DMEnabled)
            return;

        const tip = findTipByLevel(level, XPServerConfig.tipsByLevel);
        if (level > 1 && tip === null)
            continue;

        try {
            await member.send(
                (
                    level === 1 ?
                        "Vous venez de débloquer le premier niveau du système d'XP de '"+member.guild.name+"' !\n" :
                        "Vous avez atteint le niveau "+level+" du système d'XP de '"+member.guild.name+"'!\n") +
                (
                    tip !== null ?
                        ( level === 1 ?
                            "Voici le premier tip :" :
                            "Voici un nouveau tip :" )+"\n\n"+tip.content :
                        ""
                )
            )
            if (level === 1) {
                const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "a";
                const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "d";

                const message = await member.send({
                    content: "Souhaitez vous activer les notifications ?",
                    components: [ //@ts-ignore
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(acceptButtonId)
                                .setLabel("Oui")
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(denyButtonId)
                                .setLabel("Non")
                                .setStyle(ButtonStyle.Danger),
                        )
                    ]
                })
                await Promise.all(
                    [
                        [acceptButtonId, true],
                        [denyButtonId, false]
                    ].map(([buttonId, toEnable]) =>
                        XPNotificationAskButton.create({
                            serverId: member.guild.id,
                            userId: member.id,
                            toEnable,
                            buttonId,
                            messageId: message.id
                        })
                    )
                )
            }
        } catch (_) {
            return;
        }
        XPUserConfig.lastNotifiedLevel = level;
    }
}

export async function detectUpgradeAndLevel(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData) {
    const grade: null|IGrade = await detectUpgrade(member, XPUserConfig, XPServerConfig);
    if (grade !== null)
        await detectUplevel(member, XPUserConfig, XPServerConfig, grade);
    await XPUserConfig.save();
}

async function XPCanBeCount(guild: Guild, member: GuildMember, channel: GuildChannel, XPServerConfig: IXPData|null = null): Promise<null|IXPData> {
    XPServerConfig = XPServerConfig ?? await XPData.findOne({
        serverId: guild.id,
        enabled: true
    })

    if (XPServerConfig === null)
        return null;

    if (!member.roles.cache.some(role => role.id === (<IXPData>XPServerConfig).activeRoleId))
        return null;

    const channelWhichHasPermissions: GuildChannel|ThreadChannel|null = (<GuildChannel>channel).permissionsFor !== undefined ?
        <GuildChannel>channel :
        ((<GuildChannel>channel).parent && (<CategoryChannel>(<GuildChannel>channel).parent).permissionsFor) ?
            (<GuildChannel>channel).parent :
            null;

    if (!channelWhichHasPermissions)
        return null;

    const channelRole = guild.roles.cache.get(<string>XPServerConfig.channelRoleId??XPServerConfig.activeRoleId);

    if (channelRole === undefined)
        return null;

    const channelPermissions = channelWhichHasPermissions.permissionsFor(channelRole)
    if (!channelPermissions)
        return null;

    return channelPermissions.has('ViewChannel') &&
        (channelPermissions.has('SendMessages') || channelPermissions.has("Connect")) ?
        XPServerConfig : null;
}

export function getXPUserConfig(serverId: string, userId: string): Promise<IXPUserData> {
    return XPUserData.findOne({
        serverId,
        userId
    }).then((XPUserConfig: null|IXPUserData) => XPUserConfig ?? XPUserData.create({
        serverId,
        userId
    }));
}

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
                "/bot/scripts/XPVoiceCounter.js",
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

export async function listenUserXPVocal(oldState: VoiceState, newState: VoiceState) {
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