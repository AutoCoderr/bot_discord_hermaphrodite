import { Schema, Document } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface INotifyOnReactMessage extends Document {
    messgaeToListenId: string,
    channelToListenId: string,
    EmoteToReact: string,
    channelToWriteId: string,
    messageToWrite: string,
    serverId: string
}

const NotifyOnReactMessage: Schema = new Schema({
    messgaeToListenId: { type: String, required: true},
    channelToListenId: { type: String, required: true},
    EmoteToReact: { type: String, required: true},
    channelToWriteId: { type: String, required: true},
    messageToWrite: { type: String, required: true},
    serverId: { type: String, required: true}
});

// Export the model and return your IUser interface
// @ts-ignore
export default db.model<INotifyOnReactMessage>('Emote', NotifyOnReactMessage);