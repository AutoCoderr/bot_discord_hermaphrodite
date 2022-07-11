import { Schema } from 'mongoose';
import { connect } from "../Mongo";
import {Snowflake} from "discord.js";

const db = connect();

export interface IHistory {
    commandName: string;
    command: string;
    dateTime: string;
    channelId: Snowflake;
    userId: Snowflake;
    serverId: Snowflake;
}

const HistorySchema: Schema = new Schema({
    commandName: { type: String, required: true},
    command: { type: String, required: true},
    dateTime: { type: String, required: true},
    channelId: { type: String, required: true},
    userId: { type: String, required: true},
    serverId: { type: String, required: true}
});

// @ts-ignore
export default db.model<IHistory>('History', HistorySchema);