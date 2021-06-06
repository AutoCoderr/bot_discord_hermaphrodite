import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

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

// Export the model and return your IUser interface
// @ts-ignore
export default db.model<IWelcomeMessage>('WelcomeMessage', WelcomeMessageSchema);