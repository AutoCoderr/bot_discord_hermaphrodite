import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from '../../interfaces/IModel';


const db = connect();

export interface IVocalNewConnectionsStats extends IModel {
    serverId: string;
    date: Date;
    nbVocalNewConnections: number;
}

const VocalNewConnectionsStatsSchema: Schema = new Schema({
    serverId: { type: String, required: true },
    date: { type: Date, required: true },
    nbVocalNewConnections: { type: Number, required: false, default: 0 }
});

// @ts-ignore
export default db.model<IVocalNewConnectionsStats>('VocalNewConnectionsStats', VocalNewConnectionsStatsSchema);
