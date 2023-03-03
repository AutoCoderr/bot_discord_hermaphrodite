import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from '../../interfaces/IModel';


const db = connect();

export const defaultStatsExpiration = 90;
export const minStatsExpiration = 30;
export const maxStatsExpiration = 180;

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
    vocalExpiration: { type: Number, required: false, default: defaultStatsExpiration },

    listenMessages: { type: Boolean, required: false, default: false },
    messagesExpiration: { type: Number, required: false, default: defaultStatsExpiration },
});

// @ts-ignore
export default db.model<IStatsConfig>('StatsConfig', StatsConfigSchema);
