const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { exec } = require('child_process');
const path = require('path');
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true
});
const worker = new Worker('image-processing', async job => {
    const { imagePath, filter, intensity = 50 } = job.data; 

    const outputPath = path.join(__dirname, 'flask/results', `${job.id}_output.jpg`);
    
    const fs = require('fs');
    const resultsDir = path.dirname(outputPath);
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
        console.log(`Created results directory: ${resultsDir}`);
    }

    return new Promise((resolve, reject) => {
        const processorPath = path.join(__dirname, 'cpp/build/processor');
        
        console.log(`Looking for processor at: ${processorPath}`);
        
        if (!fs.existsSync(processorPath)) {
            console.error(`Processor not found at ${processorPath}`);
            return reject(new Error(`Processor executable not found at ${processorPath}`));
        }
        const cppCommand = `"${processorPath}" "${imagePath}" "${outputPath}" "${filter}" "${intensity}"`;
        
        console.log(`Executing: ${cppCommand}`);

        exec(cppCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Job ${job.id} failed: ${stderr || error.message}`);
                return reject(error);
            }

            console.log(`Job ${job.id} completed: ${outputPath}`);
            resolve({ outputPath });
        });
    });
}, { connection });

worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} finished:`, result.outputPath);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed: ${err.message}`);
});

process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    process.exit(0);
});