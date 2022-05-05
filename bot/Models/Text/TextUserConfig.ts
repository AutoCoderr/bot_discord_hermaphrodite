import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export const minimumLimit = 2*60*1000; // at least 2 minutes for the limit

export interface ITextUserConfig {
    userId: string;
    serverId: string;
    blocking: Array<{userId?: string, channelId?: string}>;
    limit: number;
    mutedFor?: number;
    lastMute?: Date;
}

const BlockingSchema: Schema = new Schema({
    userId: { type: String, required: false },
    channelId: { type: String, required: false }
}, { _id: false });

const TextUserConfigSchema: Schema = new Schema({
    userId: { type: String, required: true },
    serverId: { type: String, required: true },
    blocking: [BlockingSchema],
    limit: { type: Number, required: true, default: 5*60*1000 /* 5 minutes by default */ },
    mutedFor: { type: Number, required: false },
    lastMute: { type: Date, required: false }
});

// @ts-ignore
export default db.model<ITextUserConfig>('TextUserConfig', TextUserConfigSchema);
