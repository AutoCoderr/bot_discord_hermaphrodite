import {IXPUserData} from "../../Models/XP/XPUserData";
import XPData, {IXPData} from "../../Models/XP/XPData";
import client from "../../client";
import {Guild, GuildMember} from "discord.js";
import {detectUpgradeAndLevel, getXPUserConfig} from "../../libs/XP/XPCounting/countingOtherFunctions";
import { tryCatchProcess } from "../../logging/catchers";

async function countXP(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData) {
    return detectUpgradeAndLevel(member, XPUserConfig, XPServerConfig, XPUserConfig.XP+XPServerConfig.XPByVocal);
}


client.on('ready', async () => {
    tryCatchProcess(async ({setTimeout, setInterval}) => {
        const [serverId, userId] = process.argv.slice(2);
        const XPServerConfig: IXPData = await <Promise<IXPData>>XPData.findOne({serverId});
        const XPUserConfig: IXPUserData = await getXPUserConfig(serverId, userId);
        const guild = <Guild>client.guilds.cache.get(serverId);
        const member = await guild.members.fetch(userId);
    
        setTimeout(async () => {
            await countXP(member, XPUserConfig, XPServerConfig)
            setInterval(() => {
                return countXP(member, XPUserConfig, XPServerConfig)
            }, XPServerConfig.timeLimitVocal)
        }, Math.max(0, XPServerConfig.timeLimitVocal-10_000))
    })
})





