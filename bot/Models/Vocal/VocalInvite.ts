import { Schema } from 'mongoose';
import IModel from '../../interfaces/IModel';
import { connect } from "../../Mongo";

const db = connect();

export const VocalInviteTimeout = 8 * 60 * 60 * 1000;
export const VocalInviteTimeoutWithoutMessageId = 48 * 60 * 60 * 1000;

export interface IVocalInvite extends IModel {
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
    messageId: { type: String, required: true },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    accept: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalInvite>('VocalInvite', VocalInviteSchema);
