import {IArgsModel} from "../interfaces/CommandInterfaces";
import {CommandInteraction, EmbedBuilder, Guild, GuildMember, Message} from "discord.js";
import AbstractXP from "./AbstractXP";
import {IXPData} from "../Models/XP/XPData";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";

interface IXPAArgs {
    action: 'set'|'give'|'reset'|'show';
    XP_to_set: number;
    XP_to_give: number;
    member: GuildMember;
}

export default class XPA extends AbstractXP<IXPAArgs> {
    static display = true;
    static description = "Commande utilitaire du système d'XP dédiée aux admins"
    static commandName = "XPA";
    static abstract = false;

    static customCommand = false

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel: IArgsModel<IXPAArgs> = {
        $argsByType: {
            action: {
                isSubCommand: true,
                type: "string",
                description: "L'action à effectuer",
                choices: {
                    set: "Définir les XP d'un membre",
                    give: "Donner (ou retirer avec une valeur < 0) des XP à un membre",
                    reset: "Remettre les XP d'un membre à 0"
                }
            },
            member: {
                referToSubCommands: ['set','give','reset'],
                type: "user",
                description: "Mentionnez un membez",
                evenCheckAndExtractForSlash: true,
                valid: async (member: GuildMember, _, command: XPA) => {
                    const XPServerConfig = await command.getXPServerConfig({enabled: true});

                    return (
                        XPServerConfig === null ||
                        (member.roles.cache.some(role => role.id === XPServerConfig.activeRoleId))
                    )
                },
                errorMessage: () => ({
                    name: "Utilisateur inaccessible",
                    value: "Cet utilisateur semble ne pas avoir accès au système d'XP"
                })
            },
            XP_to_give: {
                referToSubCommands: ['give'],
                type: "integer",
                evenCheckAndExtractForSlash: true,
                description: "Rentrez des XP",
                errorMessage: () => ({
                    name: "Valeur incorrecte",
                    value: "Vous devez rentrer un entier relatif"
                })
            },
            XP_to_set: {
                referToSubCommands: ['set'],
                type: "positiveInteger",
                evenCheckAndExtractForSlash: true,
                description: "Rentrez des XP",
                errorMessage: () => ({
                    name: "Valeur incorrecte",
                    value: "Vous devez rentrer un entier naturel"
                })
            }
        },
    }

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, XPA.commandName, XPA.argsModel);
    }

    async action(args: IXPAArgs, bot) {
        const XPServerConfig: null|IXPData = await this.getXPServerConfig({enabled: true});

        if (XPServerConfig === null)
            return this.response(false, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Fonctionalité désactivée")
                        .setFields({
                            name: "Système d'XP désactivé",
                            value: "Vous ne pouvez pas utiliser cette commande avec le système d'XP désactivé"
                        })
                ]
            })

        const XPUserConfig: IXPUserData = await this.getXPUserConfig(args.member)
            .then(XPUserConfig => XPUserConfig ?? XPUserData.create({
                userId: args.member.id,
                serverId: (<Guild>this.guild).id
            }))

        return this['action_'+args.action](args, XPServerConfig, XPUserConfig)
    }

    responseXPSet(XPUserConfig: IXPUserData) {
        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("XP défini")
                    .setFields({
                        name: "XP défini",
                        value: "Les XP de <@"+XPUserConfig.userId+"> ont été défini à "+XPUserConfig.XP
                    })
            ]
        })
    }

    async action_set(args: IXPAArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        XPUserConfig.todayXP = Math.max(0, XPUserConfig.todayXP + (args.XP_to_set - XPUserConfig.XP))
        XPUserConfig.XP = args.XP_to_set;

        await XPUserConfig.save();

        return this.responseXPSet(XPUserConfig);
    }

    async action_give(args: IXPAArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        XPUserConfig.todayXP = Math.max(0, XPUserConfig.todayXP + args.XP_to_give);
        XPUserConfig.XP = Math.max(0, XPUserConfig.XP + args.XP_to_give);

        await XPUserConfig.save();

        return this.responseXPSet(XPUserConfig);
    }

    async action_reset(args: IXPAArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        XPUserConfig.todayXP = 0;
        XPUserConfig.XP = 0;

        await XPUserConfig.save();

        return this.responseXPSet(XPUserConfig);
    }
}