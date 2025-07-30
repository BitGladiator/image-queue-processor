const express = require('express');
const cors = require('cors');
const {Queue,Job,QueueEvents} = require('bullmq')
const IORedis = require('ioredis')
const connection = new IORedis({
    maxRetriesPerRequest: null
});
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
app.get('/job/:id',async(req,res)=>{
    const {id} = req.params;
    const job = await Job.fromId(imageQueue,id);
    if(!job){
        return res.status(404).json({error:"Job not found"})
    }
    const state = await job.getState();
    const result = await job.returnvalue || null;
    const failedReason = await job.failedReason || null;
    res.json({id,state,result,failedReason});
})
app.listen(3000, () => {
    console.log('Producer listening on port 3000');
});