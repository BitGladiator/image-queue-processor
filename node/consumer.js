const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { exec } = require('child_process');
const path = require('path');

const connection = new IORedis({
    maxRetriesPerRequest: null
});

const worker = new Worker('image-processing', async job => {
    const { imagePath, filter } = job.data;
    const outputPath = path.join(__dirname, '../flask/results', `${job.id}_output.jpg`);

    return new Promise((resolve, reject) => {
        const processorPath = path.join(__dirname, '../cpp/build/processor');
        const cppCommand = `"${processorPath}" "${imagePath}" "${outputPath}" "${filter}"`;

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