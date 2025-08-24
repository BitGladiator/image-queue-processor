const { Queue } = require('bullmq');
const { default: IORedis } = require('ioredis');

// Use Redis service name instead of localhost in Docker
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true
});

const imageQueue = new Queue('image-processing', { connection });

module.exports = imageQueue;