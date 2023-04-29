import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export const minimumStoredNotifyMessageSize = 2;
export const maximumStoredNotifyMessageSize = 2000;

export interface IStoredNotifyOnReact {
    emoteName?: string;
    emoteId?: string;
    channelToListenId: string;
    messageToListenId: string;
    messageToWrite: string;
    channelToWriteId: string;
    serverId: string;
}

const StoredNotifyOnReactSchema: Schema = new Schema({
    emoteName: { type: String, required: false },
    emoteId: { type: String, required: false },
    channelToListenId: { type: String, required: true },
    messageToListenId: { type: String, required: true},
    messageToWrite: { type: String, required: true},
    channelToWriteId: { type: String, required: true},
    serverId: { type: String, required: true}
});

// @ts-ignore
export default db.model<IStoredNotifyOnReact>('StoredNotifyOnReact', StoredNotifyOnReactSchema);
