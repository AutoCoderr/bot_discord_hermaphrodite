import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface ITicketConfig {
    enabled: boolean;
    categoryId: string|null;
    blacklist: Array<string>;
    messagesToListen: Array<{channelId: string, messageId: string, emoteName: string}>
    serverId: string;
}

const messageToListen: Schema = new Schema({
    channelId: {type: String, required: true},
    messageId: {type: String, required: true},
    emoteName: {type: String, required: true}
})

const TicketConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    categoryId: { type: String, required: true },
    blacklist: { type: Array, required: true },
    messagesToListen: [messageToListen],
    serverId: { type: String, required: true }
});

// Export the model and return your IUser interface
// @ts-ignore
export default db.model<ITicketConfig>('TicketConfig', TicketConfigSchema);
