import torch
from torch.utils.data import DataLoader
from pathlib import Path
import logging

from .dataset import GSLTemporalDataset
from ..api.services.sign_recognition_service import SignRecognitionConfig, SignTransformer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def train(num_epochs: int = 1, batch_size: int = 8, out_path: str = "models/sign_transformer.pth"):
    dataset = GSLTemporalDataset()
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    config = SignRecognitionConfig(num_classes=len(dataset.label_map))
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = SignTransformer(config).to(device)
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

    for epoch in range(num_epochs):
        model.train()
        total_loss = 0.0
        for sequences, labels in dataloader:
            sequences = sequences.to(device)
            labels = labels.to(device)
            optimizer.zero_grad()
            logits, _ = model(sequences)
            loss = criterion(logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()
        logger.info(f"Epoch {epoch+1}: loss={total_loss/len(dataloader):.4f}")

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    torch.save({"model_state_dict": model.state_dict(), "config": config.__dict__}, out_path)
    logger.info(f"Saved model to {out_path}")

if __name__ == "__main__":
    train()

