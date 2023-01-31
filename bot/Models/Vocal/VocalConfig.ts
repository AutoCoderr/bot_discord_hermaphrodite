import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import {Snowflake} from "discord.js";
import IModel from '../../interfaces/IModel';


const db = connect();

export const defaultLimit = 0; // By default 0 for the limit, can be changed by admin
export const minimumLimit = 0; // Minimum value for the limit

export const minimumDelay = 0 /// Minimum value for delay
export const maximumDelay = 5 * 60 * 1000 /// Maximum value of 5 minutes
export const defaultDelay = 30 * 1000 /// By default 30 seconds

export interface IVocalConfig extends IModel {
    enabled: boolean;
    listenerBlacklist: { roles: Snowflake[], users: Snowflake[] };
    channelBlacklist: Snowflake[];
    defaultLimit?: number;
    delay?: number;
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
    delay: { type: Number, required: false, default: () => defaultDelay },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalConfig>('VocalConfig', VocalConfigSchema);
