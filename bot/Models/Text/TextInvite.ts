import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface ITextInvite {
    inviteId: string;
    buttonId: string;
    messageId: null|string;
    requesterId: string;
    requestedId: string;
    channelsId?: string[];
    keywords?: string[];
    accept: boolean;
    timestamp?: Date;
    serverId: string;
}

const TextInviteSchema: Schema = new Schema({
    inviteId: { type: String, required: true },
    buttonId: { type: String, required: true },
    messageId: { type: String, required: false },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    channelsId: { type: Array, required: false, default: () => undefined },
    keywords: { type: Array, required: false, default: () => undefined },
    accept: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<ITextInvite>('TextInvite', TextInviteSchema);
