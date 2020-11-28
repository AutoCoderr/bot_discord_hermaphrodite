import Command from "../Classes/Command";
import { existingCommands } from "../Classes/CommandsDescription";
import * as Discord from "discord.js";
import config from "../config";

export class Help extends Command {
    static commandName = "help";

    static async action(message,bot) {
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Toutes les commandes')
            .setDescription("Liste de toutes les commandes :")
            .setTimestamp()
        let allowedCommands: Array<string> = [];
        for (let commandName in existingCommands) {
            if (existingCommands[commandName].display && await existingCommands[commandName].commandClass.checkPermissions(message,false)) {
                allowedCommands.push(commandName);
            }
        }
        if (allowedCommands.length == 0) {
            Embed.addFields({
                name: "Aucune commande",
                value: "On dirait que vous n'avez accès à aucune commande"
            });
        } else {
            for (let commandName of allowedCommands) {
                Embed.addFields({
                    name: config.command_prefix+commandName+" :",
                    value: existingCommands[commandName].msg
                });
            }
        }
        message.channel.send(Embed);
        return true;
    }

    static async saveHistory(message) {} // overload saveHistory of Command class to save nothing in the history

    static async checkPermissions(message, displayMsg) { // overload checkPermission of Command class to permit all users to execute the help command
        return true;
    }
}