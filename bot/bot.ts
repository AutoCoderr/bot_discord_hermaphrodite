import config from "./config";

import { existingCommands } from "./Classes/CommandsDescription";
import WelcomeMessage, {IWelcomeMessage} from "./Models/WelcomeMessage";

import * as Discord from "discord.js";
import init from "./init";




const bot = new Discord.Client();

// check all commands
bot.on('message', async message => {
    //console.log(message.content)
    for (let commandName in existingCommands) {
        const command = existingCommands[commandName].commandClass;
        command.check(message, bot);
    }

    if (!message.author.bot) {

        if (message.type == "GUILD_MEMBER_JOIN") { // @ts-ignore
            const welcomeMessage: IWelcomeMessage = await WelcomeMessage.findOne({serverId: message.guild.id, enabled: true});
            if (welcomeMessage != null) {
                try {
                    await message.author.send(welcomeMessage.message);
                } catch (e) {
                    if (e.message == "Cannot send messages to this user") {
                        message.channel.send("<@"+message.author.id+"> \n\n"+welcomeMessage.message);
                    }
                }
            }
        }
    }
});

bot.login(config.token);

init(bot);


// @ts-ignore
String.prototype.replaceAll = function (A,B) {
    let str = this.valueOf();
    while (str.replace(A,B) != str) {
        str = str.replace(A,B);
    }
    return str;
}
