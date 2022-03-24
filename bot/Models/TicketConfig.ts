import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface ITicketConfig {
    _id?: string;
    enabled: boolean;
    categoryId: string|null;
    moderatorId?: string|null;
    blacklist: Array<string>;
    messagesToListen?: Array<{_id?: string, channelId: string, messageId: string, emoteName?: string, emoteId?: string}>;
    ticketChannels?: Array<{_id?: string, channelId: string, userId: string}>;
    serverId: string;
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
