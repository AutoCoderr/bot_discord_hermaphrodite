import { CommandInteraction, EmbedBuilder, Guild, Interaction, Message, MessagePayload } from "discord.js";
import Command from "../Classes/Command";
import { IArgsModel } from "../interfaces/CommandInterfaces";
import StatsConfig, { defaultStatsExpiration, IStatsConfig, maxStatsExpiration, minStatsExpiration } from "../Models/Stats/StatsConfig";
import { abortProcess } from "../libs/subProcessManager";
import {IStatsPrecisionUnits, statsPrecisionExists, clearExpiredDatas, getStatsUnitIndex, getAllStatsUnitTexts, getStatsUnitText, getDateWithPrecision} from "../libs/stats/statsCounters";
import exportStatsInCsv from "../libs/stats/exportStatsInCsv";
import { getDateGettersAndSettersFromUnit } from "../Classes/OtherFunctions";
import { showDate } from "../Classes/DateTimeManager";
import { extractDate } from "../Classes/DateTimeManager";

interface IStatsArgs {
    action: 'messages'|'vocal';
    subAction: 'enable'|'disable'|'are_enabled'|'export'|'expiration';
    backTime: {unit: IStatsPrecisionUnits, value: number};
    precision?: IStatsPrecisionUnits;
    nbDays?: number;
}

export default class Stats extends Command<IStatsArgs> {
    static display = true;
    static description = "Pour configurer les statistiques";
    static commandName = "Stats";

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static abstract = false;

