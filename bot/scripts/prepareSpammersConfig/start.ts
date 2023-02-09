import client from "../../client";
import checkExistingResources from "./checkExistingResources";
import config from "./config";
import prepareVocal from "./prepareVocal";

client.on('ready', async () => {
    await checkExistingResources(config);
    await prepareVocal(config);

    console.log("Spamming config generation finished")
    process.exit()
})