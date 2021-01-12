import config from "./config";

import { existingCommands } from "./Classes/CommandsDescription";
import WelcomeMessage, {IWelcomeMessage} from "./Models/WelcomeMessage";

import * as Discord from "discord.js";
import {setUserInCache} from "./Classes/Cache";
import init from "./init";
import TicketConfig, {ITicketConfig} from "./Models/TicketConfig";




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
            }// @ts-ignore
            let ticketConfig: ITicketConfig = await TicketConfig.findOne({serverId: message.guild.id})
            if (ticketConfig == null) {
                ticketConfig = {
                    enabled: false,
                    categoryId: null,
                    blacklist: [],
                    whitelist: [message.author.id], // @ts-ignore
                    serverId: message.guild.id
                };
                TicketConfig.create(ticketConfig);
            } else if (!ticketConfig.whitelist.includes(message.author.id)) {
                ticketConfig.whitelist.push(message.author.id);// @ts-ignore
                ticketConfig.save();
            }
        }

        setUserInCache(message.author);
        for (const mentionArray of message.mentions.users) {
            const mentionnedUser = mentionArray[1];
            setUserInCache(mentionnedUser);
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
