import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IStoredNotifyOnReact {
    emoteName: string;
    channelToListenId: string;
    messageToListenId: string;
    messageToWrite: string;
    channelToWriteId: string;
    serverId: string;
}

const StoredNotifyOnReactSchema: Schema = new Schema({
    emoteName: { type: String, required: true },
    channelToListenId: { type: String, required: true },
    messageToListenId: { type: String, required: true},
    messageToWrite: { type: String, required: true},
    channelToWriteId: { type: String, required: true},
    serverId: { type: String, required: true}
});

export default db.model<IStoredNotifyOnReact>('StoredNotifyOnReact', StoredNotifyOnReactSchema);