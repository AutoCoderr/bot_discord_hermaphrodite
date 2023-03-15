import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, Guild, Interaction, Message, MessagePayload } from "discord.js";
import Command from "../Classes/Command";
import { IArgsModel } from "../interfaces/CommandInterfaces";
import StatsConfig, { defaultStatsExpiration, IStatsConfig, maxStatsExpiration, minStatsExpiration } from "../Models/Stats/StatsConfig";
import { abortProcess } from "../libs/subProcessManager";
import {IStatsPrecisionUnits, statsPrecisionExists, getStatsUnitIndex, getAllStatsUnitTexts, getStatsUnitText, getDateWithPrecision} from "../libs/stats/statsCounters";
import exportStatsInCsv, { getDateTag } from "../libs/stats/exportStatsInCsv";
import { incrementUnitToDate } from "../Classes/OtherFunctions";
import { addCallbackButton } from "../libs/callbackButtons";
import clearExpiredDatas from "../libs/stats/clearExpiredDatas";
import purgeDatas from "../libs/stats/purgesDatas";

interface IStatsArgs {
    action: 'messages'|'vocal';
    subAction: 'enable'|'disable'|'are_enabled'|'export'|'purge'|'expiration';
    backTime: {unit: IStatsPrecisionUnits, value: number};
    afterOrBefore?: 'after'|'before';
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
                    purge: (_,parentDescription) => "Purger "+parentDescription,
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
            afterOrBefore: {
                referToSubCommands: ["messages.export", "vocal.export", "messages.purge", "vocal.purge"],
                required: false,
                description: "Avant ou après le temps indiqué ?",
                type: "string",
                choices: {
                    after: "Après",
                    before: "Avant"
                },
            },
            backTime: {
                referToSubCommands: ["messages.export", "vocal.export", "messages.purge", "vocal.purge"],
                description: (args) => "Combien de temps en arrière "+(args.subAction === "export" ? "exporter" : "purger")+" les statistiques (ex: 6h, 3j, 2mon) ?",
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
        const {action, subAction, nbDays, afterOrBefore, backTime} = args

        const statsConfig: null|IStatsConfig = await StatsConfig.findOne({
            serverId: (<Guild>this.guild).id
        })

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
                    ["vocalMinutes","vocalConnections","vocalNewConnections"]
                        .map(type => clearExpiredDatas(<'vocalMinutes'|'vocalConnections'|'vocalNewConnections'>type, (<Guild>this.guild).id))
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

        if (subAction === "purge") {
            const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "purge_"+action+"_stats_accept";
            const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "purge_"+action+"_stats_deny";

            const specifiedDate = incrementUnitToDate(getDateWithPrecision(), backTime.unit, -backTime.value);

            addCallbackButton(acceptButtonId, async () => {
                await purgeDatas(action, specifiedDate, afterOrBefore ?? "after");

                return this.response(true, {
                    embeds: [
                        new EmbedBuilder()
                            .setFields({
                                name: "Données purgées avec succès !",
                                value: "Toutes les statisitiques "+(action === "vocal" ? "vocales" : "textuelles")+
                                       " "+(afterOrBefore === "before" ? "avant" : "depuis")+" le "+getDateTag(specifiedDate, "hour")+
                                       " ont été purgées avec succès !"
                            })
                    ]
                })
            }, [denyButtonId]);

            addCallbackButton(denyButtonId, () => {
                return this.response(true, "Opération annulée")
            }, [acceptButtonId]);

            //@ts-ignore
            return this.response(true, {
                content: "Voulez-vous vraiment purger les statistiques "+(action === "vocal" ? "vocales" : "textuelles")+
                         " "+(afterOrBefore === "before" ? "avant" : "depuis")+" le "+getDateTag(specifiedDate, "hour")+" ?",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            (<[string,boolean][]>[
                                [acceptButtonId, true],
                                [denyButtonId, false]
                            ]).map(([buttonId, accept]) =>
                                new ButtonBuilder()
                                    .setCustomId(buttonId)
                                    .setLabel(accept ? "Oui" : "Non")
                                    .setStyle(accept ? ButtonStyle.Danger : ButtonStyle.Success)
                            )
                        )
                ]
            })
        }

        // subAction is 'export'

        const precision = args.precision ?? "hour";

        const specifiedDate = incrementUnitToDate(getDateWithPrecision(new Date(), precision), backTime.unit, -backTime.value)

        const messagePayload = new MessagePayload(<Interaction|Message>(this.interaction??this.message), {
            content: "Voici l'export en csv de toutes les stats "+(action === "vocal" ? "vocales" : "textuelles")+
                     (afterOrBefore === "before" ? " avant" : " depuis")+" le "+getDateTag(specifiedDate, precision)+" "+{
                        hour: "à l'heure",
                        day: 'à la journée',
                        month: 'au mois'
                     }[precision]+" près :"
        });
        messagePayload.files = [{
            name: "stats.csv",
            data: "wesh"//(await exportStatsInCsv(<Guild>this.guild, specifiedDate, afterOrBefore??"after", action, precision)).all
        }]
        return this.response(true, messagePayload)
    }
}