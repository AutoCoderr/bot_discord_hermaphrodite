import Emote, { IEmote } from "./Models/Emote";

console.log("COUCOU JE SUIS UN BOT")

/*const date = new Date();
// Ajoute une emote de test pour les stats dans la bdd
const emote: IEmote = {
    userName: "Jean michel",
    emoteName: ":ahego:",
    dateTime: date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate()+" "+date.getHours()+":"+date.getMinutes()+":"+date.getSeconds()
}

Emote.create(emote);*/


setTimeout(async () => {
    console.log("Les emotes :")
    let emotes = await Emote.find({});
    console.log(emotes);
},1000);
