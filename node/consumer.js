const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { exec } = require('child_process');
const path = require('path');

// Redis connection for BullMQ - use service name in Docker
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true
});

// Create a worker to process jobs from the 'image-processing' queue
const worker = new Worker('image-processing', async job => {
    const { imagePath, filter } = job.data;

    // Set the output path for the processed image - use the mounted volume path
    const outputPath = path.join(__dirname, 'flask/results', `${job.id}_output.jpg`);
    
    // Ensure the results directory exists
    const fs = require('fs');
    const resultsDir = path.dirname(outputPath);
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
        console.log(`Created results directory: ${resultsDir}`);
    }

    return new Promise((resolve, reject) => {
        // Path to the compiled C++ image processor
        const processorPath = path.join(__dirname, 'cpp/build/processor');
        
        // Debug: Check if processor exists
        const fs = require('fs');
        console.log(`Looking for processor at: ${processorPath}`);
        console.log(`Processor exists: ${fs.existsSync(processorPath)}`);
        
        if (!fs.existsSync(processorPath)) {
            console.error(`Processor not found at ${processorPath}`);
            console.log('Contents of cpp directory:');
            try {
                const cppDir = path.join(__dirname, 'cpp');
                if (fs.existsSync(cppDir)) {
                    console.log(fs.readdirSync(cppDir));
                    const buildDir = path.join(cppDir, 'build');
                    if (fs.existsSync(buildDir)) {
                        console.log('Contents of build directory:');
                        console.log(fs.readdirSync(buildDir));
                    }
                }
            } catch (err) {
                console.error('Error checking directories:', err);
            }
            return reject(new Error(`Processor executable not found at ${processorPath}`));
        }

        // Command to execute the C++ program with image path, output path, and filter type
        const cppCommand = `"${processorPath}" "${imagePath}" "${outputPath}" "${filter}"`;
        
        console.log(`Executing: ${cppCommand}`);
        console.log(`Input file exists: ${fs.existsSync(imagePath)}`);
        console.log(`Output directory exists: ${fs.existsSync(path.dirname(outputPath))}`);
        console.log(`Output directory writable: ${fs.accessSync(path.dirname(outputPath), fs.constants.W_OK) === undefined ? 'yes' : 'no'}`);

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

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    process.exit(0);
});