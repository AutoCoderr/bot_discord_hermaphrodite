import { Schema } from 'mongoose';
import IModel from '../../interfaces/IModel';
import { connect } from "../../Mongo";

const db = connect();

export const VocalAskInviteBackTimeout = 8 * 60 * 60 * 1000;
export const VocalAskInviteBackTimeoutWithoutMessageId = 48 * 60 * 60 * 1000;

export interface IVocalAskInviteBack extends IModel {
    buttonId: string;
    messageId: null|string;
    requesterId: string;
    requestedId: string;
    timestamp: Date;
    serverId: string;
}

const VocalAskInviteBackSchema: Schema = new Schema({
    buttonId: { type: String, required: true },
    messageId: { type: String, required: true },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalAskInviteBack>('VocalAskInviteBack', VocalAskInviteBackSchema);
