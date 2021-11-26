import config from "./config";

import { existingCommands } from "./Classes/CommandsDescription";
import WelcomeMessage, {IWelcomeMessage} from "./Models/WelcomeMessage";
import client from "./client";

import init from "./init";


// check all commands
client.on('messageCreate', async message => {
    for (let commandName in existingCommands) {
        const commandClass = existingCommands[commandName];
        if (commandClass.customCommand) {
            const command = new commandClass(message.channel, message.member, message.guild, message.content);
            command.executeCustomCommand(client).then(result => {
                if (result !== false) {
                    for (const payload of result)
                        message.channel.send(payload);
                }
            });
        }
    }

    if (!message.author.bot) {

        if (message.type == "GUILD_MEMBER_JOIN") { // @ts-ignore
            const welcomeMessage: IWelcomeMessage = await WelcomeMessage.findOne({serverId: message.guild.id, enabled: true});
            if (welcomeMessage != null) {
                try {
                    await message.author.send(welcomeMessage.message);
                } catch (e) {// @ts-ignore
                    if (e.message == "Cannot send messages to this user") {
                        message.channel.send("<@"+message.author.id+"> \n\n"+welcomeMessage.message);
                    }
                }
            }
        }
    }
});

client.login(config.token);

init(client);


// @ts-ignore
String.prototype.replaceAll = function (A,B) {
    let str = this.valueOf();
    while (str.replace(A,B) != str) {
        str = str.replace(A,B);
    }
    return str;
}
