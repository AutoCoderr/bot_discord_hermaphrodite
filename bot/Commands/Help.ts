import Command from "../Classes/Command";
import { existingCommands } from "../Classes/CommandsDescription";
import * as Discord from "discord.js";
import config from "../config";
import {Message} from "discord.js";

export default class Help extends Command {

    static commandName = "help";

    constructor(message: Message) {
        super(message, Help.commandName);
    }

    async action(_,bot) {
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Toutes les commandes')
            .setDescription("Liste de toutes les commandes :")
            .setTimestamp()
        let allowedCommands: Array<string> = [];
        for (let commandName in existingCommands) {
            const command = existingCommands[commandName];
            if (command.display && await command.staticCheckPermissions(this.message, false)) {
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
                const command = existingCommands[commandName];
                Embed.addFields({
                    name: config.command_prefix+command.commandName+" :",
                    value: command.description+"\n"+config.command_prefix+command.commandName+" -h"
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