from flask import Flask, render_template, request, redirect, url_for
import os
import requests
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
NODE_API_URL = "http://localhost:3000/add-job" 
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return "No file uploaded", 400
    
    image = request.files['image']
    filter_type = request.form.get('filter', 'grayscale')
    #Save the uploaded image
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], image.filename)
    image.save(image_path)
    #Send the image path and filter type to the Node.js server
    response = requests.post(NODE_API_URL, json={
        "imagePath": image_path,
        "filter": filter_type
    })
    if response.status_code == 200:
        job_id = response.json().get("jobId")
        return redirect(url_for('status', job_id=job_id))
    else:
        return "Error sending job", 500

@app.route('/status/<job_id>')
def status(job_id):
    return f"Your job is queued with ID: {job_id}"     

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(port=5000, debug=True)