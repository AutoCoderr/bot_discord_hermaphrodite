import { Schema } from 'mongoose';
import { connect } from "../../Mongo";
import IModel from '../../interfaces/IModel';


const db = connect();

export const defaultStatsExpiration = 90;
export const minStatsExpiration = 30;
export const maxStatsExpiration = 180;

export interface IStatsActivePeriod {
    startDate: Date;
    endDate?: Date;
}

export interface IStatsConfig extends IModel {
    serverId: string;

    listenVocal: boolean;
    vocalExpiration: number;

    vocalActivePeriods: IStatsActivePeriod[];

    listenMessages: boolean;
    messagesExpiration: number;

    messagesActivePeriods: IStatsActivePeriod[];
}

const ActivePeriod: Schema = new Schema({
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: false }
})

const StatsConfigSchema: Schema = new Schema({
    serverId: { type: String, required: true },

    listenVocal: { type: Boolean, required: false, default: false },
    vocalExpiration: { type: Number, required: false, default: defaultStatsExpiration },

    vocalActivePeriods: [ActivePeriod],

    listenMessages: { type: Boolean, required: false, default: false },
    messagesExpiration: { type: Number, required: false, default: defaultStatsExpiration },

    messagesActivePeriods: [ActivePeriod]
});

// @ts-ignore
export default db.model<IStatsConfig>('StatsConfig', StatsConfigSchema);
