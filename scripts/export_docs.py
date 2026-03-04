import re, pathlib

src = pathlib.Path(r'C:\Users\PrinceTommy\.gemini\antigravity\brain\e30bc47a-a947-4d35-ac38-4ef811e0a93d\academic_documentation.md').read_text(encoding='utf-8')

out = src
out = re.sub(r'^#{1,6}\s+', '', out, flags=re.MULTILINE)
out = re.sub(r'\*\*(.+?)\*\*', r'\1', out)
out = re.sub(r'\*(.+?)\*', r'\1', out)
out = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', out)
out = re.sub(r'```[a-z]*\n', '', out)
out = re.sub(r'```', '', out)
# remove inline backtick code spans
out = re.sub(r'`([^`\n]+)`', r'\1', out)

dest = pathlib.Path(r'C:\Users\PrinceTommy\Desktop\GSL_Project_Documentation.txt')
dest.write_text(out, encoding='utf-8')
print('Saved:', dest, '  size:', dest.stat().st_size, 'bytes')
