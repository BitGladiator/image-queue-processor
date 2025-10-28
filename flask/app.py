from flask import Flask, request, render_template, redirect, url_for, send_from_directory, jsonify
import requests
import os
import uuid
import time
import threading
from datetime import datetime
from database import (
    init_db, add_processing_record, update_processing_status,
    get_all_history, get_history_by_filter, get_history_stats,
    delete_history_record, clear_old_records
)

app = Flask(__name__)


init_db()

metrics = {
    'requests_total': 0,
    'requests_duration_seconds': [],
    'active_jobs': 0,
    'completed_jobs': 0,
    'failed_jobs': 0,
    'start_time': time.time()
}

# Middleware to track metrics
@app.before_request
def before_request():
    request.start_time = time.time()
    metrics['requests_total'] += 1

@app.after_request
def after_request(response):
    if hasattr(request, 'start_time'):
        duration = time.time() - request.start_time
        metrics['requests_duration_seconds'].append(duration)
        if len(metrics['requests_duration_seconds']) > 1000:
            metrics['requests_duration_seconds'] = metrics['requests_duration_seconds'][-1000:]
    return response

UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
NODE_API_URL = os.getenv('NODE_API_URL', 'http://node:3000')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return redirect(url_for('index'))
    
    file = request.files['image']
    filter_type = request.form.get('filter', 'grayscale')
    
    if file.filename == '':
        return redirect(url_for('index'))
    
    file_extension = file.filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    
   
    file.save(file_path)

    try:
        response = requests.post(f'{NODE_API_URL}/add-job', json={
            'imagePath': f'/app/flask/uploads/{unique_filename}',
            'filter': filter_type
        })
        
        if response.status_code == 200:
            job_data = response.json()
            job_id = job_data['jobId']
            
           
            try:
                add_processing_record(
                    job_id=job_id,
                    original_filename=file.filename,
                    filter_type=filter_type,
                    input_path=file_path
                )
                
                metrics['active_jobs'] += 1
                return redirect(url_for('status', job_id=job_id))
            except Exception as db_error:
                print(f"Database error: {db_error}")
               
                return redirect(url_for('status', job_id=job_id))
        else:
            metrics['failed_jobs'] += 1
            return f"Failed to queue job: {response.text}", 500
            
    except requests.RequestException as e:
        metrics['failed_jobs'] += 1
        return f"Error communicating with processing service: {str(e)}", 500
@app.route('/status/<job_id>')
def status(job_id):
    try:
        response = requests.get(f'{NODE_API_URL}/job/{job_id}')
        
        if response.status_code == 200:
            job_status = response.json()
            
            if job_status['state'] == 'completed':
         
                result_file = f"{job_id}_output.jpg"
                output_path = os.path.join(RESULTS_FOLDER, result_file)
                update_processing_status(job_id, 'completed', output_path)
                
                metrics['active_jobs'] = max(0, metrics['active_jobs'] - 1)
                metrics['completed_jobs'] += 1
                return redirect(url_for('completed', job_id=job_id))
            elif job_status['state'] == 'failed':
               
                error_msg = job_status.get('failedReason', 'Unknown error')
                update_processing_status(job_id, 'failed', error_message=error_msg)
                
                metrics['active_jobs'] = max(0, metrics['active_jobs'] - 1)
                metrics['failed_jobs'] += 1
                return render_template('failed.html', 
                                     job_id=job_id, 
                                     error=error_msg)
            else:
                return render_template('status.html', 
                                     job_id=job_id, 
                                     status=job_status,
                                     state=job_status.get('state', 'unknown'))
        else:
            return f"Failed to get job status: {response.text}", 500
            
    except requests.RequestException as e:
        return f"Error getting job status: {str(e)}", 500

@app.route('/completed/<job_id>')
def completed(job_id):
    result_file = f"{job_id}_output.jpg"
    result_path = os.path.join(RESULTS_FOLDER, result_file)
    
    if os.path.exists(result_path):
        return render_template('completed.html', 
                             job_id=job_id, 
                             result_file=result_file)
    else:
        return "Result file not found", 404

@app.route('/results/<filename>')
def download_file(filename):
    return send_from_directory(RESULTS_FOLDER, filename)

@app.route('/history')
def history():
    """Display processing history"""
    page = request.args.get('page', 1, type=int)
    filter_type = request.args.get('filter', None)
    limit = 20
    offset = (page - 1) * limit
    
    if filter_type:
        records = get_history_by_filter(filter_type, limit)
    else:
        records = get_all_history(limit, offset)
    
    stats = get_history_stats()
    
    return render_template('history.html', 
                         records=records, 
                         stats=stats,
                         page=page,
                         filter_type=filter_type)

@app.route('/history/api')
def history_api():
  
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    filter_type = request.args.get('filter', None)
    
    if filter_type:
        records = get_history_by_filter(filter_type, limit)
    else:
        records = get_all_history(limit, offset)
    
    return jsonify(records)

@app.route('/history/stats')
def history_stats():
  
    stats = get_history_stats()
    return jsonify(stats)

@app.route('/history/delete/<job_id>', methods=['POST'])
def delete_history(job_id):
   
    success = delete_history_record(job_id)
    if success:
        return jsonify({'success': True, 'message': 'Record deleted'})
    else:
        return jsonify({'success': False, 'message': 'Record not found'}), 404

@app.route('/history/clear', methods=['POST'])
def clear_history():
   
    days = request.json.get('days', 30)
    count = clear_old_records(days)
    return jsonify({'success': True, 'deleted': count})

@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'uptime': time.time() - metrics['start_time']
    })

@app.route('/metrics')
def prometheus_metrics():
   
    avg_duration = 0
    if metrics['requests_duration_seconds']:
        avg_duration = sum(metrics['requests_duration_seconds']) / len(metrics['requests_duration_seconds'])
    
    metrics_text = f"""# HELP flask_requests_total Total number of HTTP requests
# TYPE flask_requests_total counter
flask_requests_total {metrics['requests_total']}

# HELP flask_request_duration_seconds Average request duration
# TYPE flask_request_duration_seconds gauge
flask_request_duration_seconds {avg_duration}

# HELP flask_active_jobs Currently active image processing jobs
# TYPE flask_active_jobs gauge
flask_active_jobs {metrics['active_jobs']}

# HELP flask_completed_jobs_total Total completed jobs
# TYPE flask_completed_jobs_total counter
flask_completed_jobs_total {metrics['completed_jobs']}

# HELP flask_failed_jobs_total Total failed jobs
# TYPE flask_failed_jobs_total counter
flask_failed_jobs_total {metrics['failed_jobs']}

# HELP flask_uptime_seconds Application uptime in seconds
# TYPE flask_uptime_seconds counter
flask_uptime_seconds {time.time() - metrics['start_time']}
"""
    
    return metrics_text, 200, {'Content-Type': 'text/plain; charset=utf-8'}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)