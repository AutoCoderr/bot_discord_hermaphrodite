import {IArgsModel} from "../interfaces/CommandInterfaces";
import {
    CommandInteraction,
    EmbedBuilder, EmbedField,
    Guild, Interaction,
    Message, MessagePayload,
    Role
} from "discord.js";
import XPData, {IGrade, ILevelTip, IXPData} from "../Models/XP/XPData";
import {extractUTCTime, showTime} from "../Classes/DateTimeManager";
import {
    calculRequiredXPForNextGrade,
    checkGradesListData, roleCanBeManaged,
} from "../libs/XP/XPOtherFunctions";
import client from "../client";
import AbstractXP from "./AbstractXP";
import {findTipByLevel, setTipByLevel} from "../libs/XP/tips/tipsManager";
import {checkTipsListData} from "../libs/XP/tips/tipsOtherFunctions";
import {showTip, showTipsList} from "../libs/XP/tips/tipsBrowsing";

interface IConfigXPArgs {
    action:
        'enable'|
        'disable'|
        'is_enabled'|
        'active_role'|
        'channel_role'|
        'first_message_time'|
        'xp_gain_show'|
        'xp_gain_set'|
        'limit_gain_set'|
        'tips'|
        'grades'|
        'timezone';
    setOrShowSubAction: 'set'|'show';
    XPActionTypes: 'vocal'|'message'|'first_message'|'bump';
    XPActionTypesToLimit: 'vocal'|'message';
    tipsSubActions: 'list'|'show'|'set'|'delete'|'export'|'import';
    gradesSubActions:
        'add'|
        'list'|
        'delete'|
        'insert'|
        'set_level'|
        'set_name'|
        'set_xp'|
        'set_xp_by_level'|
        'set_role'|
        'export'|
        'import';
    role: Role;
    duration: number;
    XP?: number;
    XPByLevel: number;
    level?: number;
    name: string;
    gradeNumber: number;
    jsonFile: any;
    timezone: number;
}

export default class ConfigXP extends AbstractXP<IConfigXPArgs> {
    static display = true;
    static abstract = false;
    static description = "Configurer le système d'XP"
    static commandName = "configXP";

