import client from "../../client";
import checkExistingResources from "./checkExistingResources";
import config from "./config";
import prepareVocal from "./prepareVocalAndText";

client.on('ready', async () => {
    await checkExistingResources(config);
    await prepareVocal(config,'vocal');
    await prepareVocal(config,'text');

    console.log("Spam config generation finished")
    process.exit()
})