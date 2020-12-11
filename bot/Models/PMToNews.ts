import { Schema, Document } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IPMToNews extends Document {
    enabled: boolean;
    message: string
    serverId: string;
}

const PMToNewsSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    message: { type: String, required: true },
    serverId: { type: String, required: true}
});

// Export the model and return your IUser interface
// @ts-ignore
export default db.model<IPMToNews>('PMToNews', PMToNewsSchema);