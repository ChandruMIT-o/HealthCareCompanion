import collections
import numpy as np
import scipy.signal
from tensorflow.keras.models import load_model
import joblib


class StressPredictionBuffer:
    """
    Real-time Stress Prediction Buffer
    """

    def __init__(self, model_path, scaler_path, window_size=60):
        self.model = load_model(model_path, compile=False)
        self.scaler = joblib.load(scaler_path)
        self.window_size = window_size
        self.buffer = collections.deque(maxlen=window_size)

    def add_sample(self, ecg, eda, temp, resp, acc_x, acc_y, acc_z):
        raw_sample = [ecg, eda, temp, resp, acc_x, acc_y, acc_z]
        self.buffer.append(raw_sample)

        if len(self.buffer) < self.window_size:
            return None

        features = self._extract_features_from_window()
        features_scaled = self.scaler.transform([features])
        model_input = features_scaled.reshape(1, 29, 1)

        prediction = self.model.predict(model_input, verbose=0)
        stress_level = float(prediction[0, 0])
        return max(0, min(100, stress_level))

    def _extract_features_from_window(self):
        window_data = np.array(self.buffer)
        ecg_window, eda_window, temp_window, resp_window = (
            window_data[:, 0], window_data[:, 1], window_data[:, 2], window_data[:, 3]
        )
        acc_window = window_data[:, 4:7]

        features = []

        # ECG features
        features.extend([np.mean(ecg_window), np.std(ecg_window),
                         np.min(ecg_window), np.max(ecg_window)])

        # HRV features
        try:
            peaks, _ = scipy.signal.find_peaks(ecg_window,
                                               height=np.mean(ecg_window) + 2 * np.std(ecg_window),
                                               distance=10)
            if len(peaks) > 1:
                rr_intervals = np.diff(peaks)
                features.extend([np.mean(rr_intervals), np.std(rr_intervals),
                                 np.min(rr_intervals), np.max(rr_intervals)])
            else:
                features.extend([0, 0, 0, 0])
        except:
            features.extend([0, 0, 0, 0])

        # EDA features
        features.extend([np.mean(eda_window), np.std(eda_window),
                         np.max(eda_window) - np.min(eda_window),
                         np.percentile(eda_window, 25), np.percentile(eda_window, 75)])

        # Temp features
        features.extend([np.mean(temp_window), np.std(temp_window),
                         np.max(temp_window) - np.min(temp_window)])

        # Respiration
        try:
            resp_peaks, _ = scipy.signal.find_peaks(resp_window,
                                                    height=np.mean(resp_window) + 0.5 * np.std(resp_window),
                                                    distance=10)
            breathing_rate = len(resp_peaks) / (len(resp_window) / 700)
            features.extend([np.mean(resp_window), np.std(resp_window), breathing_rate])
        except:
            features.extend([np.mean(resp_window), np.std(resp_window), 0])

        # Accelerometer magnitude
        acc_magnitude = np.linalg.norm(acc_window, axis=1)
        features.extend([np.mean(acc_magnitude), np.std(acc_magnitude),
                         np.percentile(acc_magnitude, 25), np.percentile(acc_magnitude, 75)])

        # Accelerometer per-axis
        for axis in range(3):
            features.extend([np.mean(acc_window[:, axis]), np.std(acc_window[:, axis])])

        return features

'''
for i in {1..60}
do
   echo "--- Sending Request $i of 60 ---"
   curl -X POST http://127.0.0.1:5000/predict/stress \
   -H "Content-Type: application/json" \
   -d '{
         "ECG": 0.5,
         "EDA": 3.2,
         "TEMP": 36.6,
         "RESP": 0.25,
         "ACC_X": 1.0,
         "ACC_Y": 0.1,
         "ACC_Z": 0.2
       }'
   echo "" # Adds a newline for better readability
done
'''