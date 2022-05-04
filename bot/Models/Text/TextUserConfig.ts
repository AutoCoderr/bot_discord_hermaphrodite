import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

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
    limit: { type: Number, required: true, default: 0 },
    mutedFor: { type: Number, required: false },
    lastMute: { type: Date, required: false }
});

// @ts-ignore
export default db.model<ITextUserConfig>('TextUserConfig', TextUserConfigSchema);
