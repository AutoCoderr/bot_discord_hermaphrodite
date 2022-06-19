import Command from "../Classes/Command";
import { existingCommands } from "../Classes/CommandsDescription";
import * as Discord from "discord.js";
import config from "../config";
import {
    CommandInteractionOptionResolver,
    Guild,
    GuildMember,
    TextChannel,
    User
} from "discord.js";

export default class Help extends Command {

    static commandName = "help";

    static description = "Afficher l'aide de toutes les commandes";

    constructor(channel: TextChannel, member: User|GuildMember, guild: null|Guild = null, writtenCommandOrSlashCommandOptions: null|string|CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, Help.commandName, Help.argsModel);
    }

    async action() {
        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Toutes les commandes')
            .setDescription("Liste de toutes les commandes :")
            .setTimestamp()
        let allowedCommands: Array<string> = [];
        for (let commandName in existingCommands) {
            const command = existingCommands[commandName];
            if (command.display && command.customCommand && await command.staticCheckPermissions(this.member, this.guild)) {
                allowedCommands.push(commandName);
            }
        }
        if (allowedCommands.length == 0) {
            Embed.addField(
                "Aucune commande",
                "On dirait que vous n'avez accès à aucune commande"
            );
        } else {
            for (let commandName of allowedCommands) {
                const command = existingCommands[commandName];
                Embed.addFields({
                    name: '/'+command.commandName.toLowerCase()+" :",
                    value: command.description+"\n/"+command.commandName.toLowerCase()+" -h"+(command.customCommand ? " (Aussi disponible via "+config.command_prefix+command.commandName+" -h)": "")
                });
                Embed.addField(
                    '/'+command.commandName.toLowerCase()+" :",
                    command.description+"\n/"+command.commandName.toLowerCase()+" -h"+(command.customCommand ? " (Aussi disponible via "+config.command_prefix+command.commandName+" -h)": "")
                );
            }
        }
        return this.response(true, {embeds: [Embed]});
    }

    async saveHistory() {} // overload saveHistory of Command class to save nothing in the history
}
