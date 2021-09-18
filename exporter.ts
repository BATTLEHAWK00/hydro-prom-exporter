import os from 'os';
import client, { AggregatorRegistry, Registry } from 'prom-client';
import { workerMetricsCollector } from './worker_collecter';
import {startTime,getJudgeTaskCount} from './model'
import { sleep } from './utils';

const bus = global.Hydro.service.bus;
const Logger = global.Hydro.Logger;
const system = global.Hydro.model.system;

const logger = new Logger('hydroExporter');

const metricsTotal={}
const masterRegistry = new Registry()
const collect_rate = system.get('hydro-prom-exporter.collect_rate')

const serverTotalGauge = new client.Gauge({
    name: 'hydrooj_server_total',
    help: 'shows basic information of hydro server',
    labelNames: ['id'],
    async collect() {
        this.set({id:'serverStartTime'},startTime?Date.now()-startTime:0);
        this.set({id:'totalMemory'},os.totalmem());
        this.set({id:'freeMemory'},os.freemem());
        const loadAvgs = os.loadavg()
        this.set({id:'loadAvg1'},loadAvgs[0]);
        this.set({id:'loadAvg5'},loadAvgs[1]);
        this.set({id:'loadAvg15'},loadAvgs[2]);
      },
});

const cpuGauge = new client.Gauge({
    name: 'hydrooj_cpu',
    help: 'shows cpu information of the server',
    labelNames: ['id','attr'],
    async collect() {
        const cpuInfo = os.cpus()
        const cpuTimesMode = ['user','nice','sys','idle','irq']
        for (let i = 0; i < cpuInfo.length; i++) {
            const cpu = cpuInfo[i];
            this.set({id:i.toString(),attr:'speed'},cpu.speed);
            cpuTimesMode.forEach((mode)=>this.set({id:i.toString(),attr:`time_${mode}`},cpu.times[mode]))
        }
    },
});

const hydroGauge = new client.Gauge({
    name: 'hydrooj_backend',
    help: 'shows statistics of hydrooj',
    labelNames: ['id'],
    async collect() {
        this.set({id:'pendingJudges'},await getJudgeTaskCount());
    },
});

export const metricsGauge = new client.Counter({
    name: 'metrics_reqcount',
    help: 'shows reqcount when requesting /metrics',
});

const masterMetricsList=[
    serverTotalGauge,
    cpuGauge,
    hydroGauge,
    metricsGauge
]

masterMetricsList.forEach((metrics)=>masterRegistry.registerMetric(metrics))

export async function getMetrics() {
    const metricsList=[]
    for (const key in metricsTotal) {
        metricsList.push(metricsTotal[key])
    }
    const reg = AggregatorRegistry.aggregate(metricsList)
    return await reg.metrics()
}

function initGlobalTimer() {
    setInterval(async ()=>{
        metricsTotal['master'] = await masterRegistry.getMetricsAsJSON()
        bus.broadcast('metrics_exporter/metrics/collect');
    },5000*collect_rate)
}

async function initSlaveNode() {
    const metricsCollector = new workerMetricsCollector()
    bus.on('metrics_exporter/metrics/collect', async () => {
        await sleep(Math.floor(Math.random()*5000*collect_rate))
        const nodeinfo={
            instanceid:metricsCollector.getInstanceID(),
            metrics:await metricsCollector.getMetrics()
        }
        bus.broadcast('metrics_exporter/metrics/receive',nodeinfo)
    });
}

async function initMasterNode() {
    logger.info("Listening for worker response...")
    bus.on('metrics_exporter/metrics/receive',async (nodeinfo) => {
        const nodeKey = `node_${nodeinfo.instanceid}`
        if (!metricsTotal[nodeKey]) logger.info(`instance${nodeinfo.instanceid} connected.`)
        metricsTotal[nodeKey]=nodeinfo.metrics
    });
    initGlobalTimer()
}

bus.once('app/started', async () => {
    if (process.env.NODE_APP_INSTANCE === '0'){
        await initMasterNode()
    }
    await initSlaveNode()
});