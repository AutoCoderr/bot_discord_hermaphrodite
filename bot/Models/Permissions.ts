import { Schema } from 'mongoose';
import { connect } from "../Mongo";

const db = connect();

export interface IPermissions {
    command: string;
    roles: Array<string>;
    serverId: string;
}

const PermissionSchema: Schema = new Schema({
    command: { type: String, required: true },
    roles: { type: Array, required: true },
    serverId: { type: String, required: true}
});

// Export the model and return your IUser interface
// @ts-ignore
export default db.model<IPermissions>('Permissions', PermissionSchema);