import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import torch
from torch.utils.data import DataLoader
from data_pipeline.dataset import GSLTemporalDataset
from api.services.sign_recognition_service import SignRecognitionConfig, SignTransformer

def test_model_overfit_small_batch():
    ds = GSLTemporalDataset()
    if len(ds) < 10:
        return
    small = torch.utils.data.Subset(ds, list(range(8)))
    dl = DataLoader(small, batch_size=8)
    cfg = SignRecognitionConfig(num_classes=len(ds.label_map))
    model = SignTransformer(cfg)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    crit = torch.nn.CrossEntropyLoss()
    for _ in range(2):
        for x, y in dl:
            logits, _ = model(x)
            loss = crit(logits, y)
            opt.zero_grad()
            loss.backward()
            opt.step()
    assert True

