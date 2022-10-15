import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface IXPTipsUsefulAskButton {
    serverId: string;
    userId: string;
    useful: boolean;
    level: number;
    buttonId: string
    messageId: string;
    timestamps: Date;
}

const XPTipsUsefulAskButtonSchema: Schema = new Schema({
    serverId: { type: String, required: true},
    userId: { type: String, required: true},
    useful: { type: Boolean, required: true},
    level: { type: Number, required: true},
    buttonId: { type: String, required: true},
    messageId: { type: String, required: true},
    timestamps: { type: Date, required: false, default: () => new Date()}
});

// @ts-ignore
export default db.model<IXPTipsUsefulAskButton>('XPTipsUsefulAskButton', XPTipsUsefulAskButtonSchema);
