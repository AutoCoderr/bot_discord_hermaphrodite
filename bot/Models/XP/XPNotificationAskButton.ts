import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from "../../interfaces/IModel";

const db = connect();

export const XPNotificationAskButtonTimeout = 7 * 24 * 60 * 60 * 1000

export interface IXPNotificationAskButton extends IModel {
    serverId: string;
    userId: string;
    toEnable: boolean;
    buttonId: string
    messageId: string;
    timestamps: Date;
}

const XPNotificationAskButtonSchema: Schema = new Schema({
    serverId: { type: String, required: true},
    userId: { type: String, required: true},
    toEnable: { type: Boolean, required: true},
    buttonId: { type: String, required: true},
    messageId: { type: String, required: true},
    timestamps: { type: Date, required: false, default: () => new Date()}
});

// @ts-ignore
export default db.model<IXPNotificationAskButton>('XPNotificationAskButton', XPNotificationAskButtonSchema);
