import { Schema } from 'mongoose';
import { connect } from "../Mongo";


const db = connect();

export interface IVocalConfig {
    enabled: boolean;
    listenerBlacklist: { roles: string[], users: string[] };
    channelBlacklist: string[];
    listenableDenies: { [userId: string]: { channels: string[], users: string[], roles: string[], all: boolean } };
    userMutes: { [id: string]: { limit: number, lastMute: Date, mutedFor: number } };
    serverId: string;
}

const ListenerBlacklistSchema: Schema = new Schema({
    roles: { type: Array, required: true },
    users: { type: Array, required: true }
});

const VocalConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    listenerBlacklist: { type: ListenerBlacklistSchema, required: true },
    channelBlacklist: { type: Array, required: true },
    listenableDenies: { type: Object, required: false },
    userMutes: { type: Object, required: false },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalConfig>('VocalConfig', VocalConfigSchema);
