const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test the C++ processor
const processorPath = path.join(__dirname, 'cpp/build/processor');
const testInput = '/app/flask/uploads/badge.png';  // Adjust this path
const testOutput = '/app/flask/results/test_output.jpg';

console.log('Testing C++ processor...');
console.log(`Processor path: ${processorPath}`);
console.log(`Processor exists: ${fs.existsSync(processorPath)}`);

// Ensure output directory exists
const outputDir = path.dirname(testOutput);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
}

console.log(`Input exists: ${fs.existsSync(testInput)}`);
console.log(`Output directory exists: ${fs.existsSync(outputDir)}`);

const command = `${processorPath} ${testInput} ${testOutput} grayscale`;
console.log(`Running: ${command}`);

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
    }
    if (stderr) {
        console.error(`Stderr: ${stderr}`);
    }
    if (stdout) {
        console.log(`Stdout: ${stdout}`);
    }
    
    console.log(`Output file created: ${fs.existsSync(testOutput)}`);
});