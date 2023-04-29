import { Guild } from "discord.js";
import StatsConfig, { IStatsConfig } from "../../../Models/Stats/StatsConfig";
import client from "../../../client";
import { checkAndGetGivenGuilds } from "../../../libs/commandUtils";
import { extractDate, extractTime, showDate, showTime } from "../../../Classes/DateTimeManager";

function cmdError(msg) {
    console.log("Erreur : "+msg);
    console.log("Voici la syntaxe requise :");
    console.log("npm run stats_define_active_period <type: vocal|messages> <dateA: date> <dateB: never|date> <servers: all|server_id1, server_id2, server_idn>");
    process.exit();
}

function generateServerErrors(
    activePeriodCol: string, 
    dateA: Date,
    guilds: Guild[], 
    statsConfigs: (null|IStatsConfig)[]
): Promise<{[error: string]: Guild[]}> {
    return Promise.all(
        guilds.map((_,i) => {
            const statsConfig: null|IStatsConfig = statsConfigs[i];

            if (
                statsConfig === null || 
                !(statsConfig[activePeriodCol] instanceof Array) ||
                statsConfig[activePeriodCol].length === 0
            )
                return "none";

            if (statsConfig[activePeriodCol][statsConfig[activePeriodCol].length-1].endDate === undefined)
                return "last_period_not_finished";
            
            if (dateA.getTime() <= (<Date>statsConfig[activePeriodCol][statsConfig[activePeriodCol].length-1].endDate).getTime())
                return "dateA_less_than_end_period";

            return "none";
        })
    ).then((errors) => 
        errors.reduce((acc,error,i) => ({
            ...acc,
            [error]: [
                ...(acc[error] ?? []),
                guilds[i]
            ]
        }), {})
    )
}


client.on('ready', async () => {
    const [type,dateAStr,dateBStr] = process.argv.slice(2);

    if (!["vocal","messages"].includes(type))
        throw cmdError("Vous devez préciser s'il s'agit du vocal ou des messages");

    const dateA: Date = new Date(dateAStr);
    if (isNaN(dateA.getTime()))
        throw cmdError("Vous devez rentrer une première date valide");

    const dateB: null|Date = dateBStr === "never" ? null : new Date(dateBStr);
    if (dateB !== null && isNaN(dateB.getTime()))
        throw cmdError("Vous devez rentrer une seconde date valide");

    if (dateB !== null && dateB.getTime() <= dateA.getTime())
        throw cmdError("La seconde date doit forcément être supérieure à la première")

    const date = new Date();
    if (dateA.getTime() > date.getTime() || (dateB !== null && dateB.getTime() > date.getTime()))
        throw cmdError("Les dates doivent être inférieure à la date actuelle");
    
    const ids = process.argv.slice(5);
    
    const guilds = checkAndGetGivenGuilds(ids, client, cmdError);

    const statsConfigs: (null|IStatsConfig)[] = await Promise.all(
        guilds.map(({id}) =>
            StatsConfig.findOne({
                serverId: id
            })
        )
    )

    const activePeriodCol = type === 'messages' ? 'messagesActivePeriods' : 'vocalActivePeriods';

    const serversByErrorType: {[error: string]: Guild[]} = await generateServerErrors(activePeriodCol,dateA,guilds,statsConfigs)

    if (Object.keys(serversByErrorType).filter(error => error !== "none").length > 0)
        throw cmdError(
            "Voici les erreurs rencontés et les serveurs associés :\n\n"+
            Object.entries(serversByErrorType).map(([error,servers]) => (
                {
                    last_period_not_finished: "La période précedente n'est pas terminée",
                    dateA_less_than_end_period: "La première date doit être strictement supérieure à la fin du cycle précedent",
                    none: "Aucune erreur"
                }[error]+" : \n"+
                servers.map(({id,name}) => name+" ("+id+")").join("\n")
            )).join("\n\n")+"\n\n\n"
        )

    console.log(
        "Les serveurs suivants vont avoir une nouvelle période "+(type === "vocal" ? "vocale" : "de messages")+
        " "+(dateB === null ? "à partir du" : "du")+" "+showDate(extractDate(dateA), "fr")+" "+showTime(extractTime(dateA), "classic")+
        (dateB === null ? "" : " au "+showDate(extractDate(dateB), "fr")+" "+showTime(extractTime(dateB), "classic"))+" : \n"+
        guilds.map(({id,name}) => name+" ("+id+")").join("\n")
    )

    const activeCol = type === "messages" ? "listenMessages" : "listenVocal"

    await Promise.all(
        statsConfigs.map((statsConfig) => {

            if (statsConfig === null) {
                return StatsConfig.create({
                    [activeCol]: dateB === null,
                    [activePeriodCol]: [{
                        startDate: dateA,
                        ...(dateB === null ? {} : {endDate: dateB})
                    }]
                })
            }

            statsConfig[activeCol] = dateB === null;
            statsConfig[activePeriodCol] = [
                {
                    startDate: dateA,
                    ...(dateB === null ? {} : {endDate: dateB})
                },
                ...(
                    statsConfig[activePeriodCol] ?? []
                )
            ]

            return statsConfig.save()
        })
    )

    console.log("Périodes créées avec succès !");
    process.exit();
})