    static customCommand = false

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    static argsModel: IArgsModel<IConfigXPArgs> = {
        $argsByType: {
            action: {
                isSubCommand: true,
                type: "string",
                description: "Ce que vous souhaitez configurer",
                choices: {
                    is_enabled: "Vérifier si le système d'XP est activé ou non sur ce serveur",
                    enable: "Activer le système d'XP",
                    disable: "Désactiver le système d'XP",
                    active_role: "le rôle actif du système d'XP",
                    channel_role: "le rôle d'accès aux channels du système d'XP",
                    first_message_time: "l'heure minimale du premier message de la journée",
                    xp_gain_show: "Afficher les gains d'XP par type",
                    xp_gain_set: "Définir le taux d'XP",
                    limit_gain_set: "Définir la limite de gain d'XP",
                    grades: null,
                    tips: null,
                    timezone: "le créneau horaire"
                }
            },
            setOrShowSubAction: {
                referToSubCommands: ['active_role','channel_role', 'first_message_time', 'timezone'],
                isSubCommand: true,
                type: "string",
                description: "Quelle type d'action effectuer ?",
                choices: {
                    set: (_, parentDescription) => "Définir "+parentDescription,
                    show: (_, parentDescription) => "Visionner "+parentDescription
                }
            },
            XPActionTypes: {
                referToSubCommands: ['xp_gain_set'],
                isSubCommand: true,
                type: "string",
                description: "Quel type de gain d'XP ?",
                choices: {
                    message: (_, parentDescription) => parentDescription+" par message",
                    vocal: (_, parentDescription) => parentDescription+" pour le vocal",
                    first_message: (_, parentDescription) => parentDescription+" pour le premier message de la journée",
                    bump: (_, parentDescription) => parentDescription+" par bump"
                }
            },
            XPActionTypesToLimit: {
                referToSubCommands: ['limit_gain_set'],
                isSubCommand: true,
                type: "string",
                description: "Quel type de gain d'XP ?",
                choices: {
                    message: (_, parentDescription) => parentDescription+" par message",
                    vocal: (_, parentDescription) => parentDescription+" pour le vocal",
                }
            },
            tipsSubActions: {
                referToSubCommands: ['tips'],
                isSubCommand: true,
                type: "string",
                description: "Quel type d'action sur les tips?",
                choices: {
                    show: "Afficher un tips",
                    set: "Définir un tips",
                    delete: "Supprimer un tips",
                    list: "Lister les tips",
                    export: "Exporter les tips dans un fichier json",
                    import: "Importer les tips à partir d'un fichier json"
                }
            },
            gradesSubActions: {
                referToSubCommands: ['grades'],
                isSubCommand: true,
                type: "string",
                description: "Quel type d'action sur les grades",
                choices: {
                    add: "Ajouter un grade",
                    list: "Lister les grades",
                    delete: "Supprimer un grade",
                    insert: "Insérer un nouveau grade",
                    set_level: "Définir le premier niveau d'un grade existant",
                    set_name: "Définir le nom d'un grade existant",
                    set_xp: "Définir les XPs de départ d'un grade existant",
                    set_xp_by_level: "Définir le nombre d'XP par palier, d'un grade existant",
                    set_role: "Définir le role d'un grade existant",
                    export: "Exporter les grades dans un fichier json",
                    import: "Importer les grades à partir d'un fichier json"
                }
            },
            gradeNumber: {
                referToSubCommands: ['delete','insert','set_level','set_name','set_xp','set_role','set_xp_by_level'].map(t => 'grades.'+t),
                type: "overZeroInteger",
                evenCheckAndExtractForSlash: true,
                description: "Le numéro du grade",
                valid: async (value, args, command: ConfigXP) => {
                    const XPServerConfig = await command.getXPServerConfig();

                    const nbGrades = XPServerConfig === null ? 0 : XPServerConfig.grades.length;

                    return value <= nbGrades + (args.gradesSubActions === "insert" ? 1 : 0) &&
                        (args.gradesSubActions !== "insert" || nbGrades === 0 || value > 1) &&
                        (
                            !['set_level','set_xp'].includes(<string>args.gradesSubActions) ||
                            (args.gradesSubActions === "set_level" && value > 1) ||
                            (args.gradesSubActions === "set_xp" && value === 1)
                        )
                },
                errorMessage: (value, args) => {
                    if (value === undefined)
                        return {
                            name: "Donnée manquante",
                            value: "Vous devez spécifier le numéro de grade"
                        }

                    if (value <= 0)
                        return {
                            name: "Donnée invalide",
                            value: "Le numéro de grade doit être un entier naturel (> 0)"
                        }

                    if (args.gradesSubActions === "insert")
                        return {
                            name: "Position de grade inaccessible",
                            value: "Vous ne pouvez pas insérer de grade à la position "+value
                        }

                    if (args.gradesSubActions === "set_level" && value === 1)
                        return {
                            name: "Redéfinition du niveau impossible",
                            value: "Vous ne pouvez pas redéfinir le niveau du premier grade"
                        }

                    if (args.gradesSubActions === "set_xp" && value > 1)
                        return {
                            name: "Redéfinition des XP impossible",
                            value: "Vous ne pouvez redéfinir que les XP du premier grade"
                        }

                    return {
                        name: "Grade inexistant",
                        value: "Le grade "+value+" n'existe pas"
                    }
                }
            },
            level: {
                referToSubCommands: ['tips.show', 'tips.delete', 'tips.set','grades.add','grades.insert','grades.set_level'],
                type: "overZeroInteger",
                evenCheckAndExtractForSlash: true,
                description: "Rentrez une valeur",
                required: async (args, command: null|ConfigXP) => {
                    if (args.action !== "grades" || args.gradesSubActions === "set_level")
                        return true;

                    if (command === null)
                        return false;

                    const XPServerConfig = await command.getXPServerConfig();

                    return (
                        (
                            args.gradesSubActions === "add" &&
                            XPServerConfig !== null && XPServerConfig.grades.length > 0
                        ) ||
                        (
                            args.gradesSubActions === "insert" &&
                            args.gradeNumber !== undefined &&
                            args.gradeNumber > 1
                        )
                    );
                },
                valid: async (value, args, command: ConfigXP, validatedArgs) => {
                    if (
                        command.guild === null ||
                        (args.action === "grades" && ["insert","set_level"].includes(<string>args.gradesSubActions) && !validatedArgs.gradeNumber)
                    )
                        return true;

                    const XPServerConfig = await command.getXPServerConfig();

                    return (
                        (
                            args.action === "tips" &&
                            (
                                args.tipsSubActions === "set" ||
                                (
                                    XPServerConfig !== null &&
                                    findTipByLevel(value, XPServerConfig.tipsByLevel) !== null
                                )
                            )
                        )
                            ||
                        (
                            args.action === "grades" && args.gradesSubActions === "insert" &&
                            (
                                (args.gradeNumber === 1 && value === 1) ||
                                (
                                    XPServerConfig !== null &&
                                    XPServerConfig.grades.length > 0 &&
                                    <number>args.gradeNumber > 1 &&
                                    value > XPServerConfig.grades[<number>args.gradeNumber-2].atLevel &&
                                    (
                                        args.gradeNumber === XPServerConfig.grades.length+1 ||
                                        value < XPServerConfig.grades[<number>args.gradeNumber-1].atLevel
                                    )
                                )
                            )
                        )
                            ||
                        (
                            args.action === "grades" && args.gradesSubActions === "add" &&
                            (
                                ((XPServerConfig === null || XPServerConfig.grades.length === 0) && value === 1) ||
                                (XPServerConfig !== null && XPServerConfig.grades.length > 0 && value > XPServerConfig.grades[XPServerConfig.grades.length-1].atLevel)
                            )
                        )
                            ||
                        (
                            args.action === "grades" && args.gradesSubActions === "set_level" &&
                            (
                                XPServerConfig === null ||
                                (
                                    value > XPServerConfig.grades[<number>args.gradeNumber-2].atLevel &&
                                    (
                                        args.gradeNumber === XPServerConfig.grades.length ||
                                        value < XPServerConfig.grades[<number>args.gradeNumber].atLevel
                                    )
                                )
                            )
                        )
                    )
                },
                errorMessage: async (value, args, command: ConfigXP) => {
                    if (value === undefined)
                        return {
                            name: "Donnée manquante",
                            value: "Vous devez spécifier le niveau"
                        }

                    if (value <= 0)
                        return {
                            name: "Donnée invalide",
                            value: "Le niveau doit être un entier naturel (> 0)"
                        }

                    if (args.action === "tips")
                        return {
                            name: "Tip introuvable",
                            value: "Aucun tip associé au niveau "+value+" n'a été trouvé"
                        }

                    const XPServerConfig = await command.getXPServerConfig();

                    return {
                        name: "Donnée invalide",
                        value:
                            (
                                value !== 1 &&
                                (
                                    (
                                        args.gradesSubActions === "add" &&
                                        (XPServerConfig === null || XPServerConfig.grades.length === 0)
                                    ) ||
                                    (
                                        args.gradesSubActions === "insert" &&
                                        args.gradeNumber === 1
                                    )
                                )
                            ) ?

                            "Le premier niveau du premier grade doit forcément être le niveau 1"
                                :
                            "Le niveau mentionné doit être strictement supérieur au premier niveau du grade précedent" + (
                                    (
                                        args.gradeNumber !== undefined &&
                                        XPServerConfig !== null &&
                                        (
                                            (args.gradesSubActions === "insert" && args.gradeNumber <= XPServerConfig.grades.length) ||
                                            (args.gradesSubActions === "set_level" && args.gradeNumber < XPServerConfig.grades.length)
                                        )
                                    ) ? " et strictement inférieur au premier niveau du grade suivant" : ""
                            )
                    }
                }
            },
            XP: {
                referToSubCommands: [...['message', 'vocal', 'first_message', 'bump'].map(t => 'xp_gain_set.'+t), 'grades.add', 'grades.insert', 'grades.set_xp'],
                type: "overZeroInteger",
                evenCheckAndExtractForSlash: true,
                description: (args) => (args.action === "grades" && ["add","insert","set_xp"].includes(<string>args.gradesSubActions)) ?
                    "Le nombre d'XP nécessaire pour atteindre ce grade" :
                    "Rentrez une valeur",
                required: async (args, command: null|ConfigXP) => {
                    if (args.action !== "grades" ||
                        (args.gradesSubActions !== "add" && args.gradesSubActions !== "insert")
                    )
                        return true

                    if (command === null || command.guild === null)
                        return false;

                    const XPServerConfig: null|IXPData = await command.getXPServerConfig();

                    return (
                        (
                            args.gradesSubActions === "add" &&
                            (XPServerConfig === null || XPServerConfig.grades.length === 0)
                        ) ||
                        (
                            args.gradesSubActions === "insert" &&
                            args.gradeNumber === 1
                        )
                    )
                },
                valid: async (value, args, command: ConfigXP, validatedArgs) => {
                    if (
                        args.action !== "grades" ||
                        command.guild === null ||
                        !["insert","add"].includes(<string>args.gradesSubActions) ||
                        !validatedArgs.level ||
                        (args.gradesSubActions === "insert" && !validatedArgs.gradeNumber)
                    )
                        return true;

                    const XPServerConfig = await command.getXPServerConfig();

                    return XPServerConfig === null ||
                        XPServerConfig.grades.length === 0 ||
                        (
                            (
                                args.gradesSubActions === "add" &&
                                calculRequiredXPForNextGrade(XPServerConfig.grades, <number>args.level) === value
                            ) ||
                            (
                                args.gradesSubActions === "insert" &&
                                calculRequiredXPForNextGrade(XPServerConfig.grades, <number>args.level, <number>args.gradeNumber-2) === value
                            )
                        )
                },
                errorMessage: (value, args) =>
                    value === undefined ?
                        {
                            name: "Donnée manquante",
                            value: "Vous devez spécifier des XPs"
                        } :
                        (value <= 0 || args.action !== "grades" || (!["add","insert"].includes(<string>args.gradesSubActions))) ?
                            {
                                name: "Donnée invalide",
                                value: "Le nombre d'XP doit être un entier naturel (> 0)"
                            } :
                            {
                                name: "Donnée invalide",
                                value: "Il semblerait que le niveau d'XP mentionné nécessaire à ce grade ne corresponde pas à la configuration des grades précedents.\n"+
                                    "Vous pouvez laisser ce champs vide, il sera automatiquement calculé"
                            }
            },
            name: {
                referToSubCommands: ['grades.add','grades.insert','grades.set_name'],
                type: "string",
                description: "Nom du grade"
            },
            XPByLevel: {
                referToSubCommands: ['grades.add', 'grades.insert','grades.set_xp_by_level'],
                type: "overZeroInteger",
                evenCheckAndExtractForSlash: true,
                description: "Le nombre d'XP nécessaire pour augmenter de niveau",
                errorMessage: (value) =>
                    value === undefined ?
                        {
                            name: "Donnée manquante",
                            value: "Vous devez spécifier le nombre d'XP par niveau"
                        } :
                        {
                            name: "Donnée invalide",
                            value: "Le nombre d'XP doit être un entier naturel (> 0)"
                        }
            },
            role: {
                referToSubCommands: ['active_role.set', 'channel_role.set', 'grades.add','grades.insert','grades.set_role'],
                type: "role",
                description: "Quel rôle définir"
            },
            duration: {
                referToSubCommands: ['first_message_time.set','limit_gain_set.message','limit_gain_set.vocal'],
                type: "duration",
                description: "Donnez une durée (ex: 7h, 6h30, etc...)"
            },
            jsonFile: {
                referToSubCommands: ['grades.import','tips.import'],
                type: "jsonFile",
                description: "Le fichier json à importer",
                evenCheckAndExtractForSlash: true
            },
            timezone: {
                referToSubCommands: ['timezone.set'],
                type: "timezone",
                description: "Le créneau horaire à renseigner (Ex: 1, UTC+1, 2, UTC+2, -3, UTC-3)",
                evenCheckAndExtractForSlash: true
            }
        }
    }

