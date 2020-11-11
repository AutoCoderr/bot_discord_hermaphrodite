import mongoose from "mongoose";
// @ts-ignore
const config = require("./config");

let database: mongoose.Connection;

export const connect = () => {

    if (database) return;

    const url = 'mongodb://' + config.username_mongo + ':' + config.password_mongo + '@' + config.host_mongo + ':27017/' + config.database_mongo;

    mongoose.connect(url, {useNewUrlParser: true});

    database = mongoose.connection;

    database.once("open", () => {
        console.log("Connected to database");
    });

    database.on("error", () => {
        console.log("Error connecting to database");
    });

    return mongoose;
};

export const disconnect = () => {
    if (!database) return;
    mongoose.disconnect();
    return mongoose;
};