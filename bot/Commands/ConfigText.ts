import {
    CommandInteraction,
    Message
} from "discord.js";
import AbstractConfigTextAndVocal from "./AbstractConfigTextAndVocal";
import {IArgsModel} from "../interfaces/CommandInterfaces";

export default class ConfigText extends AbstractConfigTextAndVocal {
    static display = true;
    static description = "Pour configurer l'option d'abonnement textuel";
    static commandName = "configText";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract = false;

    static argsModel: IArgsModel = AbstractConfigTextAndVocal.argsModelFunction('text')

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ConfigText.commandName, ConfigText.argsModel, 'text');
    }
}
