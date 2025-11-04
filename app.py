import os
import csv
import time
import warnings
from datetime import datetime
import threading

import numpy as np
import pandas as pd
import firebase_admin
from firebase_admin import credentials, db

from flask import Flask, jsonify, render_template, request

# --- Suppress Warnings ---
warnings.filterwarnings('ignore')

# --- Flask App Initialization ---
app = Flask(__name__)

# --- Global Variables ---
is_logging = False
log_file_path = "fitbit_data_log.csv"

# Thread-safe data store for the latest data packet
latest_data_packet = {}
data_lock = threading.Lock()
last_known_timestamp = None # To track if data is new

# --- Feature and Model Definitions ---
TARGET_FEATURES = [
    'hr', 'ibi', 'spo2', 'skinTemp', 'eda', 'ecg', 'bvp', 'ppgGreen',
    'ppgRed', 'ppgIr', 'accX', 'accY', 'accZ', 'respirationRate', 'timestamp' # Added timestamp
]
MODEL_SCORES_KEYS = [
    "SleepQualityIndex", "PsychosomaticStressIndex", "CognitiveLoadScore",
    "CardiovascularHealthIndex", "EmotionalVitalityScore"
]

# ================================
# 1. FIREBASE INITIALIZATION
# ================================
try:
    cred = credentials.Certificate("servicekey.json")
    firebase_admin.initialize_app(cred, {
        "databaseURL": "https://healthdatasync-b0458-default-rtdb.asia-southeast1.firebasedatabase.app/"
    })
    ref = db.reference("/health_data_stream")
    print("Firebase Admin SDK initialized successfully.")
except Exception as e:
    print(f"ERROR: Could not initialize Firebase. Is 'servicekey.json' present? \n{e}")
    ref = None

# ================================
# 2. HELPER FUNCTION TO PROCESS RECORDS
# ================================
# ================================
# 2. HELPER FUNCTION TO PROCESS RECORDS
# ================================
# ================================
# 2. HELPER FUNCTION TO PROCESS RECORDS
# ================================
def process_record(record_dict):
    """
    Cleans a single data record from Firebase.
    Handles 'ibi' array and ensures all keys are present.
    """
    processed = {}
    
    # --- First pass: Process all values as normal ---
    for key in TARGET_FEATURES:
        value = record_dict.get(key, 0)
        
        if key == 'ibi':
            if isinstance(value, list) and len(value) > 0:
                processed[key] = float(value[0])
            elif isinstance(value, list):
                processed[key] = 0.0
            else:
                processed[key] = float(value)
        elif pd.isna(value):
            processed[key] = 0.0
        else:
            try:
                processed[key] = float(value)
            except (ValueError, TypeError):
                processed[key] = 0.0

    # --- NEW: Apply the zero HR rule ---
    # If heart rate is 0, zero out other physiological sensors
    if processed.get('hr', 0) == 0:
        # Keys to PRESERVE (keep their values)
        preserve_keys = {'hr', 'accX', 'accY', 'accZ', 'timestamp'}
        
        for key in processed:
            if key not in preserve_keys:
                processed[key] = 0.0
                
    return processed

# ================================
# 3. BACKGROUND POLLING THREAD (MODIFIED)
# ================================
def poll_firebase_for_data(interval_seconds=5):
    """
    Runs in a background thread to poll for the *single latest* data point.
    """
    global latest_data_packet, last_known_timestamp
    while True:
        if not ref:
            print("Firebase ref not available, skipping poll.")
            time.sleep(interval_seconds)
            continue
            
        try:
            # OPTIMIZED: Get only the single last record
            raw_data = ref.order_by_child('timestamp').limit_to_last(1).get()
            
            if not raw_data:
                print("No data in Firebase.")
                with data_lock:
                    latest_data_packet['synced'] = False
                time.sleep(interval_seconds)
                continue

            # Extract the single record
            key, new_record = list(raw_data.items())[0]
            new_timestamp = new_record.get('timestamp')

            # Check if this is new data
            if new_timestamp == last_known_timestamp:
                # Data is the same, just update status
                with data_lock:
                    latest_data_packet['synced'] = False
                    latest_data_packet['lastPollTime'] = datetime.now().isoformat()
            else:
                # We have new data!
                print(f"New data found. Timestamp: {new_timestamp}")
                last_known_timestamp = new_timestamp
                with data_lock:
                    latest_data_packet = {
                        'data': new_record,
                        'synced': True,
                        'lastPollTime': datetime.now().isoformat()
                    }
                    
        except Exception as e:
            print(f"Error polling Firebase: {e}")
            with data_lock:
                latest_data_packet['synced'] = False

        time.sleep(interval_seconds)

