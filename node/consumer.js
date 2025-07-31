const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { exec } = require('child_process');
const path = require('path');

// Redis connection for BullMQ
const connection = new IORedis({
    maxRetriesPerRequest: null
});

// Create a worker to process jobs from the 'image-processing' queue
const worker = new Worker('image-processing', async job => {
    const { imagePath, filter } = job.data;

    // Set the output path for the processed image
    const outputPath = path.join(__dirname, '../flask/results', `${job.id}_output.jpg`);

    return new Promise((resolve, reject) => {
        // Path to the compiled C++ image processor
        const processorPath = path.join(__dirname, '../cpp/build/processor');

        // Command to execute the C++ program with image path, output path, and filter type
        const cppCommand = `"${processorPath}" "${imagePath}" "${outputPath}" "${filter}"`;

        // Run the C++ program
        exec(cppCommand, (error, stdout, stderr) => {
            if (error) {
                // Log error and reject the job if it fails
                console.error(`Job ${job.id} failed: ${stderr || error.message}`);
                return reject(error);
            }

            // Log success and resolve with the output path
            console.log(`Job ${job.id} completed: ${outputPath}`);
            resolve({ outputPath });
        });
    });
}, { connection });

// Event: Job completed
worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} finished:`, result.outputPath);
});

// Event: Job failed
worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed: ${err.message}`);
});
