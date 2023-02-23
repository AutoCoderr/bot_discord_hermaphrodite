import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from '../../interfaces/IModel';


const db = connect();

export interface IStatsConfig extends IModel {
    serverId: string;

    listenVocal: boolean;
    vocalExpiration: number;

    listenMessages: boolean;
    messagesExpiration: number;
}

const StatsConfigSchema: Schema = new Schema({
    serverId: { type: String, required: true },

    listenVocal: { type: Boolean, required: false, default: false },
    vocalExpiration: { type: Number, required: false, default: 90 },

    listenMessages: { type: Boolean, required: false, default: false },
    messagesExpiration: { type: Number, required: false, default: 90 },
});

// @ts-ignore
export default db.model<IStatsConfig>('StatsConfig', StatsConfigSchema);
