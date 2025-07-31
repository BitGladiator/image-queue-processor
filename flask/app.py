from flask import Flask, render_template, request, redirect, url_for, send_from_directory
import os
import requests

app = Flask(__name__)

# Folder to store uploaded and processed images
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['RESULTS_FOLDER'] = 'results'

# Node.js server URL where image processing jobs are queued
NODE_API_URL = "http://localhost:3000"

# Home page route
@app.route('/')
def index():
    return render_template('index.html')

# Route to handle image uploads
@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return "No file uploaded", 400

    # Get the uploaded image and filter choice
    image = request.files['image']
    filter_type = request.form.get('filter', 'grayscale')

    # Create upload and result folders if they don't exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)

    # Save uploaded image to the uploads folder
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], image.filename)
    image.save(image_path)

    # Send image path and filter type to Node.js server to create a job
    response = requests.post(f"{NODE_API_URL}/add-job", json={
        "imagePath": os.path.abspath(image_path),
        "filter": filter_type
    })

    # If job creation is successful, redirect to job status page
    if response.status_code == 200:
        job_id = response.json().get("jobId")
        return redirect(url_for('status', job_id=job_id))
    else:
        return "Error sending job", 500

# Route to check the status of a processing job
@app.route('/status/<job_id>')
def status(job_id):
    r = requests.get(f"{NODE_API_URL}/job/{job_id}")
    if r.status_code != 200:
        return f"Job {job_id} not found", 404

    data = r.json()
    state = data.get("state")
    result = data.get("result") or {}

    # If job is completed and output path is available, show result
    if state == "completed" and "outputPath" in result:
        output_abs = result['outputPath']
        filename = os.path.basename(output_abs)
        return render_template('completed.html', job_id=job_id, filename=filename)
    elif state == "failed":
        # If job failed, show failure reason
        return render_template("failed.html", job_id=job_id, reason=data.get("failedReason", "Unknown"))

    # Otherwise, show the job's current state
    return render_template("status.html", job_id=job_id, state=state)

# Route to serve processed result images
@app.route('/results/<path:filename>')
def results_file(filename):
    return send_from_directory(app.config['RESULTS_FOLDER'], filename)
