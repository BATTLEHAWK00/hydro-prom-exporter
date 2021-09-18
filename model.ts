const db = global.Hydro.service.db;
const bus = global.Hydro.service.bus;
const taskColl = db.collection('task')

export let startTime = null

export async function getJudgeTaskCount() {
    const res = await taskColl.aggregate([
        { $match : { type : { $eq : 'judge' } } },
        { $group : {_id : "taskCount", value : {$sum : 1}}}
    ]).toArray()
    return res.length?res[0].value:0
}

bus.once('app/started', () => {
    if (process.env.NODE_APP_INSTANCE !== '0') return;
    startTime=Date.now()
})

