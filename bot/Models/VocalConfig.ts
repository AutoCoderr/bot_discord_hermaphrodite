import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IVocalConfig {
    enabled: boolean;
    listenerBlacklist: string[];
    listenedBlacklist: string[];
    channelBlacklist: string[];
    serverId: string;
}

const VocalConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    listenerBlacklist: { type: Array, required: true },
    listenedBlacklist: { type: Array, required: true },
    channelBlacklist: { type: Array, required: true },
    serverId: { type: String, required: true }
});


export default db.model<IVocalConfig>('VocalConfig', VocalConfigSchema);