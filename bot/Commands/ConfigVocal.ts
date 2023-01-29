import {
    CommandInteraction, Message
} from "discord.js";
import AbstractConfigTextAndVocal from "./AbstractConfigTextAndVocal";
import {IArgsModel} from "../interfaces/CommandInterfaces";

export default class ConfigVocal extends AbstractConfigTextAndVocal {
    static display = true;
    static description = "Pour configurer l'option d'abonnement vocal";
    static commandName = "configVocal";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract = false;

    static argsModel: IArgsModel = AbstractConfigTextAndVocal.argsModelFunction('vocal')

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ConfigVocal.commandName, ConfigVocal.argsModel, 'vocal');
    }
}
