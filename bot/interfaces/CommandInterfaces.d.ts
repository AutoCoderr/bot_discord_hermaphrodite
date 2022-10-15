import {InteractionReplyOptions, MessagePayload} from "discord.js";
import {checkTypes} from "../Classes/TypeChecker";
import Command from "../Classes/Command";

export type responseResultType = string | MessagePayload | InteractionReplyOptions;

export type responseResultsType = responseResultType[];

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>>
    & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
}[Keys];

type IArg<IArgs = {[key: string]: any}> = RequireAtLeastOne<{
    type: keyof typeof checkTypes;
    types: (keyof typeof checkTypes)[];
    required?: boolean|((args: IArgs, command: Command, modelizeSlashCommand: boolean) => boolean);
    description: string;
    isSubCommand?: boolean;
    choices?: {[action: string]: string};
    referToSubCommands?: string[];
    displayValidError?: boolean;
    displayValidErrorEvenIfFound?: boolean;
    displayExtractError?: boolean;
    multi?: boolean;
    valid?: (value: any, args: IArgs, command: Command) => boolean|Promise<boolean>;
    errorMessage?: (value: any, args: IArgs) => {name: string, value: string};
    default?: any;
    moreDatas?: (args: IArgs, type: keyof typeof checkTypes, command: Command) => any
}, 'type' | 'types'>

export type IArgsModel<IArgs = {[key: string]: any}> =
    RequireAtLeastOne<{
        $argsByOrder: Array<IArg<IArgs>&{field: string}>,
        $argsByType: {
            [field: string]: IArg<IArgs>
        }
        $argsByName: {
            [field: string]: IArg<IArgs>&{fields: string[]}
        }
    }>

export interface responseType {
    success: boolean;
    result: responseResultsType,
    callback?: (() => false|responseType|Promise<false|responseType>)
}