"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Mongo_1 = require("../../Mongo");
const db = (0, Mongo_1.connect)();
const BlockedSchema = new mongoose_1.Schema({
    users: { type: Array, required: true },
    roles: { type: Array, required: true }
});
const VocalUserConfigSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    serverId: { type: String, required: true },
    blocked: { type: BlockedSchema, required: true },
    listening: { type: Boolean, required: true },
    limit: { type: Number, required: true, default: 0 },
    mutedFor: { type: Number, required: false },
    lastMute: { type: Date, required: false }
});
// @ts-ignore
exports.default = db.model('VocalUserConfig', VocalUserConfigSchema);
