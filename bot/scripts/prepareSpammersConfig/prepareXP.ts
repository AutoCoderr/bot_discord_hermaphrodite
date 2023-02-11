import XPData from "../../Models/XP/XPData";
import XPNotificationAskButton from "../../Models/XP/XPNotificationAskButton";
import XPTipsUsefulAskButton from "../../Models/XP/XPTipsUsefulAskButton";
import XPUserData from "../../Models/XP/XPUserData";
import { IConfig, ISpecifiedXPConfig } from "./interfaces";
import { checkParametersData } from "../../libs/XP/XPOtherFunctions";
import { checkGradesListData } from "../../libs/XP/gradeCalculs";
import { checkTipsListData } from "../../libs/XP/tips/tipsOtherFunctions";
import { Guild } from "discord.js";

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

    await Promise.all(
        servers.map(serverConfig => {
            const XPConfig: ISpecifiedXPConfig = <ISpecifiedXPConfig>(serverConfig.XPConfig ?? config.XPConfig)
            return XPData.create({
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
        })
    )
    console.log("new XP config generated");
}