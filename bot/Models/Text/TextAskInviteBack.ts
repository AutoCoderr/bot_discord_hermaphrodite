import { Schema } from 'mongoose';
import IModel from '../../interfaces/IModel';
import { connect } from "../../Mongo";

const db = connect();

export const TextAskInviteBackTimeout = 8 * 60 * 60 * 1000;
export const TextAskInviteBackTimeoutWithoutMessageId = 48 * 60 * 60 * 1000;

export interface ITextAskInviteBack extends IModel {
    buttonId: string;
    messageId: null|string;
    requesterId: string;
    requestedId: string;
    channelsId: string[];
    keywords: string[];
    timestamp: Date;
    serverId: string;
}

const TextAskInviteBackSchema: Schema = new Schema({
    buttonId: { type: String, required: true },
    messageId: { type: String, required: true },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    channelsId: { type: Array, required: false },
    keywords: { type: Array, required: false },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<ITextAskInviteBack>('TextAskInviteBack', TextAskInviteBackSchema);
