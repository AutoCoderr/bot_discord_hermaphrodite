import XPData, {IGrade, IXPData, XPGainsFixedLimits} from "../../Models/XP/XPData";
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
import {deleteMP, getMP} from "../../Classes/OtherFunctions";
import {getXPUserConfig} from "./XPCounting/countingOtherFunctions";
import {getTimezoneDatas} from "../timezones";
import client from "../../client";

async function deleteNotificationButtons(serverId: string, user: User|GuildMember) {
    const buttons: IXPNotificationAskButton[] = await XPNotificationAskButton.find({
        serverId: serverId,
        userId: user.id
    })

    await Promise.all(buttons.map(async button => {
        await button.remove();

        const message = await getMP(user instanceof User ? user : user.user, button.messageId);
        if (message === null)
            return;
        
        await message.edit({
            content: message.content.split("\n-------------------------------")[0],
            components: []
        });
    }))
}

export async function listenXPNotificationAskButtons(interaction: ButtonInteraction): Promise<boolean> {
    const button: null|IXPNotificationAskButton = await XPNotificationAskButton.findOne({
        userId: interaction.user.id,
        buttonId: interaction.customId
    });

    if (button === null)
        return false;

    const guild: undefined|Guild = client.guilds.cache.get(button.serverId);

    if (guild === undefined)
        return !deleteNotificationButtons(button.serverId, interaction.user) && false;

    const XPUserConfig: IXPUserData = await getXPUserConfig(button.serverId,button.userId);

    await enableOrDisableUserNotification(guild, interaction.user, XPUserConfig, button.toEnable)

    await interaction.editReply("Notifications "+(button.toEnable ? "activées" : "désactivées")+" avec succès!")

    return true;
}

export async function enableOrDisableUserNotification(guild: Guild, user: User|GuildMember, XPUserConfig: IXPUserData, toEnable: boolean, XPServerConfig: IXPData|null = null, sendMp = true): Promise<boolean> {
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
                                    name: "Vous avez débloqué les tips des paliers suivants sur le serveur '"+guild.name+"':",
                                    value: unblockedTips.map(tip =>
                                        "Palier " + tip.level
                                    ).join("\n")
                                } :
                                {
                                    name: "Notifications du système d'XP "+(toEnable ? "activées" : "désactivées")+" sur le serveur '"+guild.name+"'",
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

    await deleteNotificationButtons(guild.id, user);

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

const checkGainsParameterInteger = (v,field) => v === undefined || (v%1 === 0 && v >= XPGainsFixedLimits[field].min && v <= XPGainsFixedLimits[field].max)

export function checkParametersData(guild: Guild, params: any, XPServerConfig: null|IXPData = null, toSkip: string[] = []): Promise<boolean> {
    return Promise.all(
        (<[string, string, ((v,field) => boolean|Promise<boolean>)][]>[
            ['string', 'activeRoleId', (v) => (!v && XPServerConfig && !XPServerConfig.enabled) || guild.roles.cache.get(v)],
            ['string', 'channelRoleId', (v) => !v || guild.roles.cache.get(v)],
            ['string', 'timezone', (v) => v === undefined || getTimezoneDatas().then(({zones}) => zones[v] !== undefined)],
            ['number', 'XPByMessage', checkGainsParameterInteger],
            ['number', 'XPByFirstMessage', checkGainsParameterInteger],
            ['number', 'XPByVocal', checkGainsParameterInteger],
            ['number', 'timeLimitMessage', checkGainsParameterInteger],
            ['number', 'timeLimitVocal', checkGainsParameterInteger],
            ['number', 'firstMessageTime', checkGainsParameterInteger]
        ])
            .map(async ([type, field, check]) => 
                toSkip.includes(field) ||
                (
                    (params[field] === undefined || type === typeof(params[field])) && 
                    await check(params[field],field)
                )
            )
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