const express = require('express');
const cors = require('cors');
const { Queue, Job, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

// Redis connection setup - use service name in Docker
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true
});

// Import BullMQ queue instance
const imageQueue = require('./bull-config');

const app = express();

// Metrics storage
const metrics = {
    requests_total: 0,
    jobs_queued_total: 0,
    jobs_completed_total: 0,
    jobs_failed_total: 0,
    queue_size: 0,
    request_durations: [],
    start_time: Date.now()
};

// Middleware to track metrics
app.use((req, res, next) => {
    const start = Date.now();
    metrics.requests_total++;
    
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        metrics.request_durations.push(duration);
        // Keep only last 1000 requests
        if (metrics.request_durations.length > 1000) {
            metrics.request_durations = metrics.request_durations.slice(-1000);
        }
    });
    
    next();
});

// Middleware to allow cross-origin requests and parse JSON bodies
app.use(cors());
app.use(express.json());

// Queue events to track job completion
const queueEvents = new QueueEvents('image-processing', { connection });

queueEvents.on('completed', ({ jobId }) => {
    metrics.jobs_completed_total++;
    console.log(`Job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    metrics.jobs_failed_total++;
    console.log(`Job ${jobId} failed: ${failedReason}`);
});

// Update queue size periodically
setInterval(async () => {
    try {
        const waiting = await imageQueue.getWaiting();
        const active = await imageQueue.getActive();
        metrics.queue_size = waiting.length + active.length;
    } catch (error) {
        console.error('Error getting queue stats:', error);
    }
}, 5000);

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: (Date.now() - metrics.start_time) / 1000
    });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
    try {
        // Get current queue stats
        const waiting = await imageQueue.getWaiting();
        const active = await imageQueue.getActive();
        const completed = await imageQueue.getCompleted();
        const failed = await imageQueue.getFailed();
        
        // Calculate average request duration
        const avgDuration = metrics.request_durations.length > 0 
            ? metrics.request_durations.reduce((a, b) => a + b, 0) / metrics.request_durations.length 
            : 0;

        // Get memory usage
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

// Route to add a new image processing job to the queue
app.post('/add-job', async (req, res) => {
    const { imagePath, filter } = req.body;

    // Validate request body
    if (!imagePath || !filter) {
        return res.status(400).json({ error: 'Missing imagePath or filter' });
    }

    try {
        // Add job to the queue
        const job = await imageQueue.add('process-image', {
            imagePath,
            filter
        });

        metrics.jobs_queued_total++;
        
        // Respond with job ID
        return res.json({ message: 'Job queued', jobId: job.id });
    } catch (error) {
        console.error('Failed to add job:', error);
        return res.status(500).json({ error: 'Failed to queue job' });
    }
});

// Route to check the status of a specific job
app.get('/job/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch job by ID
        const job = await Job.fromId(imageQueue, id);
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        // Get job state, result, and failure reason if any
        const state = await job.getState();
        const result = await job.returnvalue || null;
        const failedReason = await job.failedReason || null;

        // Respond with job status information
        res.json({ id, state, result, failedReason });
    } catch (error) {
        console.error('Failed to get job status:', error);
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

// Route to get queue statistics
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

// Start the Express server
app.listen(3000, () => {
    console.log('Producer listening on port 3000');
    console.log('Metrics available at /metrics');
    console.log('Queue stats available at /stats');
});