"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Mongo_1 = require("../../Mongo");
const db = (0, Mongo_1.connect)();
const VocalSubscribeSchema = new mongoose_1.Schema({
    listenerId: { type: String, required: true },
    listenedId: { type: String, required: true },
    enabled: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});
// @ts-ignore
exports.default = db.model('VocalSubscribe', VocalSubscribeSchema);
