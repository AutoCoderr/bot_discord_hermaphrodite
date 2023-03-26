import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export const minimumWelcomeMessageSize = 2;
export const maximumWelcomeMessageSize = 1970;

export interface IWelcomeMessage {
    enabled: boolean;
    message: string
    serverId: string;
}

const WelcomeMessageSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    message: { type: String, required: true },
    serverId: { type: String, required: true}
});

// @ts-ignore
export default db.model<IWelcomeMessage>('WelcomeMessage', WelcomeMessageSchema);