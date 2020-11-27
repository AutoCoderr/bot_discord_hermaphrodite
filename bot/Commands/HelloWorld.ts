import config from "../config";
import Command from "../Classes/Command";

export default class HelloWorld extends Command {

    static match(message) {
        return message.content.split(" ")[0] == config.command_prefix+"hello";
    }

    static async action(message, bot) {
        message.channel.send("COUCOU TOI!! <:yoyo:776047408533471252>")
        return true;
    }

    static async checkPermissions(message) { // overload checkPermission of Command class to permit all users to execute the hello command
        return true;
    }

    static async saveHistory(message) {} // overload saveHistory of Command class to save nothing in the history
}