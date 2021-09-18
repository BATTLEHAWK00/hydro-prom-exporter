import client from 'prom-client';

const bus = global.Hydro.service.bus;

const reqCounterGauge = new client.Counter({
    name: 'hydrooj_reqcount',
    help: 'shows request counts of hydrooj',
});

const judgeGauge = new client.Counter({
    name: 'hydrooj_judgecount',
    help: 'shows judge counts of hydrooj',
})

const registerGauge = new client.Counter({
    name: 'hydrooj_regcount',
    help: 'shows register counts of hydrooj',
})

export class workerMetricsCollector{
    private registry: client.Registry = new client.Registry();
    private instanceid: string = process.env.NODE_APP_INSTANCE;
    constructor(){
        this.instanceid = process.env.NODE_APP_INSTANCE
        this.registry.setDefaultLabels({instanceid:this.instanceid})
        this.registerMetrics()
        client.collectDefaultMetrics({register:this.registry})
        bus.on('handler/create', () => reqCounterGauge.inc())
        bus.on('record/judge', async () => judgeGauge.inc());
        bus.on('handler/finish/UserRegister', async () => registerGauge.inc());
    }

    private registerMetrics(){
        this.registry.registerMetric(reqCounterGauge)
    }

    public async getMetrics(){
        return await this.registry.getMetricsAsJSON()
    }

    public getInstanceID(){
        return this.instanceid
    }
}