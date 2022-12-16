import {IGrade, IXPData} from "../../Models/XP/XPData";
import {Guild, GuildMember} from "discord.js";
import XPUserData, {IXPUserData} from "../../Models/XP/XPUserData";
import {roleCanBeManaged, checkIfBotCanManageRoles} from "./XPOtherFunctions";
import CustomError from "../../logging/CustomError";

export async function checkAllUsersInGrades(
    guild: Guild,
    XPServerConfig: IXPData,
    start: number = 0,
    gradesById: {[id: string]: IGrade} = XPServerConfig.grades.reduce((acc, grade) => ({
        ...acc,
        [<string>grade._id]: grade
    }), {})
) {
    if (start < 0 || start > XPServerConfig.grades.length-1)
        throw new CustomError("Error, bad indexes given to checkAllUsersInGrades", {
            givenStartGradeIndex: start
        });

    const membersById: {[id: string]: GuildMember} = {};

    const remainingXPUserConfigs = await loopOnGradesToCheckAllUsers(
        guild,
        XPServerConfig.grades.slice(start).reverse(),
        gradesById,
        await XPUserData.find({
            serverId: XPServerConfig.serverId
        }),
        membersById
    );

    if (start !== 0 || remainingXPUserConfigs.length == 0)
        return;
    
    const botCanManageRoles = checkIfBotCanManageRoles(guild);

    await Promise.all(
        remainingXPUserConfigs.map(async XPUserConfig => {
            if (XPUserConfig.gradeId === undefined)
                return;

            const oldGrade = gradesById[XPUserConfig.gradeId];
            const member = await getOrFetchMember(guild, XPUserConfig.userId, membersById);
            if (
                botCanManageRoles &&
                member &&
                roleCanBeManaged(guild, oldGrade.roleId)
            )
                await member.roles.remove(oldGrade.roleId);

            XPUserConfig.gradeId = undefined;
            XPUserConfig.currentLevel = 0;
            XPUserConfig.lastNotifiedLevel = 0;

            return XPUserConfig.save();
        })
    )
}

async function loopOnGradesToCheckAllUsers(
    guild: Guild,
    gradesToCheck: IGrade[],
    gradesById: {[id: string]: IGrade},
    XPUserConfigs: IXPUserData[],
    membersById: {[id: string]: GuildMember}
): Promise<IXPUserData[]> {
    if (gradesToCheck.length === 0)
        return XPUserConfigs;

    const grade = gradesToCheck[0];

    return loopOnGradesToCheckAllUsers(
        guild,
        gradesToCheck.slice(1),
        gradesById,
        await checkAllUsersInGrade(guild, grade, gradesById, XPUserConfigs, membersById),
        membersById
    )
}

async function getOrFetchMember(guild: Guild, memberId, membersById: {[id: string]: null|GuildMember}) {
    if (membersById[memberId] === undefined) {
        membersById[memberId] = await guild.members.fetch(memberId).catch(() => null)
    }
    return membersById[memberId];
}

