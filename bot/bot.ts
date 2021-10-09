import config from "./config";

import { existingCommands } from "./Classes/CommandsDescription";
import WelcomeMessage, {IWelcomeMessage} from "./Models/WelcomeMessage";
import client from "./client";

import init from "./init";


// check all commands
client.on('message', async message => {
    for (let commandName in existingCommands) {
        const commandClass = existingCommands[commandName];
        const command = new commandClass(message);
        command.check(client);
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
