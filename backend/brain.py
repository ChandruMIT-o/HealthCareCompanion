from flask import Flask, request, jsonify
from lobes.cognition import RealTimePredictor
from lobes.stress import StressPredictionBuffer

# ----------------- Init Flask -----------------
app = Flask(__name__)

# ----------------- Load Models -----------------
COGNITIVE_MODEL_PATH = "models/cognition.keras"
COGNITIVE_SCALER_PATH = "scalers/cognition.pkl"

STRESS_MODEL_PATH = "models/stress.keras"
STRESS_SCALER_PATH = "scalers/stress.pkl"

cognitive_predictor = RealTimePredictor(COGNITIVE_MODEL_PATH, COGNITIVE_SCALER_PATH)
stress_buffer = StressPredictionBuffer(STRESS_MODEL_PATH, STRESS_SCALER_PATH)


@app.route("/")
def home():
    return jsonify({"message": "Brain API is running 🚀"})


# ----------------- Cognitive Endpoint -----------------
@app.route("/predict/cognitive", methods=["POST"])
def predict_cognitive():
    try:
        data = request.get_json()
        score = cognitive_predictor.predict_from_stream(
            float(data["ACC_ACC_X"]),
            float(data["ACC_ACC_Y"]),
            float(data["ACC_ACC_Z"]),
            float(data["BVP_BVP"]),
            float(data["EDA_EDA"]),
            float(data["HR_HR"]),
            float(data["IBI_value"]),
            float(data["TEMP_TEMP"]),
        )

        if score is None:
            return jsonify({"status": "buffering",
                            "message": f"{len(cognitive_predictor.buffer)}/{cognitive_predictor.window_size} samples collected."})
        return jsonify({"status": "success", "cognitive_load_score": score})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


# ----------------- Stress Endpoint -----------------
@app.route("/predict/stress", methods=["POST"])
def predict_stress():
    try:
        data = request.get_json()
        score = stress_buffer.add_sample(
            float(data["ECG"]),
            float(data["EDA"]),
            float(data["TEMP"]),
            float(data["RESP"]),
            float(data["ACC_X"]),
            float(data["ACC_Y"]),
            float(data["ACC_Z"]),
        )

        if score is None:
            return jsonify({"status": "buffering",
                            "message": f"{len(stress_buffer.buffer)}/{stress_buffer.window_size} samples collected."})
        return jsonify({"status": "success", "stress_level": score})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5080, debug=True)