    static argsModel: IArgsModel<IStatsArgs> = {
        $argsByType: {
            action: {
                isSubCommand: true,
                required: true,
                type: "string",
                description: "L'action à effectuer : messages, vocal",
                choices: {
                    messages: "les statistiques des messages",
                    vocal: "les statistiques vocales"
                }
            },
            subAction: {
                referToSubCommands: ["messages", "vocal"],
                isSubCommand: true,
                required: true,
                type: "string",
                description: "L'action à effectuer sur les messages ou le vocal : enable, disable, is_enabled, export, expiration",
                choices: {
                    enable: (_, parentDescription) => "Activer "+parentDescription,
                    disable: (_, parentDescription) => "Désactiver "+parentDescription,
                    are_enabled: (_, parentDescription) => "Voir si "+parentDescription+" sont activées",
                    export: (_, parentDescription) => "Exporter "+parentDescription,
                    expiration: (_, parentDescription) => "Définir l'expiration des"+parentDescription.split(" ").slice(1).join(" ")
                }
            },
            precision: {
                referToSubCommands: ["messages.export", "vocal.export"],
                required: false,
                description: "A quel niveau de précision voulez vous exporer les statistiques ?",
                type: "string",
                choices: getAllStatsUnitTexts()
            },
            backTime: {
                referToSubCommands: ["messages.export", "vocal.export"],
                description: "Jusqu'à combien de temps en arrière récupérer les statistiques (ex: 6h, 3j, 2mon) ?",
                type: "timeUnits",
                valid: ({unit}, args) => statsPrecisionExists(unit) && getStatsUnitIndex(unit) <= getStatsUnitIndex(args.precision ?? "hour"),
                errorMessage: ({unit},args) => ({
                    name: "Donnée invalide",
                    value: !statsPrecisionExists(unit) ? 
                            
                            "Vous ne pouvez mentionner comme unité de temps que des heures (h), jours (j,d), ou mois (month,mon).\n"+
                            "Contrairement aux durées, vous ne pouvez mentionner qu'une seule unité, comme 7j ou 2h, mais pas plusieurs à la fois, comme 7j2h" :
                            
                            "L'unité de temps utilisée pour savoir combiens de temps en arrière récupérer les statistiques ("+getStatsUnitText(unit)+"),\n"+
                            "ne peut pas être plus précise que le niveau de précision de l'export ("+getStatsUnitText(args.precision ?? "hour")+")"
                }),
            },
            nbDays: {
                referToSubCommands: ["messages.expiration", "vocal.expiration"],
                required: false,
                description: "Combiens de jours d'expiration ?",
                type: "integer",
                valid: (value) => value >= minStatsExpiration && value <= maxStatsExpiration,
                errorMessage: () => ({
                    name: "Nombre de jours invalide",
                    value: "Le nombre de jours d'expiration doit être compris entre "+minStatsExpiration+" et "+maxStatsExpiration+" inclus"
                })
            }
        }
    }

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, Stats.commandName, Stats.argsModel);
    }

    async action(args: IStatsArgs) {
        const {action, subAction, nbDays} = args

        const statsConfig: null|IStatsConfig = await StatsConfig.findOne({
            serverId: (<Guild>this.guild).id
        })

        // action is stats

        const enabledCol = action === "vocal" ? 'listenVocal' : 'listenMessages';
        const word = action === "vocal" ? 'vocales' : 'textuelles'

        if (subAction === "are_enabled") {
            const enabled = statsConfig !== null && statsConfig[enabledCol];
            return this.response(true, {
                embeds: [
                    new EmbedBuilder().addFields({
                        name: "Statistiques "+word+" "+(enabled ? "actives" : "inactives"),
                        value:"Les statistiques "+word+" sont "+(enabled ? "activées" : "desactivées")
                    })
                ]
            })
        }
        
        if (["enable","disable"].includes(subAction)) {
            if (statsConfig === null) {
                await StatsConfig.create({
                    serverId: (<Guild>this.guild).id,
                    [enabledCol]: subAction === "enable"
                })
            } else {
                statsConfig[enabledCol] = subAction === "enable";
                await statsConfig.save()
            }

            if (subAction === "disable") {
                abortProcess(action === "vocal" ? "vocalStats" : "messageStats", (<Guild>this.guild).id)
            }

            return this.response(true, {
                embeds: [
                    new EmbedBuilder().addFields({
                        name: "Statistique "+word+" "+(subAction === "enable" ? "activées" : "désactivées"),
                        value: "Les statistique "+word+" ont été "+(subAction === "enable" ? "activées" : "désactivées")
                    })
                ]
            })
        }

        if (subAction === "expiration") {
            const col = action === "messages" ? "messagesExpiration" : "vocalExpiration";

            if (nbDays === undefined) {
                return this.response(true, {
                    embeds: [
                        new EmbedBuilder()
                            .addFields({
                                name: "Expiration des statistiques "+(action === "vocal" ? "vocales" : "textuelles"),
                                value: "Il y a "+(statsConfig ? statsConfig[col] : defaultStatsExpiration)+" jours d'expiration concernant les statistiques "+(action === "vocal" ? "vocales" : "textuelles")
                            })
                    ]
                })
            }

            if (statsConfig === null) {
                await StatsConfig.create({
                    serverId: (<Guild>this.guild).id,
                    [col] : nbDays
                })
            } else {
                statsConfig[col] = nbDays;
                await statsConfig.save();
            }

            if (action === "messages")
                await clearExpiredDatas("messages", (<Guild>this.guild).id)
            else
                await Promise.all(
                    ["vocalMinutes","vocalConnections"]
                        .map(type => clearExpiredDatas(<'vocalMinutes'|'vocalConnections'>type, (<Guild>this.guild).id))
                )

            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .addFields({
                            name: "Expiration des statistiques "+(action === "vocal" ? "vocales" : "textuelles")+" définit à "+nbDays+" jours",
                            value: "L'expiration des statistiques "+(action === "vocal" ? "vocales" : "textuelles")+" a été définit à "+nbDays+" jours"
                        })
                ]
            })
        }

        // subAction is 'export'

        const precision = args.precision ?? "hour";
        const {backTime} = args;

        const dateWithPrecision = getDateWithPrecision(new Date(), precision);
        
        const [getter, setter] = getDateGettersAndSettersFromUnit(backTime.unit)

        dateWithPrecision[setter](dateWithPrecision[getter]() - backTime.value);

        const messagePayload = new MessagePayload(<Interaction|Message>(this.interaction??this.message), {
            content: "Voici l'export en csv de toutes les stats "+(action === "vocal" ? "vocales" : "textuelles")+
                     " depuis le "+showDate(extractDate(dateWithPrecision), 'fr')+" "+{
                        hour: "à l'heure",
                        day: 'à la journée',
                        month: 'au mois'
                     }[precision]+" près :"
        });
        messagePayload.files = [{
            name: "stats.csv",
            data: await exportStatsInCsv(<Guild>this.guild, dateWithPrecision, action, precision)
        }]
        return this.response(true, messagePayload)
    }
}