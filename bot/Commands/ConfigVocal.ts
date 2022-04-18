import {
    CommandInteractionOptionResolver, Guild,
    GuildMember, TextBasedChannels, User
} from "discord.js";
import ConfigTextAndVocal from "./ConfigTextAndVocal";

export default class ConfigVocal extends ConfigTextAndVocal {
    static display = true;
    static description = "Pour configurer l'option d'abonnement vocal";
    static commandName = "configVocal";

    static abstract = false;

    static slashCommand = true;

    static argsModel = ConfigTextAndVocal.argsModelFunction('vocal')

    constructor(channel: TextBasedChannels, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: string) {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, ConfigVocal.commandName, ConfigVocal.argsModel, 'vocal');
    }
}
