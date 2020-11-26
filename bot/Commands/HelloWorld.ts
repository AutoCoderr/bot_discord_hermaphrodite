import config from "../config";
import Command from "../Classes/Command";

export default class HelloWorld extends Command {

    static match(message) {
        return message.content.split(" ")[0] == config.command_prefix+"hello";
    }

    static action(message, bot) {
        message.channel.send("COUCOU TOI!! <:yoyo:776047408533471252>")
    }
}