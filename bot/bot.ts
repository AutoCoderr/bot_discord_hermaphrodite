import config from "./config";

import * as Discord from "discord.js";

import HelloWorld from "./Commands/HelloWorld";
import NotifyOnReact from "./Commands/NotifyOnReact";



const bot = new Discord.Client();

const commands = [ HelloWorld, NotifyOnReact ];

// check all commands
bot.on('message', message => {
    for (let command of commands) {
        if (command.match(message)) {
            command.action(message, bot);
        }
    }
});

bot.login(config.token);

// @ts-ignore
String.prototype.replaceAll = function (A,B) {
    let str = this.valueOf();
    while (str.replace(A,B) != str) {
        str = str.replace(A,B);
    }
    return str;
}