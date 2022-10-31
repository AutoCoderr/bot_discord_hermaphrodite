import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from "../../interfaces/IModel";

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
