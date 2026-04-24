import tflite_runtime.interpreter as tflite
import numpy as np
import time
import logging

logger = logging.getLogger(__name__)

class FastGSLSignRecognizer:
    def __init__(self, model_path: str, label_map: list):
        self.interpreter = tflite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.label_map = label_map
        logger.info(f"Loaded TFLite model: {model_path}")

    def preprocess(self, landmarks_sequence):
        arr = np.array(landmarks_sequence, dtype=np.float32)
        arr = arr.flatten()
        arr = np.expand_dims(arr, axis=0)
        return arr

    def predict(self, landmarks_sequence):
        input_data = self.preprocess(landmarks_sequence)
        self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
        self.interpreter.invoke()
        output_data = self.interpreter.get_tensor(self.output_details[0]['index'])
        sign_idx = int(np.argmax(output_data))
        confidence = float(np.max(output_data))
        gloss = self.label_map[sign_idx] if sign_idx < len(self.label_map) else "UNKNOWN"
        return gloss, confidence

# Example usage in your backend service:
# recognizer = FastGSLSignRecognizer("gsl_signs.tflite", label_map)
# gloss, conf = recognizer.predict(landmarks_sequence)
# print(f"Predicted: {gloss}, confidence: {conf:.2f}")
