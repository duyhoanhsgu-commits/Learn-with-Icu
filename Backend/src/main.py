import sys
from pathlib import Path

# Add project root to sys.path to resolve 'src' imports when running script directly
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from src.ingestion.parser import DocumentParser

parser = DocumentParser()

# Check uploads/text.txt or fallback to uploads/test.txt
file_path = root_dir / "uploads" / "text.txt"
if not file_path.exists():
    file_path = root_dir / "uploads" / "test.txt"

text, metadata = parser.parse_file(file_path)

print("TEXT:")
print(text)

print("\nMETADATA:")
print(metadata)