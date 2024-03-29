import * as fs from "fs/promises";

export let existingCommands = {};

export function getExistingCommands(): Promise<void> {
    return new Promise(resolve => {
        const path = __dirname+"/../Commands/";
        fs.readdir(path)
            .then(files => files.filter(file => file.endsWith(".js")))
            .then(files => files.map(file => require(path+file).default))
            .then(commands => {
                for (const commandClass of commands) {
                    if (!commandClass.abstract)
                        existingCommands[commandClass.name] = commandClass;
                }
                resolve();
            });
    });
}
