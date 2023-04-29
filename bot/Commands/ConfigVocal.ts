import {
    CommandInteraction, EmbedBuilder, Guild, Message, PermissionFlagsBits
} from "discord.js";
import AbstractConfigTextAndVocal, { IConfigTextAndVocalArgs } from "./AbstractConfigTextAndVocal";
import {IArgsModel} from "../interfaces/CommandInterfaces";
import { IVocalConfig, defaultDelay, maximumDelay, minimumDelay } from "../Models/Vocal/VocalConfig";
import { extractDurationTime, extractUTCTime, showTime } from "../Classes/DateTimeManager";
import Command from "../Classes/Command";
import StatsConfig, { IStatsConfig } from "../Models/Stats/StatsConfig";
import { IStatsPrecisionUnits, statsPrecisionExists } from "../libs/stats/statsCounters";

type IConfigVocalArgs = Omit<IConfigTextAndVocalArgs, 'action'> & {
    action: IConfigTextAndVocalArgs['action'] | 'delay';
}

export default class ConfigVocal extends AbstractConfigTextAndVocal<IConfigVocalArgs> {
    static display = true;
    static description = "Pour configurer l'option d'abonnement vocal";
    static commandName = "vocalConfig";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static defaultMemberPermission = PermissionFlagsBits.Administrator;

    static abstract = false;

    static argsModel: IArgsModel<IConfigVocalArgs> = AbstractConfigTextAndVocal.argsModelFunction<IConfigVocalArgs>('vocal', {
        action: (argModel) => ({
            ...argModel,
            description: argModel.description+", delay",
            choices: {
                ...argModel.choices,
                delay: "Définir ou voir le délai avant envoie de la notification vocale",
            }
        }),
        duration: (argModel) => ({
            ...argModel,
            referToSubCommands: [...(<string[]>argModel.referToSubCommands), "delay"],
            description: (args) => args.action === "delay" ? "Définir le délai avant notification" : <string>argModel.description,
            valid: (value: number, args, _, __) =>
                (args.action === "delay" && value >= minimumDelay && value <= maximumDelay) ||
                (argModel.valid !== undefined && argModel.valid(value, args, _, __)),
            errorMessage: (value, args, _) => typeof(value) === "number" && args.action === "delay" ? {
                name: "Vous avez mal rentrez la durée",
                value: "Le délai doit être situé entre "+[minimumDelay,maximumDelay].map(d => showTime(extractDurationTime(d), 'fr_long')).join(' et ')+" inclus"                            
            } : (argModel.errorMessage !== undefined ? argModel.errorMessage(value, args, _) : {name: "", value: ""}),
        })
    })

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ConfigVocal.commandName, ConfigVocal.argsModel, 'vocal');
    }

    async action(args) {
        const res = await this.mutualizedAction(args);

        if (res.executed)
            return <ReturnType<Command['response']>>res.response;

        const {action, duration, statsSubAction, precision, statstime} = args;
        const configVocal = <IVocalConfig>res.configObj;

        if (duration !== undefined) {
            configVocal.delay = duration;
            await configVocal.save();
            return this.response(true, {
                embeds: [
                    new EmbedBuilder().addFields({
                        name: "Valeur changée avec succès!",
                        value: "Vous avez fixé le délai d'attente avant notification vocale à " + showTime(extractUTCTime(duration), "fr_long")
                    })
                ]
            })
        }
    
        return this.response(true, {
            embeds: [
                new EmbedBuilder().addFields({
                    name: "Voici le délai d'attente avant notification vocale",
                    value: "Le délai est : " +showTime(extractUTCTime((<IVocalConfig>configVocal).delay ?? defaultDelay), "fr_long")
                })
            ]
        })
    }
}
