import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from "../../interfaces/IModel";

const db = connect();

export interface ILevelTip {
    level: number;
    content: string;
    userApproves: string[];
    userUnapproves: string[];
}

export interface IGrade {
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

    timezone: number;

    XPByMessage: number;
    XPByFirstMessage: number;
    XPByVocal: number;
    XPByBump: number;

    timeLimitMessage: number;
    timeLimitVocal: number;

    firstMessageTime: number;

    tipsByLevel: ILevelTip[];

    grades: IGrade[];
}



const LevelTipSchema: Schema = new Schema({
    level: { type: Number, required: true },
    content: { type: String, required: true },
    userApproves: [String],
    userUnapproves: [String]
})

const GradeSchema: Schema = new Schema({
    atLevel: { type: Number, required: true },
    requiredXP: { type: Number, required: true },
    XPByLevel: { type: Number, required: true },
    name: { type: String, required: true },
    roleId: { type: String, required: true }
})

const XPDataSchema: Schema = new Schema({
    serverId: { type: String, required: true },
    enabled: { type: Boolean, required: false, default: false },
    activeRoleId: { type: String, required: false },
    channelRoleId: { type: String, required: false },

    timezone: { type: Number, required: true, default: 1 },

    XPByMessage: { type: Number, required: false, default: 1 },
    XPByFirstMessage: { type: Number, required: false, default: 10 },
    XPByVocal: { type: Number, required: false, default: 1 },
    XPByBump: { type: Number, required: false, default: 25 },

    timeLimitMessage: { type: Number, required: false, default: 60 * 1000 },
    timeLimitVocal: { type: Number, required: false, default: 5 * 60 * 1000 },

    firstMessageTime: { type: Number, required: false, default: 6 * 60 * 60 * 1000 },

    tipsByLevel: [LevelTipSchema],

    grades: [GradeSchema]
});

// @ts-ignore
export default db.model<IXPData>('XPData', XPDataSchema);
