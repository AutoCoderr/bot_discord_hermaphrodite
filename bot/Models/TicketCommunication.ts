import { Schema, Document } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface ITicketCommunication extends Document {
    serverId: string;
    ticketChannelId: string|null;
    DMChannelId: string;
    usedByUser: boolean;
    latestUtilisation: number;
}

const TicketCommunicationSchema: Schema = new Schema({
    serverId: { type: String, required: true },
    ticketChannelId: { type: String, required: true },
    DMChannelId: { type: String, required: true},
    usedByUser: { type: Boolean, required: true},
    latestUtilisation: { type: Number, required: true}
});

// Export the model and return your IUser interface
// @ts-ignore
export default db.model<ITicketCommunication>('TicketCommunication', TicketCommunicationSchema);