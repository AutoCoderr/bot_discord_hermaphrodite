import XPData, {IGrade, ILevelTip, IXPData} from "../Models/XP/XPData";
import {
    ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
    CategoryChannel, EmbedBuilder,
    Guild,
    GuildChannel,
    GuildMember,
    Message, Role,
    ThreadChannel, User, VoiceBasedChannel,
    VoiceState
} from "discord.js";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";
import {spawn} from "node:child_process";
import XPNotificationAskButton, {
    IXPNotificationAskButton
} from "../Models/XP/XPNotificationAskButton";
import XPTipsUsefulAskButton, {IXPTipsUsefulAskButton} from "../Models/XP/XPTipsUsefulAskButton";

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

async function askForNotifications(user: User, serverId, content: string) {
    const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "na";
    const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "nd";

    const message = await user.send({
        content,
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
                serverId,
                userId: user.id,
                toEnable,
                buttonId,
                messageId: message.id
            })
        )
    )
}

async function sendTip(member: GuildMember, level: number, tip: ILevelTip) {
    const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "ta";
    const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "td";

    await member.send((
            level === 1 ?
                "Vous venez de débloquer le premier niveau du système d'XP de '"+member.guild.name+"' !" :
                "Vous avez atteint le niveau "+level+" du système d'XP de '"+member.guild.name+"'!") +
        ( level === 1 ?
            "\nVoici le premier tip :" :
            "\nVoici un nouveau tip :" )
        +"\n\n"+tip.content)

    const message = await member.send({
        content: "\n-------------------------------\n\nAvez vous trouvé ce tip utile ?",
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
        ].map(([buttonId, useful]) =>
            XPTipsUsefulAskButton.create({
                serverId: member.guild.id,
                userId: member.id,
                useful,
                level,
                buttonId,
                messageId: message.id
            })
        )
    )
}

async function deleteMP(user: User, messageId: string) {
    const dmChannel = user.dmChannel;
    if (dmChannel === null)
        return;

    const message: null|Message = await dmChannel.messages.fetch(messageId).catch(() => null);

    if (message === null)
        return;

    await message.delete();
}

export function approveOrUnApproveTip(member: GuildMember|User, tips: ILevelTip[], level: number, toApprove: boolean, updatedTips: ILevelTip[] = []): ILevelTip[]|false {
    if (tips.length === 0)
        return false;

    const tip = tips[0];

    if (level !== tip.level)
        return approveOrUnApproveTip(member, tips.slice(1), level, toApprove, [...updatedTips, tip]);

    const col = toApprove ? 'userApproves' : 'userUnapproves';
    const otherCol = toApprove ? 'userUnapproves' : 'userApproves';
    tip[otherCol] = tip[otherCol].filter(userId => userId !== member.id);
    if (!tip[col].some(userId => userId === member.id))
        tip[col].push(member.id);

    return [...updatedTips, tip, ...tips.slice(1)];
}

export async function listenXPTipsUseFulApproveButtons(interaction: ButtonInteraction): Promise<boolean> {
    const button: null|IXPTipsUsefulAskButton = await XPTipsUsefulAskButton.findOne({
        userId: interaction.user.id,
        buttonId: interaction.customId
    });

    if (button === null)
        return false;

    const XPServerConfig: null|IXPData = await XPData.findOne({
        serverId: button.serverId
    });

    let updatedTips: ILevelTip[]|false;
    if (XPServerConfig !== null && (updatedTips = approveOrUnApproveTip(interaction.user, XPServerConfig.tipsByLevel, button.level, button.useful))) {
        XPServerConfig.tipsByLevel = updatedTips;
        await XPServerConfig.save();

        await interaction.editReply("Vous avez trouvé ce tip "+(button.useful ? "utile" : "inutile"));
    } else {
        await interaction.editReply("Ce tip semble ne plus exister");
    }

    await deleteMP(interaction.user, button.messageId);
    await XPTipsUsefulAskButton.deleteMany({
        messageId: button.messageId
    });

    return true;
}

