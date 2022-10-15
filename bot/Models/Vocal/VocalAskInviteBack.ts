import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface IVocalAskInviteBack {
    buttonId: string;
    messageId: null|string;
    requesterId: string;
    requestedId: string;
    timestamp: Date;
    serverId: string;
}

const VocalAskInviteBackSchema: Schema = new Schema({
    buttonId: { type: String, required: true },
    messageId: { type: String, required: false },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalAskInviteBack>('VocalAskInviteBack', VocalAskInviteBackSchema);
