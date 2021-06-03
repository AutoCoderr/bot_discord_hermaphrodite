export const checkTypes = {
    number: field => typeof(field) == "number",
    string: field => typeof(field) == "string",
    boolean: field => typeof(field) == "boolean",
    emote: field => checkTypes.string(field) && new RegExp("\<(a)?\:[a-zA-Z0-9_-]{2,18}\:[0-9]{18}\>").test(field),
    message: field => (checkTypes.number(field) || checkTypes.string(field)) && new RegExp("[0-9]{18}").test(field.toString()),
    category: field => (checkTypes.number(field) || checkTypes.string(field)) && new RegExp("[0-9]{18}").test(field.toString()),
    channel: field => checkTypes.string(field) && new RegExp("\<#[0-9]{18}\>").test(field),
    user: field => checkTypes.string(field) && new RegExp("\<@(!)?[0-9]{18}\>").test(field),
    role: field => checkTypes.string(field) && new RegExp("\<@&[0-9]{18}\>").test(field),
    listenerReactMessage: field => checkTypes.string(field) && new RegExp("\<#[0-9]{18}\>/[0-9]{18}").test(field)
};