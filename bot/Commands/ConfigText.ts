import {
    CommandInteraction,
    CommandInteractionOptionResolver, Guild,
    GuildMember, Message, TextChannel, User
} from "discord.js";
import ConfigTextAndVocal from "./ConfigTextAndVocal";
import {IArgsModel} from "../interfaces/CommandInterfaces";

export default class ConfigText extends ConfigTextAndVocal {
    static display = true;
    static description = "Pour configurer l'option d'abonnement textuel";
    static commandName = "configText";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract = false;

    static argsModel: IArgsModel = ConfigTextAndVocal.argsModelFunction('text')

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ConfigText.commandName, ConfigText.argsModel, 'text');
    }
}
