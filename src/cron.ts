import { CronJob } from 'cron';
import config from 'config';

const cron = new CronJob(config.get('cronJobExpression'), () => {
    console.log('Executing cron job once every hour');
});

export { cron };