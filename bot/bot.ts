import config from "./config";

import { existingCommands } from "./Classes/CommandsDescription";
import PMToNews, {IPMToNews} from "./Models/PMToNews";

import * as Discord from "discord.js";




const bot = new Discord.Client();

// check all commands
bot.on('message', async message => {
    for (let commandName in existingCommands) {
        const command = existingCommands[commandName].commandClass;
        command.check(message, bot);
    }

    if (message.type == "GUILD_MEMBER_JOIN") { // @ts-ignore
        const pmToNews: IPMToNews = await PMToNews.findOne({serverId: message.guild.id, enabled: true});
        if (pmToNews != null) {
            message.author.send(pmToNews.message);
        }
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