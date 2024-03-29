import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    CategoryChannel,
    EmbedBuilder,
    Guild,
    GuildChannel,
    GuildMember,
    ThreadChannel,
    User
} from "discord.js";
import XPUserData, {IXPUserData, userFieldsFixedLimits} from "../../../Models/XP/XPUserData";
import XPData, {IGrade, ILevelTip, IXPData} from "../../../Models/XP/XPData";
import {roleCanBeManaged, checkIfBotCanManageRoles} from "../XPOtherFunctions";
import XPNotificationAskButton from "../../../Models/XP/XPNotificationAskButton";
import {findTipByLevel} from "../tips/tipsManager";
import {getTipMessage} from "../tips/tipsOtherFunctions";
import XPTipsUsefulAskButton from "../../../Models/XP/XPTipsUsefulAskButton";

function getButtonsForAskNotifications(user: User, serverId: string): {
    notificationsAcceptButtonId: string, 
    notificationDenyButtonId: string,
    components: [ActionRowBuilder]
} {
    const notificationsAcceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "na";
    const notificationDenyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "nd";

    return {
        notificationsAcceptButtonId,
        notificationDenyButtonId,
        components: [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(notificationsAcceptButtonId)
                .setLabel("Oui")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(notificationDenyButtonId)
                .setLabel("Non")
                .setStyle(ButtonStyle.Danger),
        )
    ]
    }
}

function createNotificationButtons(serverId: string, userId: string, messageId: string, acceptButtonId: string, denyButtonId: string) {
    return Promise.all(
        [
            [acceptButtonId, true],
            [denyButtonId, false]
        ].map(([buttonId, toEnable]) =>
            XPNotificationAskButton.create({
                serverId,
                userId: userId,
                toEnable,
                buttonId,
                messageId: messageId
            })
        )
    )
}

export async function askForNotifications(user: User, serverId, content: string) {
    const {notificationsAcceptButtonId, notificationDenyButtonId, components} = getButtonsForAskNotifications(user, serverId)

    const message = await user.send({
        content, //@ts-ignore
        components: components
    })

    await createNotificationButtons(serverId, user.id, message.id, notificationsAcceptButtonId, notificationDenyButtonId)
}

async function detectUpgrade(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData): Promise<null|IGrade> {
    const grade = <null|IGrade>XPServerConfig.grades.reverse().find(grade => XPUserConfig.XP >= grade.requiredXP) ?? null;

    const botCanManageRoles = checkIfBotCanManageRoles(member.guild);

    let currentGrade: undefined|IGrade;
    if (
        botCanManageRoles &&
        XPUserConfig.gradeId !== undefined &&
        (currentGrade = XPServerConfig.grades.find(grade => grade._id == XPUserConfig.gradeId)) &&
        (grade === null || currentGrade.roleId !== grade.roleId) &&
        roleCanBeManaged(member.guild, currentGrade.roleId)
    )
        await member.roles.remove(currentGrade.roleId);

    if (grade === null || (<string>grade._id).toString() === XPUserConfig.gradeId)
        return grade;

    if (
        botCanManageRoles &&
        (currentGrade === undefined || currentGrade.roleId !== grade.roleId) &&
        roleCanBeManaged(member.guild, grade.roleId)
    )
        await member.roles.add(grade.roleId);

    XPUserConfig.gradeId = grade._id;

    return grade;
}