    constructor(messageOrInteraction: Message|CommandInteraction, commandOrigin: 'slash'|'custom') {
        super(messageOrInteraction, commandOrigin, ConfigXP.commandName, ConfigXP.argsModel);
    }

    async action(args: IConfigXPArgs, bot) {
        if (this.guild === null) {
            return this.response(false,
                this.sendErrors({
                    name: "Missing guild",
                    value: "We couldn't find the guild"
                })
            );
        }

        const XPServerConfig: IXPData = await this.getXPServerConfig()
            .then(XPServerConfig => XPServerConfig ?? XPData.create({
                serverId: (<Guild>this.guild).id
            }))



        return this["action_"+args.action](args, XPServerConfig);
    }

    async action_is_enabled(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Le système d'XP est "+(XPServerConfig.enabled ? "actif" : "inactif"))
            ]
        })
    }

    async action_enable(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (XPServerConfig.activeRoleId === undefined)
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Activer système d'XP")
                        .setFields({
                            name: "Activer système d'XP",
                            value: "Vous devez d'abord définir le rôle actif via la commande /configxp active_role set"
                        })
                ]
            })

        XPServerConfig.enabled = true;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Activer système d'XP")
                    .setFields({
                        name: "Activer système d'XP",
                        value: "Fonctionnalité activée avec succès !"
                    })
            ]
        })
    }

    async action_disable(args: IConfigXPArgs, XPServerConfig: IXPData) {
        XPServerConfig.enabled = false;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Désactiver système d'XP")
                    .setFields({
                        name: "Désactiver système d'XP",
                        value: "Fonctionnalité désactivée avec succès !"
                    })
            ]
        })
    }

    async action_timezone(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (args.setOrShowSubAction === "show")
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Le créneau horaire")
                        .setFields({
                            name: "Le créneau horaire configuré est :",
                            value: "UTC"+(XPServerConfig.timezone >= 0 ? "+" : "")+XPServerConfig.timezone
                        })
                ]
            })

        const msIn24h = 24 * 60 * 60 * 1000;


        const newFirstMessageTime = XPServerConfig.firstMessageTime + (XPServerConfig.timezone-args.timezone) * 60*60*1000;
        XPServerConfig.firstMessageTime = newFirstMessageTime < 0 ?
            msIn24h + newFirstMessageTime :
            newFirstMessageTime % msIn24h;

        XPServerConfig.timezone = args.timezone;

        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Créneau horaire sauvegardé")
                    .setFields({
                        name: "Créneau horaire sauvegardé",
                        value: "Le créneau horaire a été sauvegardé avec succès!"
                    })
            ]
        })
    }

    async action_grades(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this["action_grades_"+args.gradesSubActions](args,XPServerConfig)
    }

    warningRolesCantBeAssignedMessage(...roles: Role[]|[Role[]]): null|EmbedField {
        roles = (roles.length > 0 && roles[0] instanceof Array) ? roles[0] : roles
        if (this.guild === null || this.guild.members.me === null)
            return null;
        const cantBeAssignedRoles = (<Role[]>roles).filter(role => !roleCanBeManaged(<Guild>this.guild, role))
        return cantBeAssignedRoles.length > 0 ?
            {
                name: "Attention, Herma Bot ne peut pas assigner les rôles suivants car ils ont un rang plus élevé que le sien :",
                value: cantBeAssignedRoles.map(role => " - <@&"+role.id+">").join("\n"),
                inline: false
            } : null;
    }

    async action_grades_export(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const messagePayload = new MessagePayload(<Interaction|Message>(this.interaction??this.message), {
            content: "Voici les grades exportés :"
        });
        messagePayload.files = [{
            name: "grades.json",
            data: JSON.stringify(XPServerConfig.grades.map(grade => ({...(<any>grade)._doc, _id: undefined})), null, "\t")
        }]
        return this.response(true, messagePayload)
    }

    async action_grades_import(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (!checkGradesListData(<Guild>this.guild, args.jsonFile))
            return this.response(false, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Importation échouée")
                        .setFields({
                            name: "Il est impossible d'importer ce fichier json pour les grades",
                            value: "Êtes vous sur que le format soit correct ?\n"+
                                "Il se peut aussi que les roleId mentionnés n'existent pas sur ce serveur, "+
                                "si oui, il vous est possible de les éditer avec un id correspondant à un rôle existant"
                        })
                ]
            })

        XPServerConfig.grades = args.jsonFile;
        await XPServerConfig.save();

        const embed = new EmbedBuilder()
            .setTitle("Importation réussie")
            .setFields({
                name: "Importation réussie",
                value: "l'importation des grades à eu lieu avec succès"
            })

        const warningNonAssignableRolesEmbed = this.warningRolesCantBeAssignedMessage(<Role[]>(<IGrade[]>args.jsonFile)
            .filter(({roleId}, index) => !XPServerConfig.grades.slice(0,index).some(grade => grade.roleId === roleId))
            .map(grade =>
                (<Guild>this.guild).roles.cache.get(grade.roleId)
            ))

        if (warningNonAssignableRolesEmbed !== null)
            embed.addFields(warningNonAssignableRolesEmbed)

        return this.response(true, {
            embeds: [embed]
        })
    }

    async action_grades_add(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const [atLevel, roleId, name, requiredXP, XPByLevel] = [
            args.level ?? 1,
            args.role.id,
            args.name,
            args.XP ?? <number>calculRequiredXPForNextGrade(XPServerConfig.grades, <number>args.level),
            args.XPByLevel
        ]

        XPServerConfig.grades.push({
            atLevel,
            roleId,
            name,
            requiredXP,
            XPByLevel
        });

        await XPServerConfig.save();

        const embed = new EmbedBuilder()
            .setTitle("Grade créé")
            .setFields({
                name: "Grade créé avec succès!",
                value: "Le grade '"+name+"', à partir de "+requiredXP+"XP a été créé avec succès"
            });

        const warningNonAssignableRolesEmbed = this.warningRolesCantBeAssignedMessage(args.role);

        if (warningNonAssignableRolesEmbed !== null)
            embed.addFields(warningNonAssignableRolesEmbed)

        return this.response(true, {
            embeds: [embed]
        })
    }

    async action_grades_delete(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const deletedGrade = XPServerConfig.grades[args.gradeNumber-1];

        XPServerConfig.grades.splice(args.gradeNumber-1, 1);

        for (let i=0;i<XPServerConfig.grades.length;i++) {
            if (i === 0 && args.gradeNumber === 1) {
                XPServerConfig.grades[i].atLevel = 1;
                continue;
            }
            if (i > 0 && i >= args.gradeNumber-1) {
                XPServerConfig.grades[i].requiredXP = <number>calculRequiredXPForNextGrade(XPServerConfig.grades, XPServerConfig.grades[i].atLevel, i-1)
            }
        }

        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Grade supprimé")
                    .setFields({
                        name: "Grade supprimé avec succès",
                        value: "Le grade '"+deletedGrade.name+"' a été supprimé avec succès"
                    })
            ]
        })
    }

    async action_grades_set_name(args: IConfigXPArgs, XPServerConfig: IXPData) {
        XPServerConfig.grades[args.gradeNumber-1].name = args.name;

        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Nom modifié")
                    .setFields({
                        name: "Nom du grade "+args.gradeNumber+" modifié",
                        value: "Le nom du grade "+args.gradeNumber+" a été modifié avec succès"
                    })
            ]
        })
    }

    async action_grades_set_role(args: IConfigXPArgs, XPServerConfig: IXPData) {
        XPServerConfig.grades[args.gradeNumber-1].roleId = args.role.id;

        await XPServerConfig.save();

        const embed = new EmbedBuilder()
            .setTitle("Role modifié")
            .setFields({
                name: "Role du grade "+args.gradeNumber+" modifié",
                value: "Le role du grade "+args.gradeNumber+" a été modifiés avec succès"
            });

        const warningNonAssignableRolesEmbed = this.warningRolesCantBeAssignedMessage(args.role);

        if (warningNonAssignableRolesEmbed !== null)
            embed.addFields(warningNonAssignableRolesEmbed)

        return this.response(true, {
            embeds: [embed]
        })
    }

    async action_grades_set_xp_by_level(args: IConfigXPArgs, XPServerConfig: IXPData) {
        XPServerConfig.grades[args.gradeNumber-1].XPByLevel = args.XPByLevel;

        for (let i=args.gradeNumber;i<XPServerConfig.grades.length;i++) {
            XPServerConfig.grades[i].requiredXP = <number>calculRequiredXPForNextGrade(XPServerConfig.grades, XPServerConfig.grades[i].atLevel, i-1)
        }

        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("XP par palier changé")
                    .setFields({
                        name: "XP par palier du grade "+args.gradeNumber+" modifié",
                        value: "Le nombre d'XP requis par palier du grade "+args.gradeNumber+" été modifié avec succès"
                    })
            ]
        })
    }

    async action_grades_set_xp(args: IConfigXPArgs, XPServerConfig: IXPData) {
        XPServerConfig.grades[args.gradeNumber-1].requiredXP = <number>args.XP;

        for (let i=args.gradeNumber;i<XPServerConfig.grades.length;i++) {
            XPServerConfig.grades[i].requiredXP = <number>calculRequiredXPForNextGrade(XPServerConfig.grades, XPServerConfig.grades[i].atLevel, i-1)
        }

        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("XP changé")
                    .setFields({
                        name: "XP du grade "+args.gradeNumber+" modifié",
                        value: "Les XPs requis du grade "+args.gradeNumber+" ont été modifié avec succès"
                    })
            ]
        })
    }

    async action_grades_set_level(args: IConfigXPArgs, XPServerConfig: IXPData) {
        XPServerConfig.grades[args.gradeNumber-1].atLevel = <number>args.level;

        for (let i=args.gradeNumber-1;i<XPServerConfig.grades.length;i++) {
            XPServerConfig.grades[i].requiredXP = <number>calculRequiredXPForNextGrade(XPServerConfig.grades, XPServerConfig.grades[i].atLevel, i-1)
        }

        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Niveau changé")
                    .setFields({
                        name: "Premier niveau du grade "+args.gradeNumber+" modifié",
                        value: "Le premier niveau du grade "+args.gradeNumber+" ont été modifié avec succès"
                    })
            ]
        })
    }

    async action_grades_insert(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const [atLevel, roleId, name, requiredXP, XPByLevel] = [
            args.level ?? 1,
            args.role.id,
            args.name,
            args.XP ?? <number>calculRequiredXPForNextGrade(XPServerConfig.grades, <number>args.level, args.gradeNumber-2),
            args.XPByLevel
        ]

        XPServerConfig.grades.splice(args.gradeNumber-1, 0, {
            atLevel, roleId, name, requiredXP, XPByLevel
        })

        for (let i=args.gradeNumber;i<XPServerConfig.grades.length;i++) {
            XPServerConfig.grades[i].requiredXP = <number>calculRequiredXPForNextGrade(XPServerConfig.grades, XPServerConfig.grades[i].atLevel, i-1)
        }

        await XPServerConfig.save();

        const embed = new EmbedBuilder()
            .setTitle("Nouveau grade inséré")
            .setFields({
                name: "Nouveau grade inséré avec succès!",
                value: "Le grade '"+name+"', à partir de "+requiredXP+"XP a été inséré à la position "+args.gradeNumber+" avec succès!"
            });

        const warningNonAssignableRolesEmbed = this.warningRolesCantBeAssignedMessage(args.role);

        if (warningNonAssignableRolesEmbed !== null)
            embed.addFields(warningNonAssignableRolesEmbed)

        return this.response(true, {
            embeds: [embed]
        })
    }

    async action_grades_list(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (XPServerConfig.grades.length === 0)
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Les grades")
                        .setFields({
                            name: "Aucun grade",
                            value: "Il n'y a aucun grade configuré"
                        })
                ]
            })

        const embed = new EmbedBuilder()
            .setTitle("Les grades")
            .setFields(
                XPServerConfig.grades.map(({atLevel, name, requiredXP, XPByLevel, roleId}, index) => ({
                    name: (index+1)+" - "+name,
                    value:
                        "Niveau "+atLevel+(
                            index === XPServerConfig.grades.length - 1 ?
                                "+" :
                                XPServerConfig.grades[index+1].atLevel-atLevel > 1 ?
                                    "-"+(XPServerConfig.grades[index+1].atLevel-1) :
                                    ""
                        )+"\n"+
                        "XP total requis : "+requiredXP+"\n"+
                        "XP/palier : "+XPByLevel+"\n"+
                        "Role : <@&"+roleId+">"
                }))
            );

        const warningNonAssignableRolesEmbed = this.warningRolesCantBeAssignedMessage(<Role[]>XPServerConfig.grades
            .filter(({roleId}, index) => !XPServerConfig.grades.slice(0,index).some(grade => grade.roleId === roleId))
            .map(grade => (<Guild>this.guild).roles.cache.get(grade.roleId))
            .filter(role => role !== undefined)
        );

        if (warningNonAssignableRolesEmbed !== null)
            embed.addFields(warningNonAssignableRolesEmbed)

        return this.response(true, {
            embeds: [embed]
        })
    }

    async action_tips(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this["action_tips_"+args.tipsSubActions](args, XPServerConfig)
    }

    async action_tips_export(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const messagePayload = new MessagePayload(<Interaction|Message>(this.interaction??this.message), {
            content: "Voici les tips exportés :"
        });
        messagePayload.files = [{
            name: "tips.json",
            data: JSON.stringify(XPServerConfig.tipsByLevel.map(grade => ({...(<any>grade)._doc, _id: undefined, userApproves: undefined, userUnapproves: undefined})), null, "\t")
        }]
        return this.response(true, messagePayload)
    }

    async action_tips_import(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (!checkTipsListData(args.jsonFile))
            return this.response(false, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Importation échouée")
                        .setFields({
                            name: "Il est impossible d'importer ce fichier json pour les tips",
                            value: "Êtes vous sur que le format soit correct ?"
                        })
                ]
            })

        XPServerConfig.tipsByLevel = args.jsonFile;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Importation réussie")
                    .setFields({
                        name: "Importation réussie",
                        value: "l'importation des tips à eu lieu avec succès"
                    })
            ]
        })
    }

    async action_tips_set(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.response(true, "Veuillez rentrer un message pour le tip (tapez 'CANCEL' pour annuler) :",
            () => new Promise(resolve => {
                let timeout;
                const listener = async (response: Message) => {
                    if (response.author.id !== this.member.id)
                        return;

                    client.off('messageCreate', listener);
                    clearTimeout(timeout);

                    if (response.content === "CANCEL") {
                        await response.delete();
                        resolve(this.response(true, "Commande annulée"))
                        return;
                    }

                    XPServerConfig.tipsByLevel = setTipByLevel(<number>args.level, response.content, XPServerConfig.tipsByLevel);
                    await XPServerConfig.save();

                    await response.delete();

                    resolve(
                        this.response(true, "Tips enregistré avec succès !")
                    )
                }

                client.on('messageCreate', listener);

                timeout = setTimeout(() => {
                    client.off('messageCreate', listener);
                    resolve(this.response(false, "Délai dépassé"));
                }, 15 * 60 * 1000)
            }))
    }

    async action_tips_delete(args: IConfigXPArgs, XPServerConfig: IXPData) {
        XPServerConfig.tipsByLevel = XPServerConfig.tipsByLevel.filter(tip => tip.level !== args.level);
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Element supprimé avec succès")
                    .setFields({
                        name: "Element supprimé avec succès",
                        value: "Le tip associé au niveau "+args.level+" a été supprimé avec succès !"
                    })
            ]
        })
    }

    async action_tips_show(args: IConfigXPArgs, XPServerConfig: IXPData) {
        if (this.commandOrigin !== 'slash')
            return this.response(false, "Vous devez être en commande slash")
        const tip = <ILevelTip>findTipByLevel(<number>args.level, XPServerConfig.tipsByLevel);

        return this.response(true, showTip(XPServerConfig.tipsByLevel, tip, <CommandInteraction>this.interaction))
    }

    async action_tips_list(args: IConfigXPArgs, XPServerConfig: IXPData) {
        // @ts-ignore
        return this.response(true, showTipsList(XPServerConfig.tipsByLevel))
    }

    async action_first_message_time(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const timezoneHourGap = 60*60*1000 * XPServerConfig.timezone;

        const msIn24h = 24 * 60 * 60 * 1000;

        if (args.setOrShowSubAction === "show") {
            const timeToShow = XPServerConfig.firstMessageTime + timezoneHourGap;
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Heure minimale du premier message")
                        .setFields({
                            name: "Heure configurée :",
                            value: showTime(extractUTCTime(timeToShow < 0 ? msIn24h + timeToShow : timeToShow%msIn24h), 'fr')
                        })
                ]
            })
        }

        const timeToSet = args.duration-timezoneHourGap;
        XPServerConfig.firstMessageTime = timeToSet < 0 ? msIn24h + timeToSet : timeToSet%msIn24h;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Heure minimale du premier message")
                    .setFields({
                        name: "Vous avez configuré avec succès l'heure suivante :",
                        value: showTime(extractUTCTime(args.duration), 'fr')
                    })
            ]
        })
    }

    async action_xp_gain_show(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Gains d'xp par type :")
                    .setFields(
                        {
                            name: "Pour les messages",
                            value: "Gain de "+XPServerConfig.XPByMessage+"XP par message toutes les "+showTime(extractUTCTime(XPServerConfig.timeLimitMessage), 'fr')
                        },
                        {
                            name: "Pour le vocal",
                            value: "Gain de "+XPServerConfig.XPByVocal+" XP toutes les "+showTime(extractUTCTime(XPServerConfig.timeLimitVocal), 'fr')+" en vocal"
                        },
                        {
                            name: "Pour le premier message de la journée",
                            value: XPServerConfig.XPByFirstMessage+" XP"
                        },
                        {
                            name: "Pour chaque bump",
                            value: XPServerConfig.XPByBump+" XP"
                        }
                    )
            ]
        })
    }

    async action_limit_gain_set(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const col = {
            message: 'timeLimitMessage',
            vocal: 'timeLimitVocal'
        }[args.XPActionTypesToLimit]

        XPServerConfig[col] = args.duration;
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Définir la limite de gain d'XP "+{
                        message: "par message",
                        vocal: "pour le vocal",
                    }[args.XPActionTypesToLimit])
                    .setFields({
                        name: "Vous avez défini la valeur suivante :",
                        value: showTime(extractUTCTime(args.duration), 'fr')
                    })
            ]
        })
    }

    async action_xp_gain_set(args: IConfigXPArgs, XPServerConfig: IXPData) {
        const col = {
            message: 'XPByMessage',
            vocal: 'XPByVocal',
            first_message: 'XPByFirstMessage',
            bump: 'XPByBump'
        }[args.XPActionTypes];

        XPServerConfig[col] = args.XP
        await XPServerConfig.save();

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Définir le gain d'XP "+{
                        message: "par message",
                        vocal: "pour le vocal",
                        first_message: "pour le premier message de la journée",
                        bump: "par bump"
                    }[args.XPActionTypes])
                    .setFields({
                        name: "Vous avez défini la valeur suivante :",
                        value: args.XP+" XP"
                    })
            ]
        })
    }

    async action_active_role(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.defineAndShowRole(args, XPServerConfig, 'activeRoleId')
    }

    async action_channel_role(args: IConfigXPArgs, XPServerConfig: IXPData) {
        return this.defineAndShowRole(args, XPServerConfig, 'channelRoleId')
    }

    async defineAndShowRole(args: IConfigXPArgs, XPServerConfig: IXPData, col: 'activeRoleId'|'channelRoleId') {
        const typeName = col === "activeRoleId" ? "actif" : "d'accès";
        if (args.setOrShowSubAction === "show")
            return this.response(true, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Rôle "+typeName)
                        .setFields({
                            name: "Rôle "+typeName+" :",
                            value: XPServerConfig[col] ?
                                "<@&"+XPServerConfig[col]+">" :
                                "Non défini"
                        })
                ]
            })
        XPServerConfig[col] = args.role.id;
        await XPServerConfig.save()

        return this.response(true, {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Définir le rôle "+typeName)
                    .setFields({
                        name: "Rôle défini avec succès !",
                        value: "Rôle défini avec succès !"
                    })
            ]
        })
    }
}