export async function listenXPNotificationAskButtons(interaction: ButtonInteraction): Promise<boolean> {
    const button: null|IXPNotificationAskButton = await XPNotificationAskButton.findOne({
        userId: interaction.user.id,
        buttonId: interaction.customId
    });

    if (button === null)
        return false;

    const XPUserConfig: IXPUserData = await getXPUserConfig(button.serverId,button.userId);

    await enableOrDisableUserNotification(interaction.user, XPUserConfig, button.toEnable)

    await interaction.editReply("Notifications "+(button.toEnable ? "activées" : "désactivées")+" avec succès!")

    return true;
}

export async function enableOrDisableUserNotification(user: User|GuildMember, XPUserConfig: IXPUserData, toEnable: boolean, XPServerConfig: IXPData|null = null): Promise<boolean> {
    if (toEnable) {
        XPServerConfig = XPServerConfig ?? await XPData.findOne({
            serverId: XPUserConfig.serverId
        })

        try {
            const unblockedTips = XPServerConfig !== null ?
                XPServerConfig.tipsByLevel.filter(tip => tip.level > XPUserConfig.lastNotifiedLevel && tip.level <= XPUserConfig.currentLevel) :
                []
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Notifications du système d'XP activées")
                        .setFields(
                            unblockedTips.length > 0 ?
                                {
                                    name: "Vous avez débloqué les tips des niveaux suivants :",
                                    value: unblockedTips.map(tip =>
                                        "Niveau " + tip.level
                                    ).join("\n")
                                } :
                                {
                                    name: "Notifications du système d'XP activées",
                                    value: "Vous avez activé les notifications pour le système d'XP"
                                }
                        )
                    ]
            })
        } catch (e) {
            return false;
        }
        XPUserConfig.lastNotifiedLevel = XPUserConfig.currentLevel;
    }

    const button: null|IXPNotificationAskButton = await XPNotificationAskButton.findOne({
        serverId: XPUserConfig.serverId,
        userId: user.id
    })

    if (button !== null) {
        await deleteMP(user instanceof User ? user : user.user, button.messageId);
        await XPNotificationAskButton.deleteMany({
            messageId: button.messageId
        });
    }

    XPUserConfig.DMEnabled = toEnable;
    await XPUserConfig.save();

    return true;
}

export function roleCanBeManaged(guild: Guild, roleOrRoleId: Role|string) {
    const role: Role|undefined = roleOrRoleId instanceof Role ? roleOrRoleId : guild.roles.cache.get(roleOrRoleId);

    return role !== undefined && role.position < (<GuildMember>guild.members.me).roles.highest.position
}

async function detectUpgrade(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData): Promise<null|IGrade> {
    const grade = <null|IGrade>XPServerConfig.grades.reverse().find(grade => XPUserConfig.XP >= grade.requiredXP) ?? null;

    if (grade === null || (<string>grade._id).toString() === XPUserConfig.gradeId)
        return grade;

    let currentGrade: undefined|IGrade;
    if (
        XPUserConfig.gradeId !== undefined &&
        (currentGrade = XPServerConfig.grades.find(grade => grade._id == XPUserConfig.gradeId)) &&
        currentGrade.roleId !== grade.roleId &&
        roleCanBeManaged(member.guild, currentGrade.roleId)
    )
        await member.roles.remove(currentGrade.roleId);

    if (
        (currentGrade === undefined || currentGrade.roleId !== grade.roleId) &&
        roleCanBeManaged(member.guild, grade.roleId)
    )
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
            if (tip !== null)
                await sendTip(member, level, tip);
            if (level === 1 && !XPUserConfig.DMEnabled)
                await askForNotifications(
                    member.user,
                    member.guild.id,
                    (tip === null ? "Vous venez de débloquer le premier niveau du système d'XP de '"+member.guild.name+"' !\n" : "")+
                    "Souhaitez vous activer les notifications ?"
                )
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