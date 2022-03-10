"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Mongo_1 = require("../../Mongo");
const db = (0, Mongo_1.connect)();
const VocalAskInviteBackSchema = new mongoose_1.Schema({
    buttonId: { type: String, required: true },
    requesterId: { type: String, required: true },
    requestedId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    serverId: { type: String, required: true }
});
// @ts-ignore
exports.default = db.model('VocalAskInviteBack', VocalAskInviteBackSchema);
