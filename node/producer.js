const express = require('express');
const cors = require('cors');
const { Queue, Job, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

// Redis connection setup
const connection = new IORedis({
    maxRetriesPerRequest: null
});

// Import BullMQ queue instance
const imageQueue = require('./bull-config');

const app = express();

// Middleware to allow cross-origin requests and parse JSON bodies
app.use(cors());
app.use(express.json());

// Route to add a new image processing job to the queue
app.post('/add-job', async (req, res) => {
    const { imagePath, filter } = req.body;

    // Validate request body
    if (!imagePath || !filter) {
        return res.status(400).json({ error: 'Missing imagePath or filter' });
    }

    // Add job to the queue
    const job = await imageQueue.add('process-image', {
        imagePath,
        filter
    });

    // Respond with job ID
    return res.json({ message: 'Job queued', jobId: job.id });
});

// Route to check the status of a specific job
app.get('/job/:id', async (req, res) => {
    const { id } = req.params;

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
});

// Start the Express server
app.listen(3000, () => {
    console.log('Producer listening on port 3000');
});
