import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from '../../interfaces/IModel';


const db = connect();

export interface IVocalMinutesStats extends IModel {
    serverId: string;
    date: Date;
    nbMinutes: number;
}

const VocalMinutesStatsSchema: Schema = new Schema({
    serverId: { type: String, required: true },
    date: { type: Date, required: true },
    nbMinutes: { type: Number, required: false, default: 0 }
});

// @ts-ignore
export default db.model<IVocalMinutesStats>('VocalMinutesStats', VocalMinutesStatsSchema);
