import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IMonitoringMessage {
    serverId: string;
    datas: Array<string|{data: string,params: any}>;
    channelId: string,
    messageId: string
}

const MonitoringMessageSchema: Schema = new Schema({
    serverId: { type: String, required: true},
    datas: { type: Array, required: true },
    channelId: { type: String, required: true},
    messageId: { type: String, required: true}
});

// @ts-ignore
export default db.model<IEmote>('MonitoringMessage', MonitoringMessageSchema);