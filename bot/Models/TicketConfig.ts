import { Schema } from 'mongoose';
import { connect } from "../Mongo";
import {Snowflake} from "discord.js";

const db = connect();

export interface ITicketConfig {
    _id?: string;
    enabled: boolean;
    categoryId: null|Snowflake;
    moderatorId?: null|Snowflake;
    blacklist: Array<Snowflake>;
    messagesToListen?: Array<{_id?: string, channelId: Snowflake, messageId: Snowflake, emoteName?: string, emoteId?: Snowflake}>;
    ticketChannels?: Array<{_id?: string, channelId: Snowflake, userId: Snowflake}>;
    serverId: Snowflake;
}

const ticketChannel: Schema = new Schema({
    channelId: {type: String, required: true},
    userId: {type: String, required: true},
});

const messageToListen: Schema = new Schema({
    channelId: {type: String, required: true},
    messageId: {type: String, required: true},
    emoteName: {type: String, required: false},
    emoteId: {type: String, required: false}
})

const TicketConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    categoryId: { type: String },
    moderatorId: { type: String },
    blacklist: { type: Array, required: true },
    messagesToListen: [messageToListen],
    ticketChannels: [ticketChannel],
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<ITicketConfig>('TicketConfig', TicketConfigSchema);
