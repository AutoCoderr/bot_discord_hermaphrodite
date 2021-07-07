export const checkTypes = {
    number: field => typeof(field) == "number",
    string: field => typeof(field) == "string",
    boolean: field => typeof(field) == "boolean",
    emote: field => checkTypes.string(field) && (new RegExp("^\<(a)?\:[a-zA-Z0-9_-]{2,18}\:[0-9]{18}\>$").test(field) || new RegExp("^[^\u0000-\u007F]+$").test(field)),
    message: field => (checkTypes.number(field) || checkTypes.string(field)) && new RegExp("^[0-9]{18}$").test(field.toString()),
    messages: field => (checkTypes.number(field) || checkTypes.string(field)) && new RegExp("^[0-9]{18}( )*(\,( )*[0-9]{18}( )*)*$").test(field.toString()),
    category: field => (checkTypes.number(field) || checkTypes.string(field)) && new RegExp("^[0-9]{18}$").test(field.toString()),
    channel: field => checkTypes.string(field) && new RegExp("^\<#[0-9]{18}\>$").test(field),
    user: field => checkTypes.string(field) && new RegExp("^\<@(!)?[0-9]{18}\>$").test(field),
    role: field => checkTypes.string(field) && new RegExp("^"+regex.role+"$").test(field),
    roles: field => checkTypes.string(field) && (new RegExp("^( )*"+regex.role+"( )*(\,( )*"+regex.role+"( )*)*$").test(field) || field.trim() == ""),
    listenerReactMessage: field => checkTypes.string(field) && new RegExp("^\<#[0-9]{18}\>/[0-9]{18}$").test(field)
};

const regex: any = {};

regex.role = "\<@&[0-9]{18}\>";
