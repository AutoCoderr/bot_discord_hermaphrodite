import {IXPUserData} from "../../Models/XP/XPUserData";
import XPData, {IXPData} from "../../Models/XP/XPData";
import client from "../../client";
import {Guild, GuildMember} from "discord.js";
import {detectUpgradeAndLevel, getXPUserConfig} from "../../libs/XP/XPCounting/countingOtherFunctions";
import CustomError from "../../logging/CustomError";
import reportError from "../../logging/reportError";

async function countXP(member: GuildMember, XPUserConfig: IXPUserData, XPServerConfig: IXPData) {
    XPUserConfig.XP += XPServerConfig.XPByVocal;
    XPUserConfig.todayXP += XPServerConfig.XPByVocal;

    await detectUpgradeAndLevel(member, XPUserConfig, XPServerConfig);
}

function reportXPVoiceCounterError(e: Error, guild: Guild, member: GuildMember, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
    reportError(new CustomError(e, {
        from: 'XPVoiceCounter',
        guild,
        user: member,
        XPServerConfig,
        XPUserConfig
    })).then(() => {
        process.exit();
    })
}

client.on('ready', async () => {
    const [serverId, userId] = process.argv.slice(2);
    try {
        const XPServerConfig: IXPData = await <Promise<IXPData>>XPData.findOne({serverId});
        const XPUserConfig: IXPUserData = await getXPUserConfig(serverId, userId);
        const guild = <Guild>client.guilds.cache.get(serverId);
        const member = await guild.members.fetch(userId);

        setTimeout(async () => {
            await countXP(member, XPUserConfig, XPServerConfig)
                .catch((e) => reportXPVoiceCounterError(e, guild, member, XPServerConfig, XPUserConfig));
            setInterval(() => {
                return countXP(member, XPUserConfig, XPServerConfig)
                    .catch((e) => reportXPVoiceCounterError(e, guild, member, XPServerConfig, XPUserConfig));;
            }, XPServerConfig.timeLimitVocal)
        }, Math.max(0, XPServerConfig.timeLimitVocal-10_000))

    } catch (e) {
        reportError(new CustomError(<Error>e, {
            from: 'XPVoiceCounter',
            userId,
            serverId
        })).then(() => {
            process.exit();
        })
    }
})





