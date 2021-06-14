import Command from "../Classes/Command";
import { existingCommands } from "../Classes/CommandsDescription";
import * as Discord from "discord.js";
import config from "../config";
import {Message} from "discord.js";

export class Help extends Command {

    static staticCommandName = "help";

    constructor(message: Message) {
        super(message, Help.staticCommandName);
    }

    async action(_,bot) {
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Toutes les commandes')
            .setDescription("Liste de toutes les commandes :")
            .setTimestamp()
        let allowedCommands: Array<string> = [];
        for (let commandName in existingCommands) {
            if (existingCommands[commandName].display && await existingCommands[commandName].commandClass.staticCheckPermissions(this.message, false)) {
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
        this.message.channel.send(Embed);
        return true;
    }

    async saveHistory() {} // overload saveHistory of Command class to save nothing in the history

    async checkPermissions(displayMsg) { // overload checkPermission of Command class to permit all users to execute the help command
        return true;
    }

    static async staticCheckPermissions(message: Message, displayMsg, commandName) { // overload the staticCheckPermission of Command class to permit all users to execute the help command
        return true
    }
}