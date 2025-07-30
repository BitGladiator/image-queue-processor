const express = require('express');
const cors = require('cors');
const imageQueue = require('./bull-config');
const app = express();
app.use(cors());
app.use(express.json());
app.post('/add-job', async (req, res) => {
    const { imagePath, filter } = req.body;
    if (!imagePath || !filter) {
        return res.status(400).json({ error: 'Missing imagePath or filter' });
    }
    const job = await imageQueue.add('process-image', {
        imagePath,
        filter
    });
    return res.json({ message: 'Job queued', jobId: job.id });
});
app.listen(3000, () => {
    console.log('Producer listening on port 3000');
});