async function executeQueue<IMessageData = any>(
    func: (message: IMessageData) => any,
    queue: IMessageData[]
) {
    while (queue.length > 0) {
        await func(queue[0])
        queue.shift()
    }
}

export default function createQueue<IMessageData = any>(
    func: (message: IMessageData) => any,
    getQueueKey: null|((message: IMessageData) => string|Promise<string>) = null    
) {
    const queues: {[key: string]: IMessageData[]} = {};

    process.on('message', async (message: IMessageData) => {
        const queueKey = getQueueKey === null ? "default" : await getQueueKey(message);
        if (queues[queueKey] === undefined)
            queues[queueKey] = [];
        
        queues[queueKey].push(message);

        if (queues[queueKey].length === 1)
            await executeQueue(func, queues[queueKey])
    })
}