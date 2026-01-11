import PyPDF2
import pdfplumber
import json
import re
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class GSLSign:
    """Represents a Ghana Sign Language sign entry"""
    id: str
    gloss: str
    english_meaning: str
    category: str
    complexity_level: str
    handshape: Optional[str] = None
    location: Optional[str] = None
    movement: Optional[str] = None
    orientation: Optional[str] = None
    both_hands: bool = False
    facial_expressions: List[str] = None
    usage_examples: List[str] = None
    image_path: Optional[str] = None
    video_path: Optional[str] = None
    
    def __post_init__(self):
        if self.facial_expressions is None:
            self.facial_expressions = []
        if self.usage_examples is None:
            self.usage_examples = []

@dataclass
class GSLDictionary:
    """Complete GSL dictionary with metadata"""
    signs: Dict[str, GSLSign]
    metadata: Dict[str, any]
    categories: List[str]
    complexity_levels: List[str]

class GSLDictionaryExtractor:
    """Extracts and processes Ghana Sign Language dictionary data from PDF"""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        self.dictionary = None
        
    def extract_dictionary(self) -> GSLDictionary:
        """Extract complete dictionary from PDF"""
        logger.info(f"Extracting GSL dictionary from {self.pdf_path}")
        
        try:
            # Extract text using both PyPDF2 and pdfplumber for better accuracy
            text_content = self._extract_text_content()
            
            # Parse and structure the extracted text
            signs = self._parse_sign_entries(text_content)
            
            # Create dictionary object
            self.dictionary = GSLDictionary(
                signs=signs,
                metadata={
                    "source": str(self.pdf_path),
                    "extraction_date": "2024-01-11",
                    "total_signs": len(signs),
                    "version": "3rd Edition"
                },
                categories=self._extract_categories(signs),
                complexity_levels=self._extract_complexity_levels(signs)
            )
            
            logger.info(f"Successfully extracted {len(signs)} GSL signs")
            return self.dictionary
            
        except Exception as e:
            logger.error(f"Failed to extract dictionary: {e}")
            raise
    
    def _extract_text_content(self) -> str:
        """Extract text content from PDF using multiple methods"""
        text_content = ""
        
        try:
            # Method 1: Using pdfplumber (better for complex layouts)
            with pdfplumber.open(self.pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text_content += f"\n--- PAGE {page_num + 1} ---\n"
                        text_content += page_text
                        
            # If pdfplumber doesn't extract much, try PyPDF2
            if len(text_content.strip()) < 100:
                logger.warning("Limited content from pdfplumber, trying PyPDF2")
                with open(self.pdf_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    for page_num, page in enumerate(pdf_reader.pages):
                        page_text = page.extract_text()
                        if page_text:
                            text_content += f"\n--- PAGE {page_num + 1} ---\n"
                            text_content += page_text
                            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise
            
        return text_content
    
    def _parse_sign_entries(self, text_content: str) -> Dict[str, GSLSign]:
        """Parse text content into structured sign entries"""
        signs = {}
        
        # Common patterns for GSL dictionary entries
        entry_patterns = [
            # Pattern 1: GLOSS (English Meaning) - basic format
            r'([A-Z\s]+)\s*\(([^)]+)\)',
            # Pattern 2: GLOSS: English Meaning - colon format
            r'([A-Z\s]+):\s*([^\n]+)',
            # Pattern 3: GLOSS - English Meaning - dash format
            r'([A-Z\s]+)\s*-\s*([^\n]+)'
        ]
        
        # Try each pattern to find sign entries
        for pattern in entry_patterns:
            matches = re.finditer(pattern, text_content, re.MULTILINE)
            for match in matches:
                gloss = match.group(1).strip()
                meaning = match.group(2).strip()
                
                # Skip if too short or already exists
                if len(gloss) < 2 or gloss in signs:
                    continue
                    
                # Create sign entry
                sign = GSLSign(
                    id=gloss.replace(' ', '_'),
                    gloss=gloss,
                    english_meaning=meaning,
                    category=self._categorize_sign(gloss, meaning),
                    complexity_level=self._determine_complexity(gloss, meaning)
                )
                
                signs[gloss] = sign
        
        # If no signs found with basic patterns, try more sophisticated parsing
        if len(signs) < 5:
            signs = self._advanced_parsing(text_content)
            
        logger.info(f"Parsed {len(signs)} sign entries")
        return signs
    
    def _advanced_parsing(self, text_content: str) -> Dict[str, GSLSign]:
        """Advanced parsing for complex dictionary layouts"""
        signs = {}
        
        # Split by potential entry separators
        sections = re.split(r'\n\s*\n+', text_content)
        
        for section in sections:
            section = section.strip()
            if len(section) < 10:
                continue
                
            # Look for uppercase words (likely GSL glosses)
            words = section.split()
            uppercase_words = [word for word in words if word.isupper() and len(word) > 1]
            
            if uppercase_words:
                gloss = ' '.join(uppercase_words[:2])  # Take first 1-2 uppercase words
                
                # Extract meaning (text after gloss)
                gloss_start = section.find(gloss)
                if gloss_start != -1:
                    remaining_text = section[gloss_start + len(gloss):].strip()
                    
                    # Clean up meaning text
                    meaning = re.sub(r'[^\w\s.,!?()-]', '', remaining_text[:100]).strip()
                    
                    if gloss and meaning and gloss not in signs:
                        sign = GSLSign(
                            id=gloss.replace(' ', '_'),
                            gloss=gloss,
                            english_meaning=meaning,
                            category=self._categorize_sign(gloss, meaning),
                            complexity_level=self._determine_complexity(gloss, meaning)
                        )
                        signs[gloss] = sign
        
        return signs
    
    def _categorize_sign(self, gloss: str, meaning: str) -> str:
        """Categorize sign based on gloss and meaning"""
        gloss_lower = gloss.lower()
        meaning_lower = meaning.lower()
        
        # Common GSL categories
        categories = {
            'greeting': ['hello', 'hi', 'good', 'morning', 'afternoon', 'evening', 'bye'],
            'identity': ['name', 'i', 'me', 'you', 'he', 'she', 'they', 'we'],
            'question': ['what', 'where', 'when', 'why', 'how', 'who'],
            'emotion': ['happy', 'sad', 'angry', 'love', 'like', 'want', 'need'],
            'action': ['go', 'come', 'eat', 'drink', 'sleep', 'work', 'study'],
            'description': ['big', 'small', 'good', 'bad', 'beautiful', 'ugly']
        }
        
        for category, keywords in categories.items():
            for keyword in keywords:
                if keyword in gloss_lower or keyword in meaning_lower:
                    return category
        
        return 'general'
    
    def _determine_complexity(self, gloss: str, meaning: str) -> str:
        """Determine complexity level of sign"""
        # Simple heuristics for complexity
        if len(gloss.split()) <= 2 and len(meaning.split()) <= 3:
            return 'basic'
        elif len(gloss.split()) <= 3 and len(meaning.split()) <= 6:
            return 'intermediate'
        else:
            return 'advanced'
    
    def _extract_categories(self, signs: Dict[str, GSLSign]) -> List[str]:
        """Extract unique categories from signs"""
        categories = set()
        for sign in signs.values():
            categories.add(sign.category)
        return sorted(list(categories))
    
    def _extract_complexity_levels(self, signs: Dict[str, GSLSign]) -> List[str]:
        """Extract unique complexity levels from signs"""
        levels = set()
        for sign in signs.values():
            levels.add(sign.complexity_level)
        return sorted(list(levels))
    
    def save_to_json(self, output_path: str):
        """Save extracted dictionary to JSON file"""
        if not self.dictionary:
            raise ValueError("No dictionary extracted. Call extract_dictionary() first.")
        
        # Convert to serializable format
        dictionary_data = {
            "signs": {},
            "metadata": self.dictionary.metadata,
            "categories": self.dictionary.categories,
            "complexity_levels": self.dictionary.complexity_levels
        }
        
        for gloss, sign in self.dictionary.signs.items():
            dictionary_data["signs"][gloss] = {
                "id": sign.id,
                "gloss": sign.gloss,
                "english_meaning": sign.english_meaning,
                "category": sign.category,
                "complexity_level": sign.complexity_level,
                "handshape": sign.handshape,
                "location": sign.location,
                "movement": sign.movement,
                "orientation": sign.orientation,
                "both_hands": sign.both_hands,
                "facial_expressions": sign.facial_expressions,
                "usage_examples": sign.usage_examples,
                "image_path": sign.image_path,
                "video_path": sign.video_path
            }
        
        # Save to file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(dictionary_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Dictionary saved to {output_path}")

class GSLDictionaryService:
    def __init__(self, json_dir: str = "data/gsl_json"):
        self.json_dir = Path(json_dir)
        self.index: Dict[str, Dict] = {}
        self._load_index()

    def _load_index(self):
        if not self.json_dir.exists():
            return
        for p in sorted(self.json_dir.glob("gsl_dict_entries_*.json")):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                for e in data.get("entries", []):
                    self.index[e["id"]] = e

    async def search_signs(self, query: str, limit: int = 10) -> List[Dict]:
        q = query.lower()
        results = []
        for e in self.index.values():
            if q in e.get("gloss", "").lower() or q in e.get("english_meaning", "").lower():
                results.append({"id": e["id"], "gloss": e["gloss"], "english_meaning": e["english_meaning"]})
            if len(results) >= limit:
                break
        return results

    async def get_sign_by_id(self, sign_id: str) -> Optional[Dict]:
        return self.index.get(sign_id)

# Usage example
if __name__ == "__main__":
    # This will be called from the main application
    pdf_path = "../Ghanaian Sign Language Dictionary - 3rd Edition.pdf"
    extractor = GSLDictionaryExtractor(pdf_path)
    
    try:
        dictionary = extractor.extract_dictionary()
        extractor.save_to_json("gsl_dictionary.json")
        print(f"Successfully extracted {len(dictionary.signs)} GSL signs")
        
        # Print sample entries
        sample_signs = list(dictionary.signs.values())[:5]
        for sign in sample_signs:
            print(f"{sign.gloss}: {sign.english_meaning} ({sign.category})")
            
    except Exception as e:
        print(f"Error extracting dictionary: {e}")
