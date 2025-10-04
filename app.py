import os
import csv
import time
import joblib
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import layers, Model
from sklearn.preprocessing import StandardScaler

from flask import Flask, jsonify, render_template, request

# --- Suppress Warnings ---
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TensorFlow INFO messages

# --- Flask App Initialization ---
app = Flask(__name__)

# --- Global Variables ---
is_logging = False
data_generator = None
log_file_path = "fitbit_data_log.csv"

# --- Feature and Model Definitions ---
FEATURE_COLS = [
    'ECG', 'EDA', 'Temp', 'Resp', 'EMG', 'ACC_x', 'ACC_y', 'ACC_z',
    'ACC_mag', 'BVP', 'HR', 'IBI', 'Resp_rate'
]
MODEL_SCORES_KEYS = [
    "SleepQualityIndex", "PsychosomaticStressIndex", "CognitiveLoadScore",
    "CardiovascularHealthIndex", "EmotionalVitalityScore"
]

# ================================
# LSTM Variational Autoencoder (User Provided)
# ================================
class LSTM_VAE(Model):
    def __init__(self, input_dim, latent_dim=16, seq_len=60):
        super(LSTM_VAE, self).__init__()
        self.seq_len = seq_len
        self.input_dim = input_dim
        # Encoder
        self.encoder_lstm = layers.LSTM(64, return_sequences=False)
        self.z_mean = layers.Dense(latent_dim)
        self.z_log_var = layers.Dense(latent_dim)
        # Decoder
        self.decoder_lstm = layers.LSTM(64, return_sequences=True)
        self.decoder_out = layers.TimeDistributed(layers.Dense(input_dim))

    def encode(self, x):
        h = self.encoder_lstm(x)
        z_mean = self.z_mean(h)
        z_log_var = self.z_log_var(h)
        eps = tf.random.normal(shape=tf.shape(z_mean))
        z = z_mean + tf.exp(0.5 * z_log_var) * eps
        return z, z_mean, z_log_var

    def decode(self, z):
        z_repeated = tf.repeat(tf.expand_dims(z, 1), self.seq_len, axis=1)
        h = self.decoder_lstm(z_repeated)
        return self.decoder_out(h)

    def call(self, x):
        z, z_mean, z_log_var = self.encode(x)
        x_recon = self.decode(z)
        return x_recon, z_mean, z_log_var

# --- Data Generator (User Provided) ---
def synthetic_data_generator(model, scaler, feature_cols, seq_len=60, delay=1.0, latent_dim=16):
    """Streams synthetic wearable data records in *real physiological units*."""
    while True:
        z = tf.random.normal(shape=(1, latent_dim))
        seq_scaled = model.decode(z).numpy()[0]
        seq_real = scaler.inverse_transform(seq_scaled)

        for i in range(seq_len):
            record = {col: seq_real[i, j] for j, col in enumerate(feature_cols)}
            record['HR'] = record['HR']
            record['EDA'] = record['EDA']
            record['Temp'] = record['Temp']
            record['Resp_rate'] = record['Resp_rate']
            yield record
            time.sleep(delay)

def load_model_and_scaler():
    """Loads the VAE model and scaler, creating dummy files if needed."""
    scaler = joblib.load("scaler.pkl")
    model = LSTM_VAE(input_dim=len(FEATURE_COLS), latent_dim=16, seq_len=60)
    model.build(input_shape=(None, 60, len(FEATURE_COLS)))
    model.load_weights("vae_weights.h5")
    return model, scaler

# Load model and initialize generator
model_loaded, scaler_loaded = load_model_and_scaler()
data_generator = synthetic_data_generator(model_loaded, scaler_loaded, FEATURE_COLS)

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
    """API endpoint to fetch the latest generated sensor data."""
    global is_logging
    
    # Get data from the generator
    generated_data = next(data_generator)

    # Clean up data types for JSON serialization
    for key, value in generated_data.items():
        if isinstance(value, (np.float32, np.float64)):
            generated_data[key] = float(value)
        elif isinstance(value, (np.int32, np.int64)):
            generated_data[key] = int(value)

    # Generate model scores
    model_scores = {key: round(np.random.uniform(30, 95), 2) for key in MODEL_SCORES_KEYS}

    # Prepare data for logging if connected
    if is_logging:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        log_entry = {'Timestamp': timestamp}
        log_entry.update(generated_data)
        log_entry.update(model_scores)
        log_data(log_entry)

    return jsonify({
        "generatedData": generated_data,
        "modelScores": model_scores
    })

@app.route('/toggle_logging', methods=['POST'])
def toggle_logging():
    """Starts or stops the data logging process."""
    global is_logging
    data = request.get_json()
    is_logging = data.get('connect', False)
    status = "started" if is_logging else "stopped"
    return jsonify({"message": f"Logging {status}"})

# --- Main Execution ---
if __name__ == '__main__':
    app.run(debug=True, use_reloader=False) # use_reloader=False to avoid re-initializing generator

