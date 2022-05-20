import config from "./config";
import client from "./client";

import init from "./init";

client.login(config.token);

init(client);


// @ts-ignore
String.prototype.replaceAll = function (A,B) {
    let str = this.valueOf();
    while (str.replace(A,B) != str) {
        str = str.replace(A,B);
    }
    return str;
}
