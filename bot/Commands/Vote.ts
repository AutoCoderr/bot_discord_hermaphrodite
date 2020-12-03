import config from "../config";
import Command from "../Classes/Command";

export class Vote extends Command {
    static commandName = "vote";

    static async action(message, bot) {
        console.log(message.content);
        let args = this.parseCommand(message);
        if (!args) return false;
        
        message.delete();
        message.channel.send("COUCOU TOI!! <:yoyo:776047408533471252>");
        return true;
    }
}
