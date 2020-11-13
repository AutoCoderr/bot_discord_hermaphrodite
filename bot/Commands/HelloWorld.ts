import config from "../config";
import * as Discord from "discord.js";

export default class HelloWorld {
    static match(message) {
        return message.content.startsWith(config.command_prefix+"hello");
    }

    static action(message, bot) {
        message.channel.send("COUCOU TOI!! <:yoyo:776047408533471252>")
    }
}