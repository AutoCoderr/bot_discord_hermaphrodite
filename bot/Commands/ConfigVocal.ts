import {
    CommandInteraction,
    CommandInteractionOptionResolver, Guild,
    GuildMember, Message, TextChannel, User
} from "discord.js";
import ConfigTextAndVocal from "./ConfigTextAndVocal";
import {IArgsModel} from "../interfaces/CommandInterfaces";

export default class ConfigVocal extends ConfigTextAndVocal {
    static display = true;
    static description = "Pour configurer l'option d'abonnement vocal";
    static commandName = "configVocal";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract = false;

    static argsModel: IArgsModel = ConfigTextAndVocal.argsModelFunction('vocal')

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ConfigVocal.commandName, ConfigVocal.argsModel, 'vocal');
    }
}
