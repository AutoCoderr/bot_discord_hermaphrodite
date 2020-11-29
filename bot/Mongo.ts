import mongoose from "mongoose";
import config from "./config";

let nbRetry = 0;
const nbRetryMax = 20;

let database;

export const connect = () => {

    if (nbRetry >= nbRetryMax) {
        console.log("Connexion impossible");
        return;
    } else if (nbRetry > 0) {
        console.log("Re try to connect")
    }

    if (database) return database;

    const url = 'mongodb://' + config.username_mongo + ':' + config.password_mongo + '@' + config.host_mongo + ':27017/' + config.database_mongo;

    mongoose.connect(url, {useNewUrlParser: true});

    database = mongoose;

    database.connection.once("open", () => {
        console.log("Connected to database");
    });

    database.connection.on("error", () => {
        console.log("Error connecting to database");
        database = undefined;
        nbRetry += 1;
        setTimeout(connect, 250);
    });

    return database;
};

export const disconnect = () => {
    if (!database) return;
    mongoose.disconnect();
    return mongoose;
};
