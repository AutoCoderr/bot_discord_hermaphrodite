import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface ITextInvite {
    buttonId: string;
    requesterId: string;
    requestedId: string;
    channelsId?: string[];
    keywords?: string[];
    accept: boolean;
    timestamp?: Date;
    serverId: string;
}

const TextInviteSchema: Schema = new Schema({
    buttonId: { type: String, required: true },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    channelsId: { type: Array, required: false },
    keywords: { type: Array, required: false },
    accept: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<ITextInvite>('TextInvite', TextInviteSchema);
