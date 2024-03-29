import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IEmote {
    userName: string;
    emoteName: string;
    dateTime: string;
    serverId: string;
}

const EmoteSchema: Schema = new Schema({
    userName: { type: String, required: true },
    emoteName: { type: String, required: true },
    dateTime: { type: String, required: true },
    serverId: { type: String, required: true}
});

// @ts-ignore
export default db.model<IEmote>('Emote', EmoteSchema);
