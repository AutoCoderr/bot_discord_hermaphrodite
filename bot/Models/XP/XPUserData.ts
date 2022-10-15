import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface IXPUserData {
    serverId: string;
    userId: string;
    DMEnabled: boolean;
    XP: number;
    todayXP: number;
    gradeId: null|string;
    lastNotifiedLevel: number;
    currentLevel: number;
    lastFirstDayMessageTimestamp: null|Date;
}

const XPUserDataSchema: Schema = new Schema({
    serverId: { type: String, required: true},
    userId: { type: String, required: true},
    DMEnabled: { type: Boolean, required: true},
    XP: { type: Number, required: false, default: 0 },
    todayXP: { type: Number, required: false, default: 0 },
    gradeId: { type: String, required: false },
    lastNotifiedLevel: { type: String, required: false, default: 0 },
    currentLevel: { type: String, required: false, default: 0 },
    lastFirstDayMessageTimestamp: { type: Date, required: false }
});

// @ts-ignore
export default db.model<IXPUserData>('XPUserData', XPUserDataSchema);
