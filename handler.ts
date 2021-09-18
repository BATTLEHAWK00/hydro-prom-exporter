import Koa from 'koa'
import auth from 'koa-basic-auth'
import { getMetrics, metricsGauge } from './exporter';

const bus = global.Hydro.service.bus;
const system = global.Hydro.model.system;

bus.once('app/started', () => {
    if (process.env.NODE_APP_INSTANCE !== '0') return;
    const [
      auth_name, auth_password,
      listen_port
    ] = system.getMany([
      'hydro-prom-exporter.auth_name', 'hydro-prom-exporter.auth_password',
      'hydro-prom-exporter.listen_port'
    ])
    const app = new Koa();
    app.use(async (ctx, next) => {
        try {
          await next();
        } catch (err) {
          if (401 == err.status) {
            ctx.status = 401;
            ctx.set('WWW-Authenticate', 'Basic');
          } else {
            throw err;
          }
        }
      });
    app.use(auth({ name: auth_name, pass: auth_password }));
    app.use(async ctx => {
        if (ctx.path==='/metrics') {
            metricsGauge.inc()
            ctx.body = await getMetrics()
            return
        }
        ctx.status=403
    });
    app.listen(listen_port);
});

