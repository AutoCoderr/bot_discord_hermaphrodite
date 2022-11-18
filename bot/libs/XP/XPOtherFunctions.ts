import XPData, {IGrade, IXPData} from "../../Models/XP/XPData";
import {
    ButtonInteraction, ButtonStyle,
    EmbedBuilder,
    Guild,
    GuildMember,
    Role, User
} from "discord.js";
import XPUserData, {IXPUserData} from "../../Models/XP/XPUserData";
import XPNotificationAskButton, {
    IXPNotificationAskButton
} from "../../Models/XP/XPNotificationAskButton";
import {deleteMP} from "../../Classes/OtherFunctions";
import {getXPUserConfig} from "./XPCounting/countingOtherFunctions";

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