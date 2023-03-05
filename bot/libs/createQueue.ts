interface IQueue<IMessageData, IState> {
    queue: IMessageData[],
    state: null|IState
}

type IQueueFunction<IMessageData,IState> = (message: IMessageData, state: null|IState) => IState|Promise<IState>

async function executeQueue<IMessageData = any, IState = any>(
    func: IQueueFunction<IMessageData, IState>,
    queueObj: IQueue<IMessageData, IState>
) {
    while (queueObj.queue.length > 0) {
        queueObj.state = await func(queueObj.queue[0],queueObj.state)
        queueObj.queue.shift()
    }
}

export default function createQueue<IMessageData = any, IState = any>(
    func: IQueueFunction<IMessageData, IState>,
    getQueueKey: null|((message: IMessageData) => string|Promise<string>) = null    
) {
    const queues: {[key: string]: IQueue<IMessageData, IState>} = {};

    process.on('message', async (message: IMessageData) => {
        const queueKey = getQueueKey === null ? "default" : await getQueueKey(message);
        if (queues[queueKey] === undefined)
            queues[queueKey] = {queue: [], state: null};
        
        queues[queueKey].queue.push(message);

        if (queues[queueKey].queue.length === 1)
            await executeQueue(func, queues[queueKey])
    })
}