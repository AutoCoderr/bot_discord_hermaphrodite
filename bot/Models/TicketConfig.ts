import { Schema, Document } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface ITicketConfig {
    enabled: boolean;
    categoryId: string
    serverId: string;
}

const TicketConfigSchema: Schema = new Schema({
    enabled: { type: Boolean, required: true },
    categoryId: { type: String, required: true },
    serverId: { type: String, required: true }
});

// Export the model and return your IUser interface
// @ts-ignore
export default db.model<ITicketConfig>('TicketConfig', TicketConfigSchema);