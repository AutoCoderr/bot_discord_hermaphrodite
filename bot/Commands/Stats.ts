import { CommandInteraction, EmbedBuilder, Guild, Message, ModalBuilder } from "discord.js";
import Command from "../Classes/Command"
import { IStatsPrecisionUnits, statsPrecisionExists } from "../libs/StatsCounters";
import { IArgsModel, responseResultsType, responseType } from "../interfaces/CommandInterfaces";
import StatsConfig, { IStatsConfig } from "../Models/Stats/StatsConfig";

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
            backTime: {
                referToSubCommands: ["messages.export", "vocal.export"],
                description: "Jusqu'à combien de temps en arrière récupérer les statistiques (ex: 3j, 2mon) ?",
                type: "timeUnits",
                valid: ({unit}) => statsPrecisionExists(unit),
                errorMessage: () => ({
                    name: "Donnée invalide",
                    value: "Vous ne pouvez mentionner comme unité de temps que des heures (h), jours (j,d), mois (month,mon), ou années (a,y).\n"+
                            "Contrairement aux durées, vous ne pouvez mentionner qu'une seule unité, comme 7j ou 2h, mais pas plusieurs à la fois, comme 7j2h"
                }),
            },
            precision: {
                referToSubCommands: ["messages.export", "vocal.export"],
                required: false,
                description: "A quel niveau de précision voulez vous exporer les statistiques ?",
                type: "string",
                choices: {
                    hour: "Heure",
                    day: "Jour",
                    month: "Mois",
                    year: "Année"
                }
            },
            nbDays: {
                referToSubCommands: ["messages.expiration", "vocal.expiration"],
                required: false,
                description: "Combiens de jours d'expiration ?",
                type: "integer"
            }
        }
    }

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, Stats.commandName, Stats.argsModel);
    }

    async action(args: IStatsArgs) {
        const {action, subAction} = args

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

            return this.response(true, {
                embeds: [
                    new EmbedBuilder().addFields({
                        name: "Statistique "+word+" "+(subAction === "enable" ? "activées" : "désactivées"),
                        value: "Les statistique "+word+" ont été "+(subAction === "enable" ? "activées" : "désactivées")
                    })
                ]
            })
        }

        console.log(args);

        return this.response(true, "COUCOU ICI !")
    }
}