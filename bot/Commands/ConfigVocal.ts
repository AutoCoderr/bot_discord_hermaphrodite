import {
    CommandInteraction, EmbedBuilder, Guild, Message
} from "discord.js";
import AbstractConfigTextAndVocal, { IConfigTextAndVocalArgs } from "./AbstractConfigTextAndVocal";
import {IArgsModel} from "../interfaces/CommandInterfaces";
import { IVocalConfig, defaultDelay } from "../Models/Vocal/VocalConfig";
import { extractUTCTime, showTime } from "../Classes/DateTimeManager";
import Command from "../Classes/Command";
import StatsConfig, { IStatsConfig } from "../Models/Stats/StatsConfig";
import { IStatsPrecisionUnits, statsPrecisionExists } from "../libs/StatsCounters";

type IConfigVocalArgs = Omit<IConfigTextAndVocalArgs, 'action'> & {
    action: IConfigTextAndVocalArgs['action'] | 'delay' | 'stats';
    statsSubAction: 'enable'|'disable'|'is_enabled'|'export';
    statstime: {unit: IStatsPrecisionUnits, value: number}
    precision?: IStatsPrecisionUnits;
}

export default class ConfigVocal extends AbstractConfigTextAndVocal<IConfigVocalArgs> {
    static display = true;
    static description = "Pour configurer l'option d'abonnement vocal";
    static commandName = "configVocal";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract = false;

    static argsModel: IArgsModel<IConfigVocalArgs> = AbstractConfigTextAndVocal.argsModelFunction<IConfigVocalArgs>('vocal', {
        action: (argModel) => ({
            ...argModel,
            description: argModel.description+", delay, stats",
            choices: {
                ...argModel.choices,
                delay: "Définir ou voir le délai avant envoie de la notification vocale",
                stats: "le comptage des statistiques vocales"
            }
        }),
        duration: (argModel) => ({
            ...argModel,
            referToSubCommands: [...(<string[]>argModel.referToSubCommands), "delay"]
        })
    }, {
        statsSubAction: {
            referToSubCommands: ["stats"],
            isSubCommand: true,
            required: (args) => args.action === "stats",
            type: "string",
            description: "Activer ou désactiver",
            choices: {
                enable: (_, parentDescription) => "Activer "+parentDescription,
                disable: (_, parentDescription) => "Désactiver "+parentDescription,
                is_enabled: (_, parentDescription) => "Voir si "+parentDescription+" est activé ou non",
                export: "Exporter les statistiques vocales"
            }
        },
        statstime: {
            referToSubCommands: ["stats.export"],
            type: "timeUnits",
            description: "Jusqu'à combiens de temps (ex: 7j, 2mon) en arrière ?",
            valid: ({unit}) => statsPrecisionExists(unit),
            errorMessage: () => ({
                name: "Donnée invalide",
                value: "Vous ne pouvez mentionner comme unité de temps que des heures (h), jours (j,d), mois (month,mon), ou années (a,y).\n"+
                        "Contrairement aux durées, vous ne pouvez mentionner qu'une seule unité, comme 7j ou 2h, mais pas plusieurs à la fois, comme 7j2h"
            }),
            required: true
        },
        precision: {
            referToSubCommands: ["stats.export"],
            type: "string",
            description: "Choisissez un niveau de précision",
            required: false,
            choices: {
                hour: "Heure",
                day: "Jour",
                month: "Mois",
                year: "Année"
            }
        }
    })

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ConfigVocal.commandName, ConfigVocal.argsModel, 'vocal');
    }

    async action(args) {
        const res = await this.mutualizedAction(args, (args, configObj) => 
            !["delay","stats"].includes(args.action) &&
            (configObj === null || !configObj.enabled)
        );

        if (res.executed)
            return <ReturnType<Command['response']>>res.response;

        const {action, duration, statsSubAction, precision, statstime} = args;
        const configVocal = <IVocalConfig>res.configObj;

        if (action === "delay") {
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

        const statsConfig: null|IStatsConfig = await StatsConfig.findOne({
            serverId: (<Guild>this.guild).id
        })

        // action is stats

        if (statsSubAction === "is_enabled") {
            const enabled = statsConfig !== null && statsConfig.listenVocal;
            return this.response(true, {
                embeds: [
                    new EmbedBuilder().addFields({
                        name: "Statistiques vocales "+(enabled ? "actives" : "inactives"),
                        value:"Les statistiques vocales sont "+(enabled ? "activées" : "desactivées")
                    })
                ]
            })
        }
        
        if (["enable","disable"].includes(action)) {
            if (statsConfig === null) {
                await StatsConfig.create({
                    serverId: (<Guild>this.guild).id,
                    listenVocal: statsSubAction === "enable"
                })
            } else {
                statsConfig.listenVocal = statsSubAction === "enable";
                await statsConfig.save()
            }

            return this.response(true, {
                embeds: [
                    new EmbedBuilder().addFields({
                        name: "Statistique vocales "+(statsSubAction === "enable" ? "activées" : "désactivées"),
                        value: "Les statistique vocales ont été "+(statsSubAction === "enable" ? "activées" : "désactivées")
                    })
                ]
            })
        }

        
        //sub action is export

        console.log({statsSubAction, precision, statstime})

        return this.response(true, "BANANE");
    }
}
