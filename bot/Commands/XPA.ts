import {IArgsModel} from "../interfaces/CommandInterfaces";
import {CommandInteraction, EmbedBuilder, Guild, GuildMember, Message, Role} from "discord.js";
import AbstractXP from "./AbstractXP";
import {IXPData} from "../Models/XP/XPData";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";
import {detectUpgradeAndLevel} from "../libs/XP/XPCounting/countingOtherFunctions";
import {resetUsers, warningNothingRoleCanBeAssignedMessage, warningSpecificRolesCantBeAssignedMessage} from "../libs/XP/XPOtherFunctions";

interface IXPAArgs {
    action: 'set'|'give'|'reset'|'reset_all'|'show';
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
                    reset: "Remettre les XP d'un membre à 0",
                    reset_all: "Réinitialiser les XP de tout les membres"
                }
            },
            member: {
                referToSubCommands: ['set','give','reset'],
                type: "user",
                description: "Mentionnez un membe",
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

        await detectUpgradeAndLevel(args.member, XPUserConfig, XPServerConfig, true);

        return this.responseXPSet(XPUserConfig);
    }

    async action_give(args: IXPAArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        XPUserConfig.todayXP = Math.max(0, XPUserConfig.todayXP + args.XP_to_give);
        XPUserConfig.XP = Math.max(0, XPUserConfig.XP + args.XP_to_give);

        await detectUpgradeAndLevel(args.member, XPUserConfig, XPServerConfig, true);

        return this.responseXPSet(XPUserConfig);
    }

    async action_reset(args: IXPAArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        XPUserConfig.todayXP = 0;
        XPUserConfig.XP = 0;

        await detectUpgradeAndLevel(args.member, XPUserConfig, XPServerConfig, true);

        return this.responseXPSet(XPUserConfig);
    }

    async action_reset_all(_: IXPAArgs, XPServerConfig: IXPData) {
        const gradesById = XPServerConfig.grades.reduce((acc,grade) => ({
            ...acc,
            [<string>grade._id]: grade
        }), {})

        const warningNothingRoleCanBeAssignedEmbed = warningNothingRoleCanBeAssignedMessage(<Guild>this.guild)

        const {field: warningNonAssignableRolesEmbed, cantBeAssignedRoles} = warningNothingRoleCanBeAssignedEmbed === null ? 
            warningSpecificRolesCantBeAssignedMessage(<Guild>this.guild,
                <Role[]>XPServerConfig.grades
                    .map(({roleId}) => (<Guild>this.guild).roles.cache.get(roleId))
                    .filter(role => role !== undefined) 
            ) : 
            {field: null, cantBeAssignedRoles: []};

        const nonManageableRoles: {[roleId: string]: false} = warningNothingRoleCanBeAssignedEmbed === null ? 
            cantBeAssignedRoles.reduce((acc,role) => ({
                ...acc,
                [role.id]: false
            }), {}) : 
            {};

        const XPUsersConfig: IXPUserData[] = await XPUserData.find({
            serverId: XPServerConfig.serverId,
        })

        await resetUsers(<Guild>this.guild, XPUsersConfig, gradesById, warningNothingRoleCanBeAssignedEmbed === null, nonManageableRoles, true);

        const embed = new EmbedBuilder()
                .setTitle("Utilisateurs réinitialisés")
                .setFields({
                    name: "Utilisateurs réinitialisés",
                    value: "Tout les utilisaters ont été réinitialisés avec succès!"
                })
        
        if (warningNonAssignableRolesEmbed)
            embed.addFields(warningNonAssignableRolesEmbed)
        if (warningNothingRoleCanBeAssignedEmbed)
            embed.addFields(warningNothingRoleCanBeAssignedEmbed)
        
        return this.response(true, {
            embeds: [
                embed        
            ]
        })
    }
}