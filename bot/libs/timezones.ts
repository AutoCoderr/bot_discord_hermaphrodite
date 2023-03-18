import {addMissingZero} from "../Classes/OtherFunctions";

const fs = require("fs/promises");
const {constants: {F_OK}} = fs;

const file = __dirname+"/../node_modules/moment-timezone/data/meta/latest.json";

interface ITimezoneData {
    zones: {
        [zone: string]: any
    }
} 

let datas: null|ITimezoneData = null;

export async function setTimeZoneDatas(): Promise<void> {
    if (!(await fs.access(file, F_OK).then(() => true).catch(() => false)))
        throw new Error("Json data file can't be found for moment-timezone");
    
    const json = await fs.readFile(file).then(res => res.toString()).then(res => JSON.parse(res));

    datas = json
}

export async function getTimezoneDatas(): Promise<ITimezoneData> {
    if (datas === null)
        await setTimeZoneDatas();

    return <ITimezoneData>datas;
}

export function findTimezonesFromKeyword(keyword: string): Promise<string[]> {
    return getTimezoneDatas().then(({zones}) => Object.keys(zones).filter(zone => zone.toLowerCase().replace(keyword, "") !== zone.toLowerCase()))
}


export function convertTimeNumberToMomentTimeZoneFormat(n: number) {
    const currentDate = new Date();
    const currentDateNumber = currentDate.getTime() - 
        currentDate.getHours()*60*60*1000 - 
        currentDate.getMinutes()*60*1000 - 
        currentDate.getSeconds()*1000 -
        currentDate.getMilliseconds();

    return convertNumberToMomentTimeZoneFormat(currentDateNumber+n);
}
export function removeTimeZoneFromISODate(s: string, d: null|string = null) {
    if (d === null) {
        for (const d of ["-","+"]) {
            const s2 = removeTimeZoneFromISODate(s,d);
            if (s2)
                return s2
        }
        return s;
    }
    const splittedS1 = s.split("T");
    const splittedS2 = splittedS1[1].split(d);
    return splittedS2.length > 1 ? splittedS1[0]+"T"+splittedS2[0] : null
}
export function convertNumberToMomentTimeZoneFormat(n: number) {
    return convertDateToMomentTimeZoneFormat(new Date(n));
}
export function convertStringToMomentTimeZoneFormat(s: string) {
    return convertDateToMomentTimeZoneFormat(new Date(s));
}
export function convertStringWithoutTimeZoneToMomentTimeZoneFormat(s: string) {
    const splittedString = s.split("-");
    return convertDateToMomentTimeZoneFormat(new Date(splittedString.length > 3 ? splittedString.slice(0,3).join("-") : s));
}
export function convertStringToTimeNumber(s: string) {
    const d = new Date(s);
    return d.getHours()*60*60*1000 + d.getMinutes()*60*1000 + d.getSeconds()*1000
}
export function convertDateToMomentTimeZoneFormat(d: Date) {
    return d.getFullYear()+"-"+addMissingZero(d.getMonth()+1)+"-"+addMissingZero(d.getDate())+" "+addMissingZero(d.getHours())+":"+addMissingZero(d.getMinutes())+":"+addMissingZero(d.getSeconds());
}
