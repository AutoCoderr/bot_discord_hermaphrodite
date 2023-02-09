import { ILevelTip } from "../../Models/XP/XPData";
import { IConfig } from "./interfaces";

const config: IConfig = {
    vocal: true,
    vocalNbListenByUser: [2,4],
    text: true,
    textNbListenByUser: 2,
    XP: true,
    XPConfig: {
        activeRoleId: 'active_role_id',
        channelRoleId: 'channel_role_id',
        
        XPByMessage: 10,
        XPByVocal: 20,
        XPByFirstMessage: 50,
        timeLimitMessage: 0,
        timeLimitVocal: 5 * 1000,
        firstMessageTime: 7 * 60 * 60 * 1000,

        grades: [
            {
                atLevel: 1,
                requiredXP: 15,
                XPByLevel: 50,
                name: "A",
                roleId: "role_id"
            },
            {
                atLevel: 6,
                requiredXP: 265,
                XPByLevel: 75,
                name: "B",
                roleId: "role_id"
            },
            {
                atLevel: 11,
                requiredXP: 640,
                XPByLevel: 100,
                name: "C",
                roleId: "role_id"
            }
        ],
        tipsByLevel: ((n: number) => {
            const tips: ILevelTip[] = [];
            for (let i=1;i<n;i+=2) {
                tips.push({
                    level: i,
                    content: "level "+i,
                    userApproves: i === 1 ? null : [],
                    userUnapproves: i === 1 ? null : [],
                })
            }
            return tips;
        })(99)
    },
    servers: {
        id: "server_id",
        spammersIds: [
            "spammer_1_id",
            "spammer_2_id",
            "spammer_3_id",
            "spammer_4_id"
        ]
    }
}
export default config;