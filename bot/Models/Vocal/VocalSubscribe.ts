import { Schema } from 'mongoose';
import { connect } from "../../Mongo";

const db = connect();

export interface IVocalSubscribe {
    listenerId: string;
    listenedId: string;
    enabled: boolean;
    timestamp?: Date;
    serverId: string;
}

const VocalSubscribeSchema: Schema = new Schema({
    listenerId: { type: String, required: true },
    listenedId: { type: String, required: true },
    enabled: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});

// @ts-ignore
export default db.model<IVocalSubscribe>('VocalSubscribe', VocalSubscribeSchema);
