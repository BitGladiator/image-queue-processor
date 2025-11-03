import sqlite3
import os
from datetime import datetime
from contextlib import contextmanager

DB_PATH = '/app/database/processing_history.db'

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS processing_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT UNIQUE NOT NULL,
            original_filename TEXT NOT NULL,
            filter_type TEXT NOT NULL,
            intensity INTEGER DEFAULT 50,
            status TEXT NOT NULL,
            input_path TEXT NOT NULL,
            output_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            error_message TEXT
        )
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_created_at 
        ON processing_history(created_at DESC)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_job_id 
        ON processing_history(job_id)
    ''')
    
    conn.commit()
    conn.close()
    print("Database initialized successfully")

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def add_processing_record(job_id, original_filename, filter_type, input_path):
      with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO processing_history 
                (job_id, original_filename, filter_type, intensity, status, input_path)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (job_id, original_filename, filter_type, intensity, 'pending', input_path))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            conn.rollback()
            cursor.execute('''
                UPDATE processing_history 
                SET original_filename = ?, filter_type = ?, status = ?, input_path = ?, created_at = CURRENT_TIMESTAMP
                WHERE job_id = ?
            ''', (original_filename, filter_type, 'pending', input_path, job_id))
            conn.commit()
            return cursor.lastrowid

def update_processing_status(job_id, status, output_path=None, error_message=None):
    with get_db() as conn:
        cursor = conn.cursor()
        if status == 'completed':
            cursor.execute('''
                UPDATE processing_history 
                SET status = ?, output_path = ?, completed_at = ?
                WHERE job_id = ?
            ''', (status, output_path, datetime.now(), job_id))
        else:
            cursor.execute('''
                UPDATE processing_history 
                SET status = ?, error_message = ?, completed_at = ?
                WHERE job_id = ?
            ''', (status, error_message, datetime.now(), job_id))
        conn.commit()

def get_all_history(limit=50, offset=0):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM processing_history 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ''', (limit, offset))
        return [dict(row) for row in cursor.fetchall()]

def get_history_by_filter(filter_type, limit=50):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM processing_history 
            WHERE filter_type = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        ''', (filter_type, limit))
        return [dict(row) for row in cursor.fetchall()]

def get_history_stats():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) as total FROM processing_history')
        total = cursor.fetchone()['total']
        cursor.execute("SELECT COUNT(*) as completed FROM processing_history WHERE status = 'completed'")
        completed = cursor.fetchone()['completed']
        cursor.execute("SELECT COUNT(*) as failed FROM processing_history WHERE status = 'failed'")
        failed = cursor.fetchone()['failed']
        cursor.execute("SELECT COUNT(*) as pending FROM processing_history WHERE status = 'pending'")
        pending = cursor.fetchone()['pending']
        cursor.execute('''
            SELECT filter_type, COUNT(*) as count 
            FROM processing_history 
            GROUP BY filter_type
        ''')
        by_filter = {row['filter_type']: row['count'] for row in cursor.fetchall()}
        
        return {
            'total': total,
            'completed': completed,
            'failed': failed,
            'pending': pending,
            'by_filter': by_filter
        }
def delete_history_record(job_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM processing_history WHERE job_id = ?', (job_id,))
        conn.commit()
        return cursor.rowcount > 0

def clear_old_records(days=30):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            DELETE FROM processing_history 
            WHERE created_at < datetime('now', '-' || ? || ' days')
        ''', (days,))
        conn.commit()
        return cursor.rowcount