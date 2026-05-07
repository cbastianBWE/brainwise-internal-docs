"""
Generates the three canonical BrainWise closeout documents from markdown sources.

Reads:
  ../docs/build-queue.md
  ../docs/architecture-reference.md
  ../docs/session-handoffs/<latest>.md (auto-detected by filename sort)

Writes:
  ./output/BrainWise_Build_Queue_v<N>.docx
  ./output/BrainWise_System_Architecture_Reference_v<N>.docx
  ./output/BrainWise_Session_<N>_to_<M>_Handoff.docx

The version numbers are extracted from the markdown frontmatter (first non-empty
italic line after the title).

Markdown structure expected:
  # Title
  *subtitle including version*

  ## H1 section heading
  ### H2 subsection
  #### H3 sub-subsection
  body text...
  - bullet item
  ```
  code block
  ```

Extend the parse rules below as needed when new markdown structures appear.
"""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from write_doc_helper import write_doc


HERE = Path(__file__).parent
DOCS = HERE.parent / 'docs'
OUT = HERE / 'output'
OUT.mkdir(exist_ok=True)


def parse_markdown(md_text):
    """Parse a markdown file into (title, subtitle, sections) for write_doc.

    Returns:
        (title, subtitle, sections)
    """
    lines = md_text.splitlines()
    title = None
    subtitle = None
    sections = []

    in_code = False
    code_buffer = []

    body_buffer = []

    def flush_body():
        if body_buffer:
            text = ' '.join(body_buffer).strip()
            if text:
                sections.append(('body', text))
            body_buffer.clear()

    i = 0
    while i < len(lines):
        line = lines[i]

        # title
        if title is None and line.startswith('# '):
            title = line[2:].strip()
            i += 1
            # find subtitle
            while i < len(lines):
                stripped = lines[i].strip()
                if stripped.startswith('*') and stripped.endswith('*') and len(stripped) > 2:
                    subtitle = stripped[1:-1].strip()
                    i += 1
                    break
                elif stripped == '':
                    i += 1
                else:
                    break
            continue

        # code fence
        if line.strip().startswith('```'):
            if in_code:
                flush_body()
                sections.append(('code', '\n'.join(code_buffer)))
                code_buffer = []
                in_code = False
            else:
                flush_body()
                in_code = True
            i += 1
            continue

        if in_code:
            code_buffer.append(line)
            i += 1
            continue

        stripped = line.strip()

        # headings
        if line.startswith('#### '):
            flush_body()
            sections.append(('h3', line[5:].strip()))
            i += 1
            continue
        if line.startswith('### '):
            flush_body()
            sections.append(('h2', line[4:].strip()))
            i += 1
            continue
        if line.startswith('## '):
            flush_body()
            sections.append(('h1', line[3:].strip()))
            i += 1
            continue

        # bullet
        if stripped.startswith('- ') or stripped.startswith('* '):
            flush_body()
            sections.append(('bullet', stripped[2:].strip()))
            i += 1
            continue

        # blank line - end paragraph
        if stripped == '':
            flush_body()
            i += 1
            continue

        # ordinary text
        body_buffer.append(stripped)
        i += 1

    flush_body()

    return title, subtitle, sections


def extract_version(subtitle):
    """Pull a version number from a subtitle like 'v30 - Session 38 closeout'."""
    m = re.search(r'v(\d+)', subtitle or '')
    return m.group(1) if m else 'X'


def find_latest_handoff():
    handoffs_dir = DOCS / 'session-handoffs'
    if not handoffs_dir.exists():
        return None
    handoffs = sorted(handoffs_dir.glob('session-*-to-*.md'))
    return handoffs[-1] if handoffs else None


def generate(md_path, out_filename_template):
    md = md_path.read_text()
    title, subtitle, sections = parse_markdown(md)
    version = extract_version(subtitle)
    out_filename = out_filename_template.format(version=version)
    out_path = OUT / out_filename
    write_doc(str(out_path), title, subtitle, sections)
    print(f"Generated: {out_path.name}")
    return out_path


def main():
    bq = DOCS / 'build-queue.md'
    ar = DOCS / 'architecture-reference.md'
    handoff = find_latest_handoff()

    if bq.exists():
        generate(bq, 'BrainWise_Build_Queue_v{version}.docx')
    if ar.exists():
        generate(ar, 'BrainWise_System_Architecture_Reference_v{version}.docx')
    if handoff:
        # extract session range from filename, e.g. session-38-to-39.md
        m = re.search(r'session-(\d+)-to-(\d+)', handoff.stem)
        if m:
            from_n, to_n = m.group(1), m.group(2)
            out_name = f'BrainWise_Session_{from_n}_to_{to_n}_Handoff.docx'
        else:
            out_name = f'{handoff.stem}.docx'
        md = handoff.read_text()
        title, subtitle, sections = parse_markdown(md)
        out_path = OUT / out_name
        write_doc(str(out_path), title, subtitle, sections)
        print(f"Generated: {out_name}")


if __name__ == '__main__':
    main()
