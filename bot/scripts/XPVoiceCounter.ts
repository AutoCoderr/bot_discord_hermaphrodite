import {IXPUserData} from "../Models/XP/XPUserData";
import {getXPUserConfig} from "../Classes/XPFunctions";

async function countXP(XPUserConfig: IXPUserData, XPByVocal: number) {
    XPUserConfig.XP += XPByVocal;
    XPUserConfig.todayXP += XPByVocal;

    await XPUserConfig.save();
}

(async () => {
    const serverId = process.argv[2];
    const userId = process.argv[3];
    const timeLimitVocal = parseInt(process.argv[4]);
    const XPByVocal = parseInt(process.argv[5]);

    const XPUserConfig: IXPUserData = await getXPUserConfig(serverId, userId);

    setTimeout(async () => {
        await countXP(XPUserConfig, XPByVocal);
        setInterval(() => {
            return countXP(XPUserConfig, XPByVocal);
        }, timeLimitVocal)
    }, Math.max(0, timeLimitVocal-10_000))
})()





