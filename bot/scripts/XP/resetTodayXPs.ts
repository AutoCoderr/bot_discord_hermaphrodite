import XPData, {IXPData} from "../../Models/XP/XPData";
import XPUserData from "../../Models/XP/XPUserData";

function aggregateFromRange(callback, a, b, acc) {
    for (let n=a;n<=b;n++) {
        acc = callback(acc,n);
    }
    return acc;
}

const showTimezone = timezone => "UTC"+(timezone >= 0 ? "+" : "")+timezone

const timezones = {
    [0]: [0],
    ...(aggregateFromRange((acc,n) => ({
        ...acc,
        [n]: [-1*n]
    }), 1, 11, {})),
    [12]: [-12,12],
    ...(aggregateFromRange((acc,n) => ({
        ...acc,
        [n]: [24-n]
    }), 13, 23, {}))
}[new Date().getHours()];

(async () => {
    try {
        console.log("Reset today XP of all users on timezone"+(timezones.length > 1 ? "s" : "")+" "+timezones.map(showTimezone).join(", "))
        const XPServerIds = await XPData.find({
            timezone: { $in: timezones }
        }).then(XPServerConfigs => XPServerConfigs.map(XPServerConfig => XPServerConfig.serverId))
        console.log(XPServerIds.length+" servers concerned");

        const {modifiedCount} = await XPUserData.updateMany({ serverId: {$in: XPServerIds} }, { $set: { todayXP: 0 } });
        console.log(modifiedCount+" users had their todayXPs reset");
    } catch (e) {
        console.log("ERROR ->");
        console.log(e);
    }
    process.exit()
})();

