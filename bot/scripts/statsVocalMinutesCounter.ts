async function addMinute(serverId: string) {
    if (process.send === undefined)
        return;
    process.send({tag: "vocalStats", key: serverId, data: {type: "vocalMinutes", serverId}})
}

setTimeout(() => {
    const [serverId] = process.argv.slice(2);

    addMinute(serverId);

    setInterval(() => addMinute(serverId), 60*1000)
}, 50*1000)