import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from "../../interfaces/IModel";
import { IFieldLimit } from '../../interfaces/CommandInterfaces';

const db = connect();

export interface IXPUserData extends IModel {
    serverId: string;
    userId: string;
    DMEnabled: boolean;
    XP: number;
    todayXP: number;
    gradeId?: string;
    lastNotifiedLevel: number;
    currentLevel: number;
    lastFirstDayMessageTimestamp?: Date;
    lastDayMessageTimestamp?: Date;
}

export const userFieldsFixedLimits: {[key: string]: IFieldLimit} = {
    XP: {min: 0, max: 10**12},
    todayXP: {min: 0, max: 10**12}
};

const XPUserDataSchema: Schema = new Schema({
    serverId: { type: String, required: true},
    userId: { type: String, required: true},
    DMEnabled: { type: Boolean, required: true, default: false},
    XP: { type: Number, required: false, default: 0 },
    todayXP: { type: Number, required: false, default: 0 },
    gradeId: { type: String, required: false },
    lastNotifiedLevel: { type: Number, required: false, default: 0 },
    currentLevel: { type: Number, required: false, default: 0 },
    lastFirstDayMessageTimestamp: { type: Date, required: false },
    lastDayMessageTimestamp: { type: Date, required: false }
});

// @ts-ignore
export default db.model<IXPUserData>('XPUserData', XPUserDataSchema);
