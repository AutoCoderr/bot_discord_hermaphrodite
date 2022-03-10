"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Mongo_1 = require("../../Mongo");
const db = (0, Mongo_1.connect)();
const ListenerBlacklistSchema = new mongoose_1.Schema({
    roles: { type: Array, required: true },
    users: { type: Array, required: true }
});
const VocalConfigSchema = new mongoose_1.Schema({
    enabled: { type: Boolean, required: true },
    listenerBlacklist: { type: ListenerBlacklistSchema, required: true },
    channelBlacklist: { type: Array, required: true },
    serverId: { type: String, required: true }
});
// @ts-ignore
exports.default = db.model('VocalConfig', VocalConfigSchema);
