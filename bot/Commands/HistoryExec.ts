import Command from "../Classes/Command";

export class HistoryExec extends Command {
    static commandName = "historyExec";

    static async action(message, bot) {
        message.channel.send("Je suis la command historyExec!");

        return true;
    }
}