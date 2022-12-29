import {IArgsModel} from "../interfaces/CommandInterfaces";
import {ActionRowBuilder, CommandInteraction, EmbedBuilder, Guild, GuildMember, Message, Role, ButtonBuilder, ButtonStyle} from "discord.js";
import AbstractXP from "./AbstractXP";
import {IXPData} from "../Models/XP/XPData";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";
import {detectUpgradeAndLevel} from "../libs/XP/XPCounting/countingOtherFunctions";
import {resetUsers, warningNothingRoleCanBeAssignedMessage, warningSpecificRolesCantBeAssignedMessage, getUserInfos} from "../libs/XP/XPOtherFunctions";
import { addCallbackButton } from "../libs/callbackButtons";

interface IXPAArgs {
    action: 'set'|'give'|'reset'|'reset_all'|'info';
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
                    reset_all: "Réinitialiser les XP de tout les membres",
                    info: "Voir les informations d'un utilisateur"
                }
            },
            member: {
                referToSubCommands: ['set','give','reset','info'],
                type: "user",
                description: "Mentionnez un membre",
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
        await detectUpgradeAndLevel(args.member, XPUserConfig, XPServerConfig, args.XP_to_set, true);

        return this.responseXPSet(XPUserConfig);
    }

    async action_give(args: IXPAArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        const XPToSet = Math.max(0, XPUserConfig.XP + args.XP_to_give)

        await detectUpgradeAndLevel(args.member, XPUserConfig, XPServerConfig, XPToSet, true);

        return this.responseXPSet(XPUserConfig);
    }

    async action_reset(args: IXPAArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        await detectUpgradeAndLevel(args.member, XPUserConfig, XPServerConfig, 0, true);

        return this.responseXPSet(XPUserConfig);
    }

    async action_reset_all(args: IXPAArgs, XPServerConfig: IXPData) {

        const acceptButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "reset_all_XPs_accept";
        const denyButtonId = (Date.now() * 10 ** 4 + Math.floor(Math.random() * 10 ** 4)).toString() + "reset_all_XPs_deny";

        addCallbackButton(acceptButtonId, async () => {
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
        }, [denyButtonId], {command: this.commandName, commandArguments: args});

        addCallbackButton(denyButtonId, () => {
            return this.response(true, "Opération annulée")
        }, [acceptButtonId]);

        //@ts-ignore
        return this.response(true, {
            content: "Voulez vous vraiment réinitialiser les XPs de tout les utilisateurs ?",
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

    async action_info(args: IXPAArgs, XPServerConfig: IXPData, XPUserConfig: IXPUserData) {
        const {XP, todayXP, currentLevel, grade, rang} = await getUserInfos(XPServerConfig, XPUserConfig);

        return this.response(true, {
            embeds: [
                    new EmbedBuilder()
                        .setTitle("Toutes les informations de "+(args.member.nickname??args.member.user.username))
                        .setFields({
                            name: "Voici toutes les informations "+(args.member.nickname??args.member.user.username)+" :",
                            value:
                                "Il/elle a "+XP+" XP au total\n"+
                                "Il/elle a gagné(e) "+todayXP+" XP aujourd'hui\n"+
                                "Il/elle est au palier "+currentLevel+"\n"+
                                (grade ? "Il/elle est au grade '"+grade.name+"'" : "Il/elle n'est dans encore aucun grade")+"\n"+
                                "Il/elle est au rang #"+rang
                        })
            ]
        })
    }
}