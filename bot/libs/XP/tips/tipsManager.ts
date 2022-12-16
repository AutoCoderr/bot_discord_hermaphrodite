import {ILevelTip} from "../../../Models/XP/XPData";
import {GuildMember, User} from "discord.js";

export function approveOrUnApproveTip(member: GuildMember|User, tips: ILevelTip[], level: number, toApprove: boolean, updatedTips: ILevelTip[] = []): ILevelTip[]|false {
    if (tips.length === 0)
        return false;

    const tip = tips[0];

    if (level !== tip.level)
        return approveOrUnApproveTip(member, tips.slice(1), level, toApprove, [...updatedTips, tip]);

    const col = toApprove ? 'userApproves' : 'userUnapproves';
    const otherCol = toApprove ? 'userUnapproves' : 'userApproves';
    tip[otherCol] = (<string[]>tip[otherCol]).filter(userId => userId !== member.id);
    if (!(<string[]>tip[col]).some(userId => userId === member.id))
        (<string[]>tip[col]).push(member.id);

    return [...updatedTips, tip, ...tips.slice(1)];
}

export function setTipByLevel(level: number, content: string, tips: ILevelTip[]): ILevelTip[] {
    const userApproves = level === 1 ? null : [];
    const userUnapproves = level === 1 ? null : [];
    return tips.length === 0 ?
        [{
            level,
            content,
            userApproves,
            userUnapproves
        }] :
        tips.reduce((acc,tip, index) => [
            ...acc,
            ...(
                tip.level === level ?
                    [{
                        ...tip,
                        content
                    }] :
                    (tip.level > level && (index === 0 || (index > 0 && tips[index-1].level < level))) ?
                        [
                            {
                                level,
                                content,
                                userApproves,
                                userUnapproves
                            },
                            tip
                        ] :
                        (index === tips.length-1 && tip.level < level) ?
                            [
                                tip,
                                {
                                    level,
                                    content,
                                    userApproves,
                                    userUnapproves
                                }
                            ] :
                            [tip]
            )
        ], <ILevelTip[]>[])
}

export function findTipByLevel(level: number, tips: ILevelTip[], a = 0, b = tips.length-1): null|ILevelTip {
    if (tips.length === 0)
        return null;

    if (tips[a].level === level)
        return tips[a];

    if (tips[b].level === level)
        return tips[b];

    if (Math.abs(b-a) <= 1)
        return null

    const m = Math.floor((a+b)/2)

    if (tips[m].level === level)
        return tips[m];

    if (tips[m].level > level)
        return findTipByLevel(level, tips, a, m);

    return findTipByLevel(level, tips, m, b)
}