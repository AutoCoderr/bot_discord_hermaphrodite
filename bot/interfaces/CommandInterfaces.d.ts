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

export type IChoice = null|string|((args: IArgs, parentDescription: string) => string);

export type IArgModel<IArgs = {[key: string]: any}> = RequireAtLeastOne<{
    type: keyof typeof checkTypes;
    types: (keyof typeof checkTypes)[];
    required?: boolean|((args: Partial<IArgs>, command: null|Command<IArgs>, modelizeSlashCommand: boolean) => boolean);
    description: string;
    isSubCommand?: boolean;
    choices?: {[action: string]: IChoice}|string[];
    referToSubCommands?: string[];
    displayValidError?: boolean;
    displayValidErrorEvenIfFound?: boolean;
    displayExtractError?: boolean;
    multi?: boolean;
    valid?: (value: any, args: Partial<IArgs>, command: Command<IArgs>) => boolean|Promise<boolean>;
    evenCheckForSlash?: boolean;
    errorMessage?: (value: any, args: Partial<IArgs>) => {name: string, value: string};
    default?: any;
    moreDatas?: (args: Partial<IArgs>, type: keyof typeof checkTypes, command: Command<IArgs>) => any
}, 'type' | 'types'>

export type IArgsModel<IArgs = {[key: string]: any}> =
    RequireAtLeastOne<{
        $argsByOrder: Array<IArgModel<IArgs>&{field: string}>,
        $argsByType: {
            [field: string]: IArgModel<IArgs>
        }
        $argsByName: {
            [field: string]: IArgModel<IArgs>&{fields: string[]}
        }
    }>

export interface responseType {
    success: boolean;
    result: responseResultsType,
    callback?: (() => false|responseType|Promise<false|responseType>)
}