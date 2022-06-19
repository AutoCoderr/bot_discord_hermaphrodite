import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import {defaultLimit} from "./VocalConfig";
import {Snowflake} from "discord.js";

const db = connect();

export interface IVocalUserConfig {
    userId: string;
    serverId: string;
    blocked: { users: Snowflake[], roles: Snowflake[] };
    listening: boolean;
    limit: number;
    mutedFor?: number;
    lastMute?: Date
}

const BlockedSchema: Schema = new Schema({
    users: { type: Array, required: true },
    roles: { type: Array, required: true }
}, { _id: false });

const VocalUserConfigSchema: Schema = new Schema({
    userId: { type: String, required: true },
    serverId: { type: String, required: true },
    blocked: { type: BlockedSchema, required: true },
    listening: { type: Boolean, required: true },
    limit: { type: Number, required: true, default: defaultLimit },
    mutedFor: { type: Number, required: false },
    lastMute: { type: Date, required: false }
});

// @ts-ignore
export default db.model<IVocalUserConfig>('VocalUserConfig', VocalUserConfigSchema);
