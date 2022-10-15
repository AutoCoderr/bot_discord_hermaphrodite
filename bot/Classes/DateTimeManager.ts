import {addMissingZero} from "./OtherFunctions";

export const durationUnits = {
    second: ['s','seconde','secondes','second','seconds','sec'],
    minute: ['m','minute','minutes','min'],
    hour: ['h','hour','hours','heure','heures']
}

export const durationUnitsMult = {
    second: 1000,
    minute: 60*1000,
    hour: 60*60*1000
}

export function extractDurationTime(duration: number) {
    return {
        h: Math.floor(duration/(1000*60*60)),
        m: Math.floor(duration/(1000*60))%60,
        s: Math.floor(duration/1000)%60
    }
}

export function extractTime(date: Date|number) {
    if (typeof(date) === "number")
        date = new Date(date);
    return {
        h: date.getHours(),
        m: date.getMinutes(),
        s: date.getSeconds()
    }
}

export function extractUTCTime(date: Date|number) {
    if (typeof(date) === "number")
        date = new Date(date);
    return {
        h: date.getUTCHours(),
        m: date.getUTCMinutes(),
        s: date.getUTCSeconds()
    }
}

export function extractDate(date: Date|number) {
    if (typeof(date) === "number")
        date = new Date(date);
    return {
        year: date.getFullYear(),
        month: date.getMonth()+1,
        day: date.getDate()
    }
}

export function extractUTCDate(date: Date|number) {
    if (typeof(date) === "number")
        date = new Date(date);
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth()+1,
        day: date.getUTCDate()
    }
}

export function showTime(time: {h: number, m: number, s: number}, format: 'fr_long'|'fr'|'classic'): string {
    const {h,m,s} = time;
    if (h+m+s === 0)
        return '0';
    switch (format) {
        case 'fr_long':
            return (h > 0 ? ' '+h+' heure'+(h > 1 ? 's' : '') : '')+
                (m > 0 ? ' '+m+' minute'+(m > 1 ? 's' : '') : '')+
                (s > 0 ? ' '+s+' seconde'+(s > 1 ? 's' : '') : '');
        case 'fr':
            return (h > 0 ? ' '+h+'h' : '')+
            ((m > 0 || h > 0) ? ' '+m+'m' : '')+
            ((s > 0 || m > 0 ||  h > 0) ? ' '+s+'s' : '');
        case 'classic':
            const acc: {values: string[], timeNotNull: boolean} = {values: [], timeNotNull: false};
            return [h,m,s].reduce(({values, timeNotNull},v) => ({
                timeNotNull: timeNotNull ? timeNotNull : v > 0,
                values: [...values, ...((v > 0 || timeNotNull) ? [addMissingZero(v)] : [])]
            }), acc).values.join(':');
        default:
            return "invalid time format";
    }
}

export function showDate(date: {year: number, month: number, day: number}, format: string): string {
    const {year,month,day} = date;
    switch (format) {
        case 'en':
            return year+"-"+addMissingZero(month)+"-"+addMissingZero(day);
        case 'fr':
            return addMissingZero(day)+"/"+addMissingZero(month)+"/"+year;
        default:
            return "invalid format";
    }
}
