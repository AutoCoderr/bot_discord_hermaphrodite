import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import {Snowflake} from "discord.js";


const db = connect();

export const defaultLimit = 5*60*1000; // By default 5 minutes for the limit, can be changed by admin
export const minimumLimit = 2*60*1000; // At least 2 minutes for the limit

export interface ITextConfig {
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

const TextConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    listenerBlacklist: { type: ListenerBlacklistSchema, required: true },
    channelBlacklist: { type: Array, required: true },
    defaultLimit: { type: Number, required: false, default: () => defaultLimit },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<ITextConfig>('TextConfig', TextConfigSchema);
