import {durationUnits} from "./DateTimeManager";

export const checkTypes = {
    number: field => typeof(field) == "number",
    string: field => typeof(field) == "string",
    strings: field => typeof(field) == "string",
    boolean: field => typeof(field) == "boolean",
    unicode: field => checkTypes.string(field) && new RegExp("^[^\u0000-\u007F]+$").test(field),
    id: field => (checkTypes.number(field) || checkTypes.string(field)) && new RegExp("^( )*[0-9]{18,}( )*$").test(field.toString()),
    emote: field => checkTypes.string(field) && (new RegExp("^( )*\<(a)?\:[a-zA-Z0-9_-]{2,18}\:[0-9]{18,}\>( )*$").test(field) || checkTypes.unicode(field)),
    message: field => checkTypes.id(field),
    messages: field => (checkTypes.number(field) || checkTypes.string(field)) && new RegExp("^( )*[0-9]{18,}( )*(\,?( )*[0-9]{18,}( )*)*$").test(field.toString()),
    category: field => (checkTypes.number(field) || checkTypes.string(field)) && new RegExp("^( )*[0-9]{18,}( )*$").test(field.toString()),
    channel: field => checkTypes.string(field) && new RegExp("^( )*"+regex.channel+"( )*$").test(field),
    channels: field => checkTypes.string(field) && new RegExp("^( )*"+regex.channel+"( )*(\,?( )*"+regex.channel+"( )*)*$").test(field),
    user: field => checkTypes.string(field) && new RegExp("^( )*"+regex.user+"( )*$").test(field),
    users: field => checkTypes.string(field) && new RegExp("^( )*"+regex.user+"( )*(\,?( )*"+regex.user+"( )*)*$").test(field),
    role: field => checkTypes.string(field) && new RegExp("^( )*"+regex.role+"( )*$").test(field),
    roles: field => checkTypes.string(field) && (new RegExp("^( )*"+regex.role+"( )*(\,?( )*"+regex.role+"( )*)*$").test(field) || field.trim() == ""),
    listenerReactMessage: field => checkTypes.string(field) && new RegExp("^( )*\<#[0-9]{18,}\>/[0-9]{18,}( )*$").test(field),
    command: (field) => checkTypes.string(field) && new RegExp("^( )*"+regex.command+"( )*$").test(field),
    commands: (field) => checkTypes.string(field) && new RegExp("^( )*"+regex.command+"( )*((\,|( )+)"+regex.command+"( )*)*$"),
    duration: (field) => {
        if (!checkTypes.string(field) && !checkTypes.number(field)) return false;
        field = field.toString();
        const regex = "[0-9]+( )*("+
            Object.values(durationUnits).reduce(
                (acc,values,i) =>
                    acc+(i > 0 ? '|' : '')+values.join('|')
                , '')
            +")";
        return new RegExp("^(( )*("+regex+"( )*)+|0+)$").test(field);
    }
};

const regex: any = {};

regex.role = "\<@&[0-9]{18,}\>";
regex.channel = "\<#(!)?[0-9]{18,}\>";
regex.user = "\<@(!)?[0-9]{18,}\>";
regex.command = "[a-zA-Z]+";