async function checkAllUsersInGrade(
    guild: Guild,
    grade: IGrade,
    gradesById: {[id: string]: IGrade},
    XPUserConfigs: IXPUserData[],
    membersById: {[id: string]: GuildMember},
): Promise<IXPUserData[]> {
    const botCanManageRoles = await checkIfBotCanManageRoles(guild);

    await Promise.all(
        XPUserConfigs
            .filter(XPUserConfig => XPUserConfig.XP >= grade.requiredXP)
            .map(async XPUserConfig => {
                let toSave = false;
                if (XPUserConfig.gradeId !== (<string>grade._id).toString()) {
                    let member: null | GuildMember = null;
                    if (
                        botCanManageRoles &&
                        XPUserConfig.gradeId !== undefined &&
                        gradesById[XPUserConfig.gradeId] !== undefined &&
                        grade.roleId !== gradesById[XPUserConfig.gradeId].roleId &&
                        roleCanBeManaged(guild, gradesById[XPUserConfig.gradeId].roleId) &&
                        (member = await getOrFetchMember(guild, XPUserConfig.userId, membersById))
                    )
                        await member.roles.remove(gradesById[XPUserConfig.gradeId].roleId);

                    if (
                        botCanManageRoles &&
                        (
                            XPUserConfig.gradeId === undefined ||
                            gradesById[XPUserConfig.gradeId] === undefined ||
                            grade.roleId !== gradesById[XPUserConfig.gradeId].roleId
                        ) &&
                        roleCanBeManaged(guild, grade.roleId) &&
                        (member = await getOrFetchMember(guild, XPUserConfig.userId, membersById))
                    )
                        await member.roles.add(grade.roleId);

                    XPUserConfig.gradeId = grade._id;
                    toSave = true;
                }
                const newLevel = grade.atLevel + Math.floor((XPUserConfig.XP-grade.requiredXP)/grade.XPByLevel);
                if (newLevel !== XPUserConfig.currentLevel) {
                    XPUserConfig.currentLevel = newLevel;
                    if (XPUserConfig.lastNotifiedLevel > XPUserConfig.currentLevel)
                        XPUserConfig.lastNotifiedLevel = XPUserConfig.currentLevel;
                    toSave = true;
                }
                if (toSave)
                    return XPUserConfig.save();
            })
    )


    return XPUserConfigs.filter(XPUserConfig => XPUserConfig.XP < grade.requiredXP);
}

export async function reDefineUsersGradeRole(guild: Guild, oldRoleId: string, grade: IGrade) {
    if (oldRoleId === grade.roleId || !checkIfBotCanManageRoles(guild))
        return;
    const XPUserConfigs: IXPUserData[] = await XPUserData.find({
        serverId: guild.id,
        gradeId: (<string>grade._id).toString()
    });

    const oldRoleCanBeManaged = roleCanBeManaged(guild, oldRoleId);
    const newRoleCanBeManaged = roleCanBeManaged(guild, grade.roleId);

    if (!oldRoleCanBeManaged && !newRoleCanBeManaged)
        return;

    return Promise.all(
        XPUserConfigs.map(async XPUserConfig => {
            const member: null|GuildMember = await guild.members.fetch(XPUserConfig.userId).catch(() => null)
            if (oldRoleCanBeManaged && member)
                await member.roles.remove(oldRoleId);
            if (newRoleCanBeManaged && member)
                await member.roles.add(grade.roleId);
        })
    )
}

export function calculRequiredXPForNextGrade(grades: IGrade[], level: number, lastGradeIndex: number = grades.length-1): null|number {
    const lastGrade = grades[lastGradeIndex];
    const lastGradeLevel = lastGradeIndex === 0 ? 1 : lastGrade.atLevel;
    if (level <= lastGrade.atLevel)
        return null;


    return lastGrade.requiredXP + (level-lastGradeLevel)*lastGrade.XPByLevel
}

export function checkGradesListData(guild: Guild, grades: any) {
    return grades instanceof Array &&
        !grades.some((grade,index) => (
            typeof(grade) !== "object" ||
            grade === null ||
            grade instanceof Array ||

            typeof(grade.atLevel) !== "number" ||
            grade.atLevel%1 !== 0 ||
            grade.atLevel <= 0 ||

            (index === 0 && grade.atLevel !== 1) ||
            (index > 0 && grade.atLevel <= grades[index-1].atLevel) ||
            (index < grades.length-1 && grade.atLevel >= grades[index+1].atLevel) ||

            typeof(grade.requiredXP) !== "number" ||
            grade.requiredXP%1 !== 0 ||
            grade.requiredXP <= 0 ||

            (index > 0 && grade.requiredXP !== calculRequiredXPForNextGrade(grades, grade.atLevel, index-1)) ||

            typeof(grade.XPByLevel) !== "number" ||
            grade.XPByLevel%1 !== 0 ||
            grade.XPByLevel <= 0 ||

            typeof(grade.name) !== "string" ||
            typeof(grade.roleId) !== "string" ||

            guild.roles.cache.get(grade.roleId) === undefined ||

            Object.keys(grade).length > 5
        ))
}