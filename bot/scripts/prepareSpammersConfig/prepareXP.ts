import XPData, { IXPData } from "../../Models/XP/XPData";
import XPNotificationAskButton from "../../Models/XP/XPNotificationAskButton";
import XPTipsUsefulAskButton from "../../Models/XP/XPTipsUsefulAskButton";
import XPUserData from "../../Models/XP/XPUserData";
import { IConfig, ISpecifiedXPConfig } from "./interfaces";
import { checkIfBotCanManageRoles, checkParametersData, roleCanBeManaged } from "../../libs/XP/XPOtherFunctions";
import { checkGradesListData, reassignRoles } from "../../libs/XP/gradeCalculs";
import { checkTipsListData } from "../../libs/XP/tips/tipsOtherFunctions";
import { Guild, Role } from "discord.js";

export default async function prepareXP(config: IConfig, guilds: Guild[]) {
    if (!config.XP)
        return;

    const servers = config.servers instanceof Array ? config.servers : [config.servers];
    
    await Promise.all(
        servers.map(async (serverConfig,i) => {
            const XPConfig = serverConfig.XPConfig ?? config.XPConfig;

            if (!XPConfig)
                throw new Error("You need to specify at least activeChannelId in XPConfig");

            const guild = guilds[i];

            if (!(await checkParametersData(guild, XPConfig, null, [
                'XPByMessage',
                'XPByVocal',
                'XPByFirstMessage',
                'timeLimitMessage',
                'timeLimitVocal',
                'firstMessageTime'
            ])))
                throw new Error("Invalid parameters data for XP system on guild '"+guild.name+"' ("+guild.id+")")
            
            if (!checkGradesListData(guild, XPConfig.grades??[]))
                throw new Error("Invalid grades data for XP system on guild '"+guild.name+"' ("+guild.id+")")
            
            if (!checkTipsListData(XPConfig.tipsByLevel??[]))
                throw new Error("Invalid tips data for XP system on guild '"+guild.name+"' ("+guild.id+")")
        })
    )

    console.log("\nConfiguring XP ...");

    const serversIds = servers.map(({id}) => id);    
    await Promise.all(
        [XPData, XPNotificationAskButton, XPTipsUsefulAskButton, XPUserData]
            .map(model => model.deleteMany({
                serverId: {$in: serversIds}
            }))
    )

    console.log("Old XP config reset");

    const rolesById: {[id: string]: null|Role} = servers.reduce((acc,serverConfig,i) => {
        const XPConfig: ISpecifiedXPConfig = <ISpecifiedXPConfig>(serverConfig.XPConfig ?? config.XPConfig);

        return (XPConfig.grades??[]).reduce((acc,{roleId}) => ({
            ...acc,
            [roleId]: acc[roleId] !== undefined ?
                        acc[roleId] :
                        (guilds[i].roles.cache.get(roleId)??null)
        }), acc)
    }, {})

    await Promise.all(
        servers.map(async (serverConfig,i) => {
            const XPConfig: ISpecifiedXPConfig = <ISpecifiedXPConfig>(serverConfig.XPConfig ?? config.XPConfig)

            await Promise.all(
                serverConfig.spammersIds.map(spammerId =>
                    XPUserData.create({
                        serverId: serverConfig.id,
                        userId: spammerId,
                        DMEnabled: true
                    })    
                )
            )

            const savedXPConfig: IXPData = await XPData.create({
                serverId: serverConfig.id,
                enabled: true,
                ...XPConfig,
                tipsByLevel: XPConfig.tipsByLevel ?
                    XPConfig.tipsByLevel.map((tip,i) => ({
                        ...tip,
                        userApproves: i === 0 ? null : [],
                        userUnapproves: i === 0 ? null : []
                    })) : []
            })

            const guild = guilds[i];

            if (XPConfig.grades === undefined || !checkIfBotCanManageRoles(guild))
                return;

            const nonManageableRoles = Object.entries(rolesById)
                .reduce((acc,[id,role]) => ({
                    ...acc,
                    [id]: role === null || role.guild.id !== guild.id || !roleCanBeManaged(guild, role)
                }), {})

            await reassignRoles(guild, savedXPConfig.grades, nonManageableRoles, rolesById)
        })
    )
    console.log("new XP config generated");
}