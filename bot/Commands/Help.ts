import Command from "../Classes/Command";
import { existingCommands } from "../Classes/CommandsDescription";
import * as Discord from "discord.js";
import config from "../config";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildMember,
    TextBasedChannels,
    User
} from "discord.js";

export default class Help extends Command {

    static commandName = "help";

    constructor(channel: TextBasedChannels, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: string) {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, Help.commandName, Help.argsModel);
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
            if (command.display && command.customCommand && await command.staticCheckPermissions(this, false)) {
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
        return this.response(true, {embeds: [Embed]});
    }

    async saveHistory() {} // overload saveHistory of Command class to save nothing in the history

    async checkPermissions(displayMsg = true) { // overload checkPermission of Command class to permit all users to execute the help command
        return true;
    }

    static async staticCheckPermissions(_: TextBasedChannels, __: User|GuildMember, ___: null|Guild = null, ____ = true, _____: string|null = null) { // overload the staticCheckPermission of Command class to permit all users to execute the help command
        return true
    }
}
