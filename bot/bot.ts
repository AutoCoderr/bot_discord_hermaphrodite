import Emote, { IEmote } from "./Models/Emote";

console.log("COUCOU JE SUIS UN BOT");

(async () => {
    let emotes = await Emote.find({});
    if (emotes.length == 0) { // Créer une emote, s'il n'en trouve pas
        const date = new Date();
        // Ajoute une emote de test pour les stats dans la bdd
        const emote: IEmote = {
            userName: "Toto",
            emoteName: ":ahego:",
            dateTime: date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds()
        }

        await Emote.create(emote);
        emotes = await Emote.find({});
    }
    console.log(emotes);
})();