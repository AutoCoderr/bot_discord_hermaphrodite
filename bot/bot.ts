import config from "./config";

import { existingCommands } from "./Classes/CommandsDescription";
import StoredNotifyOnReact, { IStoredNotifyOnReact } from "./Models/StoredNotifyOnReact";

import * as Discord from "discord.js";




const bot = new Discord.Client();

// check all commands
bot.on('message', message => {
    for (let commandName in existingCommands) {
        const command = existingCommands[commandName].commandClass;
        command.check(message, bot);
    }
});

bot.login(config.token);

setTimeout(() => { // Detect stored notifyOnReacts storeds in the database and apply them
    existingCommands.notifyOnReact.commandClass.applyNotifyOnReactAtStarting(bot);
}, 5000);

// @ts-ignore
String.prototype.replaceAll = function (A,B) {
    let str = this.valueOf();
    while (str.replace(A,B) != str) {
        str = str.replace(A,B);
    }
    return str;
}