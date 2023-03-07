import IReportedData from "../interfaces/IReportedDatas"
import { ISetTimeoutOrInterval, returnProcessError, setTimeoutCatchProcess, setIntervalCatchProcess } from "../logging/catchers"
import CustomError from "../logging/CustomError"

interface IQueue<IMessageData, IState> {
    queue: IMessageData[],
    state: null|IState
}

type IQueueFunction<IMessageData,IState> = (message: IMessageData, state: null|IState, args: {setTimeout: ISetTimeoutOrInterval, setInterval: ISetTimeoutOrInterval}) => IState|Promise<IState>

async function executeQueue<IMessageData = any, IState = any>(
    func: IQueueFunction<IMessageData, IState>,
    queueObj: IQueue<IMessageData, IState>
) {
    while (queueObj.queue.length > 0) {
        const errorsData: IReportedData = {from: "queue", queueMessageData: queueObj.queue[0], queueMessageState: queueObj.state}
        try {
            queueObj.state = await func(
                queueObj.queue[0],
                queueObj.state,
                {
                    setTimeout: setTimeoutCatchProcess(errorsData),
                    setInterval: setIntervalCatchProcess(errorsData)
                }
            )
        } catch (e) {
            if (process.send === undefined)
                return;
            process.send(returnProcessError(new CustomError(<Error>e, errorsData)));
        }
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