import {InteractionReplyOptions, MessagePayload} from "discord.js";
import {checkTypes} from "./TypeChecker";
import Command from "./Command";

export interface responseResultsType extends Array<string | MessagePayload | InteractionReplyOptions>{};

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>>
    & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
}[Keys];

type IArg = RequireAtLeastOne<{
    type: keyof typeof checkTypes;
    types: (keyof typeof checkTypes)[];
    required?: boolean|((args: {[key: string]: any}, command: Command, modelizeSlashCommand: boolean) => boolean);
    description: string;
    isSubCommand?: boolean;
    choices?: {[action: string]: string};
    referToSubCommands?: string[];
    displayValidError?: boolean;
    displayValidErrorEvenIfFound?: boolean;
    displayExtractError?: boolean;
    multi?: boolean;
    valid?: (value: any, args: {[key: string]: any}, command: Command) => boolean|Promise<boolean>;
    errorMessage?: (value: any, args: {[key: string]: any}) => {name: string, value: string};
    default?: any;
    moreDatas?: (args: {[key: string]: any}, type: keyof typeof checkTypes, command: Command) => any
}, 'type' | 'types'>

export type IArgsModel =
    RequireAtLeastOne<{
        $argsByOrder: Array<IArg&{field: string}>,
        $argsByType: {
            [field: string]: IArg
        }
        $argsByName: {
            [field: string]: IArg&{fields: string[]}
        }
    }>

export interface responseType {
    success: boolean;
    result: responseResultsType,
    callback?: Function
}