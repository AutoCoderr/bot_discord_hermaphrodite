import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from "../../interfaces/IModel";
import { IFieldLimit } from '../../interfaces/CommandInterfaces';

const db = connect();

export interface ILevelTip {
    level: number;
    content: string;
    userApproves: null|string[];
    userUnapproves: null|string[];
}

export interface IGrade {
    _id?: string;

    atLevel: number;
    requiredXP: number;
    XPByLevel: number;
    name: string;
    roleId: string;
}

export interface IXPData extends IModel {
    serverId: string;
    enabled: boolean;
    activeRoleId?: string;
    channelRoleId?: string;

    timezone: string;

    XPByMessage: number;
    XPByFirstMessage: number;
    XPByVocal: number;

    timeLimitMessage: number;
    timeLimitVocal: number;

    firstMessageTime: number;

    tipsByLevel: ILevelTip[];

    grades: IGrade[];
}


export const tipFieldsFixedLimits: {[key: string]: IFieldLimit} = {
    level: {min: 1, max: 10**6},
    content: {min: 1, max: 1750}
}
const LevelTipSchema: Schema = new Schema({
    level: { type: Number, required: true },
    content: { type: String, required: true },
    userApproves: [String],
    userUnapproves: [String]
})

export const gradeFieldsFixedLimits: {[key: string]: IFieldLimit} = {
    atLevel: {min: 1, max: 10**6},
    requiredXP: {min: 1, max: 10**9},
    XPByLevel: {min: 1, max: 10**9},
    name: {min: 1, max: 100}
}
const GradeSchema: Schema = new Schema({
    atLevel: { type: Number, required: true },
    requiredXP: { type: Number, required: true },
    XPByLevel: { type: Number, required: true },
    name: { type: String, required: true },
    roleId: { type: String, required: true }
})

export const XPDataDefaultValues = {
    enabled: false,
    activeRoleId: undefined,
    channelRoleId: undefined,
    timezone: "Europe/Paris",
    XPByMessage: 1,
    XPByFirstMessage: 10,
    XPByVocal: 1,
    timeLimitMessage: 60 * 1000,
    timeLimitVocal: 5 * 60 * 1000,
    firstMessageTime: 7 * 60 * 60 * 1000
}

export const XPGainsFixedLimits: {[key: string]: IFieldLimit} = {
    XPByMessage: {min: 1, max: 10**9},
    XPByFirstMessage: {min: 1, max: 10**9},
    XPByVocal: {min: 1, max: 10**9},
    timeLimitMessage: {min: 0, max: 10*365*24*60*60*1000}, // max: 10 ans
    timeLimitVocal: {min: 10*1000, max: 10*365*24*60*60*1000}, /// min: 10s, max: 10 ans
    firstMessageTime: {min: 0, max: 23*60*60*1000 + 59*60*1000 + 59*1000} /// min: 00h00m00s, max: 23h59m59s
}
const XPDataSchema: Schema = new Schema({
    serverId: { type: String, required: true },
    enabled: { type: Boolean, required: false, default: XPDataDefaultValues.enabled },
    activeRoleId: { type: String, required: false },
    channelRoleId: { type: String, required: false },

    timezone: { type: String, required: false, default: XPDataDefaultValues.timezone },

    XPByMessage: { type: Number, required: false, default: XPDataDefaultValues.XPByMessage },
    XPByFirstMessage: { type: Number, required: false, default: XPDataDefaultValues.XPByFirstMessage },
    XPByVocal: { type: Number, required: false, default: XPDataDefaultValues.XPByVocal },

    timeLimitMessage: { type: Number, required: false, default: XPDataDefaultValues.timeLimitMessage },
    timeLimitVocal: { type: Number, required: false, default: XPDataDefaultValues.timeLimitVocal },

    firstMessageTime: { type: Number, required: false, default: XPDataDefaultValues.firstMessageTime },

    tipsByLevel: [LevelTipSchema],

    grades: [GradeSchema]
});

// @ts-ignore
export default db.model<IXPData>('XPData', XPDataSchema);
