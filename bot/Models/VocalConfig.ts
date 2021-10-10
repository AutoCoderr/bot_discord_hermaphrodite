import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IVocalConfig {
    enabled: boolean;
    listenerBlacklist: string[];
    listenableBlacklist: string[];
    channelBlacklist: string[];
    limitByUser: { [id: string]: number };
    muteByUser: { [id: string]: number }; // Last mute command datetime by User, to know who user we have to mute
    serverId: string;
}

const VocalConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    listenerBlacklist: { type: Array, required: true },
    listenableBlacklist: { type: Array, required: true },
    channelBlacklist: { type: Array, required: true },
    limitByUser: { type: Object, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalConfig>('VocalConfig', VocalConfigSchema);