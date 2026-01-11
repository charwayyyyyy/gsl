from pathlib import Path
from typing import List, Dict, Tuple
import json
import numpy as np
import torch
from torch.utils.data import Dataset

from .config import JSON_CHUNKS_DIR

class GSLTemporalDataset(Dataset):
    def __init__(self, json_root: Path = JSON_CHUNKS_DIR, seq_len: int = 150):
        self.seq_len = seq_len
        self.samples: List[Tuple[np.ndarray, int]] = []
        self.label_map: Dict[str, int] = {}
        self._load(json_root)

    def _load(self, root: Path):
        entries: List[Dict] = []
        for p in sorted(root.glob("gsl_dict_entries_*.json")):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                entries.extend(data.get("entries", []))
        for e in entries:
            gloss = e["gloss"].upper()
            if gloss not in self.label_map:
                self.label_map[gloss] = len(self.label_map)
            label = self.label_map[gloss]
            # Placeholder: use random landmark sequences until real alignment is available
            seq = np.random.randn(self.seq_len, 258).astype(np.float32)
            self.samples.append((seq, label))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        seq, label = self.samples[idx]
        return torch.from_numpy(seq), torch.tensor(label, dtype=torch.long)

