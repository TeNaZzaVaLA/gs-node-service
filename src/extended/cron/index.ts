import cron from 'node-cron';

import { GSActor, GSCloudEvent } from '../../core/interfaces';
import { logger } from '../../logger';

export default function (
  route: string,
  processEvent: (event: GSCloudEvent) => Promise<any>
) {
  let [schedule, timezone] = route.split('.cron.');
  logger.info('registering cron handler %s %s', schedule, timezone);
  cron.schedule(
    schedule,
    async () => {
      logger.info(`Running a job for ${route}`);
      const event = new GSCloudEvent(
        'id',
        route,
        new Date(),
        'cron',
        '1.0',
        {},
        'cron',
        new GSActor('user'),
        {}
      );

      processEvent(event);
    },
    {
      timezone,
    }
  );
}
