import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IVocalSubscribe {
    channelId: string;
    listenerId: string;
    listenedId: string;
    serverId: string;
    lastEventDate: number;
}

const VocalSubscribeSchema: Schema = new Schema({
    channelId: { type: String, required: true },
    listenerId: { type: String, required: true },
    listenedId: { type: String, required: true },
    serverId: { type: String, required: true },
    lastEventDate: { type: Number, required: true }
});

// @ts-ignore
export default db.model<IVocalSubscribe>('VocalSubscribe', VocalSubscribeSchema);