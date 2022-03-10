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

export function showTime(time: {h: number, m: number, s: number}, format: string): string {
    const {h,m,s} = time;
    switch (format) {
        case 'fr_long':
            return (h > 0 ? ' '+h+' heure'+(h > 1 ? 's' : '') : '')+
                (m > 0 ? ' '+m+' minute'+(m > 1 ? 's' : '') : '')+
                (s > 0 ? ' '+s+' seconde'+(s > 1 ? 's' : '') : '');
        case 'fr':
            return h+'h'+m+'m'+s+'s';
        case 'classic':
            return [h,m,s].join(':');
        default:
            return "invalid format";
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
