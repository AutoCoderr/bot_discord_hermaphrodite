import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface ITextAskInviteBack {
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
    messageId: { type: String, required: false },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    channelsId: { type: Array, required: false },
    keywords: { type: Array, required: false },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<ITextAskInviteBack>('TextAskInviteBack', TextAskInviteBackSchema);
