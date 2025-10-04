import collections
from tensorflow.keras.models import load_model
import joblib
import numpy as np

class RealTimePredictor:
    """
    Cognitive Load Prediction using a sliding window buffer.
    """

    def __init__(self, model_path, scaler_path, window_size=60):
        self.model = load_model(model_path)
        self.scaler = joblib.load(scaler_path)
        self.window_size = window_size
        self.buffer = collections.deque(maxlen=window_size)

    def predict_from_stream(self, acc_x, acc_y, acc_z, bvp, eda, hr, ibi, temp):
        sample = np.array([acc_x, acc_y, acc_z, bvp, eda, hr, ibi, temp])
        self.buffer.append(sample)

        if len(self.buffer) < self.window_size:
            return None

        window_data = np.array(self.buffer)
        scaled_data = self.scaler.transform(window_data)
        reshaped_data = np.expand_dims(scaled_data, axis=0)

        prediction = self.model.predict(reshaped_data, verbose=0)
        return float(prediction.flatten()[0])

'''
for i in {1..60}
do
   echo "--- Sending Request $i of 60 ---"
   curl -X POST http://127.0.0.1:5000/predict \
   -H "Content-Type: application/json" \
   -d '{
         "ACC_ACC_X": 0.12,
         "ACC_ACC_Y": -0.34,
         "ACC_ACC_Z": 0.56,
         "BVP_BVP": 1.23,
         "EDA_EDA": 0.78,
         "HR_HR": 72,
         "IBI_value": 0.85,
         "TEMP_TEMP": 36.5
       }'
   echo "" # Adds a newline for better readability
done
'''