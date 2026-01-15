import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from data_pipeline.dataset import GSLTemporalDataset

def test_dataset_loads():
    ds = GSLTemporalDataset()
    assert len(ds) >= 0
    if len(ds) > 0:
        x, y = ds[0]
        assert x.shape[1] == 258
        assert x.shape[0] == ds.seq_len

