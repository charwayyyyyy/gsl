import React, { useRef } from 'react';
import { fetchAiResponse } from '../aiClient';
import { SignSequencePlayer } from './signPlayer';

interface AiSignBridgeProps {
  onFrame: (frame: any, gloss: string) => void;
}

export const AiSignBridge: React.FC<AiSignBridgeProps> = ({ onFrame }) => {
  const signPlayerRef = useRef<SignSequencePlayer | null>(null);

  // Initialize the sign player once
  if (!signPlayerRef.current) {
    signPlayerRef.current = new SignSequencePlayer(onFrame);
  }

  const handleUserInput = async (userInput: string) => {
    const response = await fetchAiResponse(userInput);
    let glosses: string[] = [];
    if (response.sources && response.sources.length > 0) {
      glosses = [response.sources[0].gloss];
    }
    if (glosses.length > 0) {
      signPlayerRef.current?.playGlossSequence(glosses);
    } else {
      alert(response.answer); // Or display in UI
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Type a word or phrase..."
        onKeyDown={e => {
          if (e.key === 'Enter') handleUserInput((e.target as HTMLInputElement).value);
        }}
        style={{ width: '80%', padding: '8px', fontSize: '1rem' }}
      />
      <button
        onClick={() => {
          const input = (document.querySelector('input[type=text]') as HTMLInputElement)?.value;
          if (input) handleUserInput(input);
        }}
        style={{ marginLeft: 8 }}
      >Sign</button>
    </div>
  );
};
