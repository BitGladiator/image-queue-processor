const express = require('express');
const cors = require('cors');
const { Queue, Job, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true
});
const imageQueue = require('./bull-config');

const app = express();
const metrics = {
    requests_total: 0,
    jobs_queued_total: 0,
    jobs_completed_total: 0,
    jobs_failed_total: 0,
    queue_size: 0,
    request_durations: [],
    start_time: Date.now()
};
app.use((req, res, next) => {
    const start = Date.now();
    metrics.requests_total++;
    
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        metrics.request_durations.push(duration);
        if (metrics.request_durations.length > 1000) {
            metrics.request_durations = metrics.request_durations.slice(-1000);
        }
    });
    
    next();
});
app.use(cors());
app.use(express.json());
const queueEvents = new QueueEvents('image-processing', { connection });

queueEvents.on('completed', ({ jobId }) => {
    metrics.jobs_completed_total++;
    console.log(`Job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    metrics.jobs_failed_total++;
    console.log(`Job ${jobId} failed: ${failedReason}`);
});
setInterval(async () => {
    try {
        const waiting = await imageQueue.getWaiting();
        const active = await imageQueue.getActive();
        metrics.queue_size = waiting.length + active.length;
    } catch (error) {
        console.error('Error getting queue stats:', error);
    }
}, 5000);

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: (Date.now() - metrics.start_time) / 1000
    });
});
app.get('/metrics', async (req, res) => {
    try {
        const waiting = await imageQueue.getWaiting();
        const active = await imageQueue.getActive();
        const completed = await imageQueue.getCompleted();
        const failed = await imageQueue.getFailed();
        
        const avgDuration = metrics.request_durations.length > 0 
            ? metrics.request_durations.reduce((a, b) => a + b, 0) / metrics.request_durations.length 
            : 0;

        const memUsage = process.memoryUsage();
        const uptime = (Date.now() - metrics.start_time) / 1000;

        const metricsText = `# HELP node_requests_total Total number of HTTP requests
# TYPE node_requests_total counter
node_requests_total ${metrics.requests_total}

# HELP node_request_duration_seconds Average request duration
# TYPE node_request_duration_seconds gauge
node_request_duration_seconds ${avgDuration}

# HELP node_jobs_queued_total Total number of jobs queued
# TYPE node_jobs_queued_total counter
node_jobs_queued_total ${metrics.jobs_queued_total}

# HELP node_jobs_completed_total Total number of completed jobs
# TYPE node_jobs_completed_total counter
node_jobs_completed_total ${metrics.jobs_completed_total}

# HELP node_jobs_failed_total Total number of failed jobs
# TYPE node_jobs_failed_total counter
node_jobs_failed_total ${metrics.jobs_failed_total}

# HELP node_queue_waiting Number of jobs waiting in queue
# TYPE node_queue_waiting gauge
node_queue_waiting ${waiting.length}

# HELP node_queue_active Number of active jobs being processed
# TYPE node_queue_active gauge
node_queue_active ${active.length}

# HELP node_queue_completed Number of completed jobs in queue
# TYPE node_queue_completed gauge
node_queue_completed ${completed.length}

# HELP node_queue_failed Number of failed jobs in queue
# TYPE node_queue_failed gauge
node_queue_failed ${failed.length}

# HELP node_uptime_seconds Application uptime in seconds
# TYPE node_uptime_seconds counter
node_uptime_seconds ${uptime}

# HELP node_memory_usage_bytes Memory usage in bytes
# TYPE node_memory_usage_bytes gauge
node_memory_usage_bytes ${memUsage.heapUsed}

# HELP node_memory_heap_total_bytes Total heap memory in bytes
# TYPE node_memory_heap_total_bytes gauge
node_memory_heap_total_bytes ${memUsage.heapTotal}
`;

        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(metricsText);
    } catch (error) {
        console.error('Error generating metrics:', error);
        res.status(500).send('Error generating metrics');
    }
});
app.post('/add-job', async (req, res) => {
    const { imagePath, filter } = req.body;
    if (!imagePath || !filter) {
        return res.status(400).json({ error: 'Missing imagePath or filter' });
    }

    try {
        const job = await imageQueue.add('process-image', {
            imagePath,
            filter
        });

        metrics.jobs_queued_total++;
        return res.json({ message: 'Job queued', jobId: job.id });
    } catch (error) {
        console.error('Failed to add job:', error);
        return res.status(500).json({ error: 'Failed to queue job' });
    }
});
app.get('/job/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const job = await Job.fromId(imageQueue, id);
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }
        const state = await job.getState();
        const result = await job.returnvalue || null;
        const failedReason = await job.failedReason || null;
        res.json({ id, state, result, failedReason });
    } catch (error) {
        console.error('Failed to get job status:', error);
        res.status(500).json({ error: 'Failed to get job status' });
    }
});
app.get('/stats', async (req, res) => {
    try {
        const waiting = await imageQueue.getWaiting();
        const active = await imageQueue.getActive();
        const completed = await imageQueue.getCompleted();
        const failed = await imageQueue.getFailed();
        
        res.json({
            queue: {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length
            },
            metrics: {
                requests_total: metrics.requests_total,
                jobs_queued_total: metrics.jobs_queued_total,
                jobs_completed_total: metrics.jobs_completed_total,
                jobs_failed_total: metrics.jobs_failed_total,
                uptime: (Date.now() - metrics.start_time) / 1000
            }
        });
    } catch (error) {
        console.error('Failed to get queue stats:', error);
        res.status(500).json({ error: 'Failed to get queue stats' });
    }
});
app.listen(3000, () => {
    console.log('Producer listening on port 3000');
    console.log('Metrics available at /metrics');
    console.log('Queue stats available at /stats');
});