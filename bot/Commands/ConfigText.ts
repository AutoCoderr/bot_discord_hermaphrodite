import {
    CommandInteractionOptionResolver, Guild,
    GuildMember, TextBasedChannels, User
} from "discord.js";
import ConfigTextAndVocal from "./ConfigTextAndVocal";

export default class ConfigText extends ConfigTextAndVocal {
    static display = true;
    static description = "Pour configurer l'option d'abonnement textuel";
    static commandName = "configText";

    static abstract = false;

    static slashCommand = true;

    static argsModel = ConfigTextAndVocal.argsModelFunction('text')

    constructor(channel: TextBasedChannels, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, ConfigText.commandName, ConfigText.argsModel, 'text');
    }
}
