import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from '../../interfaces/IModel';


const db = connect();

export interface IVocalStats extends IModel {
    serverId: string;
    date: Date;
    nbVocalConnections: number;
    nbMinutes: number;
}

const VocalStatsSchema: Schema = new Schema({
    serverId: { type: String, required: true },
    date: { type: Date, required: true },
    nbVocalConnections: { type: Number, required: false, default: 0 },
    nbMinutes: { type: Number, required: false, default: 0 }
});

// @ts-ignore
export default db.model<IVocalStats>('VocalStats', VocalStatsSchema);