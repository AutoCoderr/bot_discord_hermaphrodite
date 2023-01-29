import XPData from "../../Models/XP/XPData";
import XPUserData from "../../Models/XP/XPUserData";
import {getTimezoneDatas} from "../../libs/timezones";
import {addMissingZero} from "../../Classes/OtherFunctions";
import moment from "moment-timezone";

const date = new Date();

function getTimezonesOffset() {
    if (date.getHours() === 12 && date.getMinutes() === 0)
        return ["+12:00","-12:00"]

    if (date.getHours() < 12)
        return [`-${addMissingZero(date.getHours())}:${addMissingZero(date.getMinutes())}`];
    
    const gobalMinutes = 24*60 - date.getHours()*60 - date.getMinutes();

    return [`+${addMissingZero(Math.floor(gobalMinutes/60))}:${addMissingZero(gobalMinutes%60)}`]   
}

(async () => {
    try {
        const timezonesOffets = getTimezonesOffset();

        
        const {zones} = await getTimezoneDatas();
        const timezones = Object.keys(zones)
            .filter(zone => {
                const zonedDate = moment.utc(date.toISOString()).tz(zone).format();
                return timezonesOffets.some(timezoneOffset => zonedDate.substring(zonedDate.length-timezoneOffset.length) === timezoneOffset)
            })

        console.log("Concerned timezones offset :")
        console.log(timezonesOffets);
        console.log("Reset today XP of all users on bellow timezones :");
        console.log(timezones);
        const XPServerIds = await XPData.find({
            timezone: { $in: timezones }
        })
            .then(XPServerConfigs => 
                XPServerConfigs
                    .map(XPServerConfig => XPServerConfig.serverId)
            )
        console.log(XPServerIds.length+" servers concerned");

        const {modifiedCount} = await XPUserData.updateMany({ serverId: {$in: XPServerIds} }, { $set: { todayXP: 0 } });
        console.log(modifiedCount+" users had their todayXPs reset");
    } catch (e) {
        console.log("ERROR ->");
        console.log(e);
    }
    process.exit()
})();

