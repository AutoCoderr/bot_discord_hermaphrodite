import Command from "../Classes/Command";
import { existingCommands } from "../Classes/CommandsDescription";
import config from "../config";
import {
    CommandInteraction,
    EmbedBuilder,Message,
} from "discord.js";

export default class Help extends Command {

    static commandName = "help";

    static description = "Afficher l'aide de toutes les commandes";

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, Help.commandName, Help.argsModel);
    }

    async action() {
        let Embed = new EmbedBuilder()
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
            Embed.addFields({
                name: "Aucune commande",
                value: "On dirait que vous n'avez accès à aucune commande"
            });
        } else {
            for (let commandName of allowedCommands) {
                const command = existingCommands[commandName];
                Embed.addFields({
                    name: '/' + command.commandName.toLowerCase() + " :",
                    value: command.description + "\n/" + command.commandName.toLowerCase() + " -h" + (command.customCommand ? " (Aussi disponible via " + config.command_prefix + command.commandName + " -h)" : "")
                });
            }
        }
        return this.response(true, {embeds: [Embed]});
    }

    async saveHistory() {} // overload saveHistory of Command class to save nothing in the history
}
