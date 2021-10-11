import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IVocalConfig {
    enabled: boolean;
    listenerBlacklist: string[];
    listenableBlacklist: string[];
    channelBlacklist: string[];
    userMutes: { [id: string]: { limit: number, lastMute: Date, mutedFor: number } };
    serverId: string;
}

const VocalConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    listenerBlacklist: { type: Array, required: true },
    listenableBlacklist: { type: Array, required: true },
    channelBlacklist: { type: Array, required: true },
    userMutes: { type: Object, required: false },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalConfig>('VocalConfig', VocalConfigSchema);