# --- Data Logging ---
def log_data(data_to_log):
    """Appends a row of data to the CSV log file."""
    file_exists = os.path.isfile(log_file_path)
    with open(log_file_path, 'a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=data_to_log.keys())
        if not file_exists or os.path.getsize(log_file_path) == 0:
            writer.writeheader()
        writer.writerow(data_to_log)

# --- Flask Routes ---
@app.route('/')
def index():
    """Renders the main dashboard page."""
    return render_template('index.html')

@app.route('/get_data')
def get_data():
    """API endpoint for *live* data (fetches the latest packet)."""
    global is_logging
    
    with data_lock:
        data_packet = latest_data_packet.copy()

    if not data_packet or 'data' not in data_packet:
        return jsonify({"error": "No data available from Firebase yet."}), 503

    # Process the raw record
    processed_data = process_record(data_packet['data'])

    # Generate model scores (still random)
    model_scores = {key: round(np.random.uniform(30, 95), 2) for key in MODEL_SCORES_KEYS}

    # Log data *only* if logging is on AND the data was new
    if is_logging and data_packet.get('synced', False):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        log_entry = {'Timestamp': timestamp}
        log_entry.update(processed_data) 
        log_entry.update(model_scores)
        log_data(log_entry)

    return jsonify({
        "generatedData": processed_data,
        "modelScores": model_scores,
        "synced": data_packet.get('synced', False),
        "lastPollTime": data_packet.get('lastPollTime')
    })

# NEW ROUTE: For initial load (last 100) and historical range
@app.route('/get_historical_data')
def get_historical_data():
    """
    Fetches historical data.
    If 'start' and 'end' params are provided, fetches that range.
    Otherwise, fetches the last 100 records.
    """
    if not ref:
        return jsonify({"error": "Firebase not connected"}), 500

    start = request.args.get('start', type=int)
    end = request.args.get('end', type=int)

    try:
        if start and end:
            print(f"Fetching historical data from {start} to {end}")
            query = ref.order_by_child('timestamp').start_at(start).end_at(end)
        else:
            print("Fetching last 100 records for initial load.")
            query = ref.order_by_child('timestamp').limit_to_last(100)
        
        raw_data = query.get()

        if not raw_data:
            return jsonify([]) # Return empty list if no data

        # Process all records
        processed_list = [process_record(record) for key, record in raw_data.items()]
        # Sort by timestamp, as Firebase dicts aren't ordered
        processed_list.sort(key=lambda x: x.get('timestamp', 0))
        
        return jsonify(processed_list)

    except Exception as e:
        print(f"Error fetching historical data: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/toggle_logging', methods=['POST'])
def toggle_logging():
    """Starts or stops the data logging process."""
    global is_logging
    data = request.get_json()
    is_logging = data.get('connect', False)
    status = "started" if is_logging else "stopped"
    print(f"Logging {status}")
    return jsonify({"message": f"Logging {status}"})

@app.route('/get_model_scores')
def get_model_scores():
    """API endpoint for model scores - returns dynamic scores"""
    print("GET /get_model_scores - Generating model scores")
    
    # Generate dynamic scores that change each time
    import random
    model_scores = {
        "SleepQualityIndex": round(random.uniform(20, 90), 1),
        "PsychosomaticStressIndex": round(random.uniform(10, 80), 1),
        "CognitiveLoadScore": round(random.uniform(30, 95), 1),
        "CardiovascularHealthIndex": round(random.uniform(40, 85), 1),
        "EmotionalVitalityScore": round(random.uniform(25, 88), 1)
    }
    
    response_data = {
        "modelScores": model_scores,
        "synced": True,
        "lastPollTime": datetime.now().isoformat()
    }
    
    print(f"GET /get_model_scores - Returning scores: {model_scores}")
    return jsonify(response_data)

@app.route('/get_model_scores_historical_data')
def get_model_scores_historical_data():
    """API endpoint for historical model scores - returns sample historical data"""
    print("GET /get_model_scores_historical_data - Generating historical scores")
    
    # Generate sample historical data (last 10 records)
    import random
    historical_data = []
    base_time = int(time.time() * 1000)  # Current timestamp in milliseconds
    
    for i in range(10):
        record = {
            "timestamp": base_time - (i * 30000),  # 30 seconds apart
            "SleepQualityIndex": round(random.uniform(20, 90), 1),
            "PsychosomaticStressIndex": round(random.uniform(10, 80), 1),
            "CognitiveLoadScore": round(random.uniform(30, 95), 1),
            "CardiovascularHealthIndex": round(random.uniform(40, 85), 1),
            "EmotionalVitalityScore": round(random.uniform(25, 88), 1)
        }
        historical_data.append(record)
    
    print(f"GET /get_model_scores_historical_data - Returning {len(historical_data)} historical records")
    return jsonify(historical_data)

# --- Main Execution ---
if __name__ == '__main__':
    print("Starting Firebase polling thread...")
    firebase_thread = threading.Thread(target=poll_firebase_for_data, daemon=True)
    firebase_thread.start()
    
    print("Starting Flask server...")
    app.run(debug=True, use_reloader=False)
