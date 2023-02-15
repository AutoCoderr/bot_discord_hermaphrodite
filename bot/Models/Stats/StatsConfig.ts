import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from '../../interfaces/IModel';


const db = connect();

export interface IStatsConfig extends IModel {
    serverId: string;
    listenVocal: boolean;
}

const StatsConfigSchema: Schema = new Schema({
    serverId: { type: String, required: true },
    listenVocal: { type: Boolean, required: false, default: false }
});

// @ts-ignore
export default db.model<IStatsConfig>('StatsConfig', StatsConfigSchema);
