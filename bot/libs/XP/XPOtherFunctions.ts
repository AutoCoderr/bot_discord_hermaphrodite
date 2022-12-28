import XPData, {IGrade, IXPData} from "../../Models/XP/XPData";
import XPUserData from "../../Models/XP/XPUserData";
import {
    ButtonInteraction,
    EmbedBuilder,
    Guild,
    GuildMember, EmbedField,
    Role, User, PermissionFlagsBits
} from "discord.js";
import {IXPUserData} from "../../Models/XP/XPUserData";
import XPNotificationAskButton, {
    IXPNotificationAskButton
} from "../../Models/XP/XPNotificationAskButton";
import {deleteMP} from "../../Classes/OtherFunctions";
import {getXPUserConfig} from "./XPCounting/countingOtherFunctions";
import {getTimezoneDatas} from "../timezones";

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

export async function enableOrDisableUserNotification(user: User|GuildMember, XPUserConfig: IXPUserData, toEnable: boolean, XPServerConfig: IXPData|null = null, sendMp = true): Promise<boolean> {
    if (sendMp) {
        XPServerConfig = XPServerConfig ?? (
                        toEnable ?
                            await XPData.findOne({
                                serverId: XPUserConfig.serverId
                            }) :
                            null
        )

        try {
            const unblockedTips = XPServerConfig !== null ?
                XPServerConfig.tipsByLevel.filter(tip => tip.level > XPUserConfig.lastNotifiedLevel && tip.level <= XPUserConfig.currentLevel) :
                []
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Notifications du système d'XP "+(toEnable ? "activées" : "désactivées"))
                        .setFields(
                            (toEnable && unblockedTips.length > 0) ?
                                {
                                    name: "Vous avez débloqué les tips des paliers suivants :",
                                    value: unblockedTips.map(tip =>
                                        "Palier " + tip.level
                                    ).join("\n")
                                } :
                                {
                                    name: "Notifications du système d'XP "+(toEnable ? "activées" : "désactivées"),
                                    value: "Vous avez "+(toEnable ? "activé" : "désactivé")+" les notifications pour le système d'XP"
                                }
                        )
                    ]
            })
        } catch (e) {
            return false;
        }

    }

    if (toEnable)
        XPUserConfig.lastNotifiedLevel = XPUserConfig.currentLevel;


    const buttons: IXPNotificationAskButton[] = await XPNotificationAskButton.find({
        serverId: XPUserConfig.serverId,
        userId: user.id
    })

    await Promise.all(buttons.map(async button => {
        await deleteMP(user instanceof User ? user : user.user, button.messageId);
        await button.remove()
    }))

    XPUserConfig.DMEnabled = toEnable;
    await XPUserConfig.save();

    return true;
}

export function roleCanBeManaged(guild: Guild, roleOrRoleId: Role|string) {
    const role: Role|undefined = roleOrRoleId instanceof Role ? roleOrRoleId : guild.roles.cache.get(roleOrRoleId);

    return role !== undefined && role.position < (<GuildMember>guild.members.me).roles.highest.position
}

export function checkIfBotCanManageRoles(guild: Guild) {
    return guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false
}

export function resetUsers(
    guild: Guild,
    XPUsersConfig: IXPUserData[],
    gradesById: {[gradeId: string]: IGrade}, 
    rolesCanBeManaged: boolean, 
    nonManageableRoles: {[roleId: string]: false},
    resetXPs: boolean = false
) {
    return Promise.all(
        XPUsersConfig.map(async XPUserConfig => {
            const grade: undefined|IGrade = XPUserConfig.gradeId ? gradesById[XPUserConfig.gradeId] : undefined;

            if (resetXPs) {
                XPUserConfig.XP = 0;
                XPUserConfig.todayXP = 0;
            }

            XPUserConfig.gradeId = undefined;
            XPUserConfig.currentLevel = 0;
            XPUserConfig.lastNotifiedLevel = 0;

            await XPUserConfig.save();

            if (
                !grade || 
                !rolesCanBeManaged || 
                nonManageableRoles[grade.roleId] === false
            )
                return;

            const member = await guild.members.fetch(XPUserConfig.userId).catch(() => null);

            if (!member)
                return;

            await member.roles.remove(grade.roleId);
        })
    )
}

export function warningNothingRoleCanBeAssignedMessage(guild: Guild): null|EmbedField {
    return checkIfBotCanManageRoles(guild) ?
        null :
        {
            name: "Attention, Herma Bot n'a pas la permission d'assigner les rôles de manière générale !",
            value: "Vous devez lui donner la permission",
            inline: false
        }
}

export function warningSpecificRolesCantBeAssignedMessage(guild: Guild, ...roles: Role[]|[Role[]]): {field: null|EmbedField, cantBeAssignedRoles: Role[]} {
    roles = (roles.length > 0 && roles[0] instanceof Array) ? roles[0] : roles
    if (guild.members.me === null)
        return {field: null, cantBeAssignedRoles: []};
    const cantBeAssignedRoles = (<Role[]>roles).filter(role => !roleCanBeManaged(guild, role))
    return {
        field: cantBeAssignedRoles.length > 0 ?{
            name: "Attention, Herma Bot ne peut pas assigner les rôles suivants car ils ont un rang plus élevé que le sien :",
            value: cantBeAssignedRoles.map(role => " - <@&"+role.id+">").join("\n"),
            inline: false
        } : null,
        cantBeAssignedRoles
    }
}

export function checkParametersData(guild: Guild, XPServerConfig: IXPData, params: any): Promise<boolean> {
    return Promise.all(
        (<[string[], string, ((v) => boolean|Promise<boolean>)][]>[
            [['string','undefined'], 'activeRoleId', (v) => (!v && !XPServerConfig.enabled) || guild.roles.cache.get(v)],
            [['string','undefined'], 'channelRoleId', (v) => !v || guild.roles.cache.get(v)],
            [['string'], 'timezone', (v) => getTimezoneDatas().then(({zones}) => zones[v] !== undefined)],
            [['number'], 'XPByMessage', (v) => v%1 === 0 && v > 0],
            [['number'], 'XPByFirstMessage', (v) => v%1 === 0 && v > 0],
            [['number'], 'XPByVocal', (v) => v%1 === 0 && v > 0],
            [['number'], 'timeLimitMessage', (v) => v%1 === 0 && v >= 0],
            [['number'], 'timeLimitVocal', (v) => v%1 === 0 && v >= 0],
            [['number'], 'firstMessageTime', (v) => v%1 === 0 && v >= 0]
        ])
            .map(async ([types, field, check]) => types.includes(typeof(params[field])) && await check(params[field]))
    ).then(checkedFields => !checkedFields.some(c => !c))
}

export async function getUserInfos(XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
    const grade: null|IGrade = XPServerConfig.grades.find(grade => (<string>grade._id).toString() === XPUserConfig.gradeId)??null
    const allSortedXPUserConfigs: IXPUserData[] = await XPUserData.find({
        serverId: XPUserConfig.serverId
    }).then(allXPUserConfigs => allXPUserConfigs.sort((a,b) => b.XP - a.XP));
    const rang: number = allSortedXPUserConfigs.findIndex(AXPUserConfig => AXPUserConfig.userId === XPUserConfig.userId) + 1;

    return {
        grade, 
        rang,
        XP: XPUserConfig.XP,
        todayXP: XPUserConfig.todayXP,
        currentLevel: XPUserConfig.currentLevel
    }
}