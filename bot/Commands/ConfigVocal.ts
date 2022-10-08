import {
    CommandInteractionOptionResolver, Guild,
    GuildMember, TextChannel, User
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

    constructor(channel: TextChannel, member: User | GuildMember, guild: null | Guild = null, writtenCommandOrSlashCommandOptions: null | string | CommandInteractionOptionResolver = null, commandOrigin: 'slash'|'custom') {
        super(channel, member, guild, writtenCommandOrSlashCommandOptions, commandOrigin, ConfigVocal.commandName, ConfigVocal.argsModel, 'vocal');
    }
}
