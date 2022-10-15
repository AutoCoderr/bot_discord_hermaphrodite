import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface IVocalInvite {
    inviteId: string;
    buttonId: string;
    messageId: null|string;
    requesterId: string;
    requestedId: string;
    accept: boolean;
    timestamp?: Date;
    serverId: string;
}

const VocalInviteSchema: Schema = new Schema({
    inviteId: { type: String, required: true },
    buttonId: { type: String, required: true },
    messageId: { type: String, required: false },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    accept: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalInvite>('VocalInvite', VocalInviteSchema);
