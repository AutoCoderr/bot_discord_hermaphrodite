import config from "./config";

import * as Discord from "discord.js";

import HelloWorld from "./Commands/HelloWorld";
import NotifyOnReact from "./Commands/NotifyOnReact";
import Perm from "./Commands/Perm";
import Help from "./Commands/Help";
import HistoryCmd from "./Commands/HistoryCmd";



const bot = new Discord.Client();

const commands = [ HelloWorld, NotifyOnReact, Perm, Help, HistoryCmd ];

// check all commands
bot.on('message', message => {
    for (let command of commands) {
        command.check(message, bot);
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