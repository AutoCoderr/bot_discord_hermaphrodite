import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface ITextSubscribe {
    listenerId: string;
    listenedId: string;
    channelId?: string
    keywords?: string[];
    enabled: boolean;
    timestamp: Date;
    serverId: string;
}

const TextSubscribeSchema: Schema = new Schema({
    listenerId: { type: String, required: true },
    listenedId: { type: String, required: true },
    channelId: { type: String, required: false },
    keywords: { type: Array, required: false },
    enabled: { type: Boolean, required: true, default: true },
    timestamp: { type: Date, required: true, default: () => new Date() },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<ITextSubscribe>('TextSubscribe', TextSubscribeSchema);
