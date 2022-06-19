import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import {Snowflake} from "discord.js";


const db = connect();

export const defaultLimit = 0; // By default 0 for the limit, can be changed by admin
export const minimumLimit = 0; // Minimum value for the limit

export interface IVocalConfig {
    enabled: boolean;
    listenerBlacklist: { roles: Snowflake[], users: Snowflake[] };
    channelBlacklist: Snowflake[];
    defaultLimit?: number;
    serverId: Snowflake;
}

const ListenerBlacklistSchema: Schema = new Schema({
    roles: { type: Array, required: true },
    users: { type: Array, required: true }
});

const VocalConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    listenerBlacklist: { type: ListenerBlacklistSchema, required: true },
    channelBlacklist: { type: Array, required: true },
    defaultLimit: { type: Number, required: false, default: () => defaultLimit },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalConfig>('VocalConfig', VocalConfigSchema);
