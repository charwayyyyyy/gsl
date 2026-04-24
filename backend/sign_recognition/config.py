# Backend config for GSL sign recognition service
from backend.sign_recognition.label_map import LABEL_MAP

class GSLSignRecognitionConfig:
    tflite_model_path = "backend/sign_recognition/gsl_signs.tflite"
    label_map = LABEL_MAP
