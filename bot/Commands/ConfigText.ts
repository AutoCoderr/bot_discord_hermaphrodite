import {
    CommandInteractionOptionResolver, Guild,
    GuildMember, TextChannel, User
} from "discord.js";
import ConfigTextAndVocal from "./ConfigTextAndVocal";

export default class ConfigText extends ConfigTextAndVocal {
    static display = true;
    static description = "Pour configurer l'option d'abonnement textuel";
    static commandName = "configText";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract = false;

    static argsModel = ConfigTextAndVocal.argsModelFunction('text')

    constructor(channel: TextChannel, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, ConfigText.commandName, ConfigText.argsModel, 'text');
    }
}