async function sendTipsAndNotificationAsks(member: GuildMember, level: number, tip: null|ILevelTip): Promise<boolean> {
    if (level > 1 && tip === null)
        return true;
    
    const {tipAcceptButtonId, tipDenyButtonId, content: contentTip, components: componentsTip} = tip !== null ?
        await getTipMessage(member, level, tip):
        {tipAcceptButtonId: null, tipDenyButtonId: null, content: "", components: undefined}

    const {notificationsAcceptButtonId, notificationDenyButtonId, components: componentsNotif} = level === 1 ? getButtonsForAskNotifications(
        member.user,
        member.guild.id
    ) : {notificationsAcceptButtonId: null, notificationDenyButtonId: null, components: undefined}

    try {
        const message = await member.send({
            content: contentTip+(
                level === 1 ?
                    (contentTip !== "" ? "\n-------------------------------\n\n" : "")+
                    (tip === null ? "Vous venez de débloquer le premier palier du système d'XP de '"+member.guild.name+"' !\n" : "")+
                    "Souhaitez vous avoir les notifications activées?" : ""
            ),
            components: [ //@ts-ignore
                ...(componentsTip ?? []), //@ts-ignore
                ...(componentsNotif ?? [])
            ]
        });

        if (notificationsAcceptButtonId) {
            await createNotificationButtons(member.guild.id, member.user.id, message.id, notificationsAcceptButtonId, notificationDenyButtonId)
        }

        if (tipAcceptButtonId) {
            await Promise.all(
                [
                    [tipAcceptButtonId, true],
                    [tipDenyButtonId, false]
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
        return true;
    } catch(_) {
        return false;
    }
}

async function detectUplevel(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData, grade: IGrade, oldXP: number, setByAdmin: boolean): Promise<void> {
    const oldCurrentLevel = XPUserConfig.currentLevel;
    XPUserConfig.currentLevel = grade.atLevel + Math.floor((XPUserConfig.XP - grade.requiredXP)/grade.XPByLevel);
    if (XPUserConfig.lastNotifiedLevel > XPUserConfig.currentLevel)
        XPUserConfig.lastNotifiedLevel = XPUserConfig.currentLevel;

    if (setByAdmin && (XPUserConfig.DMEnabled || oldCurrentLevel === 0)) {
        await reportXPAndLevelVariation(XPServerConfig, XPUserConfig, member, oldCurrentLevel, oldXP)
    }

    for (let level=XPUserConfig.lastNotifiedLevel+1;level<=XPUserConfig.currentLevel;level++) {
        if (level > 1 && (!XPUserConfig.DMEnabled || setByAdmin))
            break;

        const tip = findTipByLevel(level, XPServerConfig.tipsByLevel);
        if (!(await sendTipsAndNotificationAsks(member, level, tip)))
            return;
    }

    if (XPUserConfig.DMEnabled || oldCurrentLevel === 0)
        XPUserConfig.lastNotifiedLevel = (XPUserConfig.DMEnabled || setByAdmin) ? XPUserConfig.currentLevel : 1;
}

export async function reportXPAndLevelVariation(XPServerConfig: IXPData, XPUserConfig: IXPUserData, member: GuildMember, oldCurrentLevel: number, oldXP: number) {
    if (XPUserConfig.XP < oldXP) {
        try {
            await member.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("XP réduits")
                        .setFields({
                            name: "XPs réduits par un administrateur",
                            value: "Un administrateur a réduit vos XP sur le serveur '"+member.guild.name+"'.\n"+
                                   "Vous avez désormais "+XPUserConfig.XP+" XP, "+
                                   (XPUserConfig.currentLevel < oldCurrentLevel ? "et êtes" : "mais êtes toujours")+" au palier "+XPUserConfig.currentLevel
                        })
                ]
            })
        } catch (_) {}
        return;
    }

    if (XPUserConfig.XP > oldXP) {
        const tipsToNotify: null|number[] = XPUserConfig.currentLevel > XPUserConfig.lastNotifiedLevel ? [] : null;
        if (tipsToNotify !== null)
            for (let level=Math.max(2, XPUserConfig.lastNotifiedLevel+1);level<=XPUserConfig.currentLevel;level++) {
                if (findTipByLevel(level, XPServerConfig.tipsByLevel))
                    tipsToNotify.push(level);
            }
        try {
            await member.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("XP ajoutés")
                        .setFields(
                            {
                                name: "XPs ajoutés par un administrateur",
                                value: "Un administrateur vous a ajouté des XPs sur le serveur '"+member.guild.name+"'.\n"+
                                    "Vous avez désormais "+XPUserConfig.XP+" XP, "+
                                    (XPUserConfig.currentLevel > oldCurrentLevel ? "et êtes" : "mais êtes toujours")+" au palier "+XPUserConfig.currentLevel
                            },
                            ...(
                                (tipsToNotify && tipsToNotify.length > 0) ? [{
                                    name: "Vous avez désormais accès aux tips des paliers suivants :",
                                    value: tipsToNotify.map(level => "Palier "+level).join("\n")
                                }] : []
                            )
                        )
                ]
            })
        } catch (_) {}
    }
}

export async function detectUpgradeAndLevel(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData, XP: number, setByAdmin = false) {
    if (XP < 0)
        throw new Error("XPs can't be set less than 0");
    
    if (XP > userFieldsFixedLimits.XP.max)
        XP = userFieldsFixedLimits.XP.max;

    if (XP < userFieldsFixedLimits.XP.min)
        XP = userFieldsFixedLimits.XP.min;

    const addedXPs = XP-XPUserConfig.XP;
    const oldXP = XPUserConfig.XP;
    XPUserConfig.XP = XP;
    XPUserConfig.todayXP = Math.max(userFieldsFixedLimits.todayXP.min,XPUserConfig.todayXP+addedXPs);

    const grade: null|IGrade = await detectUpgrade(member, XPUserConfig, XPServerConfig);

    if (setByAdmin && grade === null) {
        const oldCurrentLevel = XPUserConfig.currentLevel;
        XPUserConfig.currentLevel = 0;
        XPUserConfig.lastNotifiedLevel = 0;
        XPUserConfig.gradeId = undefined;
        if (XPUserConfig.DMEnabled)
            await reportXPAndLevelVariation(XPServerConfig, XPUserConfig, member, oldCurrentLevel, oldXP)
    } else if (grade !== null) {
        await detectUplevel(member, XPUserConfig, XPServerConfig, grade, oldXP, setByAdmin);
    }
        
    await XPUserConfig.save();
}

export async function XPCanBeCount(guild: Guild, member: GuildMember, channel: GuildChannel, XPServerConfig: IXPData|null = null): Promise<null|IXPData> {
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