
import {InteractionReplyOptions, MessagePayload, ModalBuilder} from "discord.js";
import {checkTypes} from "../Classes/TypeChecker";
import Command from "../Classes/Command";

export type responseResultType = string | MessagePayload | InteractionReplyOptions;

export type responseResultsType = responseResultType[];

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>>
    & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
}[Keys];

type IErrorMessageRes = {name: string, value: string}|Array<{name: string, value: string}>

export type IValidatedArgs<IArgs> = {[key in keyof IArgs]?: boolean}


export type IChoice<IArgs> = null|string|((args: Partial<IArgs>, parentDescription: string) => string);
export type IChoices = {[action: string]: IChoice<IArgs>}|string[];

export type IArgModel<IArgs = {[key: string]: any}, C extends Command = Command> = {
    type: keyof typeof checkTypes;
    required?: boolean|((args: Partial<IArgs>, command: null|C<IArgs>, modelizeSlashCommand: boolean) => boolean|Promise<boolean>);
    description: string|((args: Partial<IArgs>, command: null|C<IArgs>, modelizeSlashCommand: boolean) => string);
    isSubCommand?: boolean;
    choices?: IChoices|(() => IChoices|Promise<IChoices>);
    referToSubCommands?: string[];
    displayValidError?: boolean|((args: Partial<IArgs>, command: C<IArgs>) => boolean);
    displayValidErrorEvenIfFound?: boolean|((args: Partial<IArgs>, command: C<IArgs>) => boolean);
    displayExtractError?: boolean|((args: Partial<IArgs>, command: C<IArgs>) => boolean);
    multi?: boolean;
    valid?: (value: any, args: Partial<IArgs>, command: C<IArgs>, validatedArgs: IValidatedArgs<IArgs>) => boolean|Promise<boolean>;
    evenCheckAndExtractForSlash?: boolean;
    errorMessage?: (value: any, args: Partial<IArgs>, command: C<IArgs>) => IErrorMessageRes|Promise<IErrorMessageRes>;
    default?: any;
    moreDatas?: (args: Partial<IArgs>, type: keyof typeof checkTypes, command: C<IArgs>) => any
}

export type IArgsModel<IArgs = {[key: string]: any}, C extends Command = Command> =
    RequireAtLeastOne<{
        $argsByOrder: Array<IArgModel<IArgs,C>&{field: string}>,
        $argsByType: {
            [field: string]: IArgModel<IArgs,C>
        }
        $argsByName: {
            [field: string]: IArgModel<IArgs,C>&{fields: string[]}
        }
    }>

export interface responseType<TResult extends responseResultsType | ModalBuilder = responseResultsType | ModalBuilder> {
    success: boolean;
    result: TResult,
    callback?: (() => false|responseType|Promise<false|responseType>)
}

export type IFailList = Array<IArgModel<IArgs>&RequireAtLeastOne<{value?: any, field: string, fields: string[]}, 'field' | 'fields'>>;

export type getCommandTypeArg<C extends null|Command> = C extends Command ? C : Command

export type ISlashCommandsDefinition = {[name: string]: optionCommandType}

export interface IFieldLimit {
    min: number,
    max: number
}