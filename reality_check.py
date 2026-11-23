import os
import re
import sys
from pathlib import Path

# Directories to ignore
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', '.cloudflare'}
IGNORE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.ttf', '.mp4', '.zip', '.exe'}

def analyze_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        return None

    total_lines = len(content.splitlines())
    if total_lines == 0:
        return {'status': 'EMPTY (Fake/Empty)', 'score': 0, 'reasons': ['Empty file']}

    fake_indicators = []
    functional_indicators = []

    # Detect Fake / Skeleton / Mock patterns
    todo_count = len(re.findall(r'TODO|FIXME|XXX|HACK|TEMP', content, re.IGNORECASE))
    if todo_count > 0:
        fake_indicators.append(f"{todo_count} TODO/FIXME tags")

    if re.search(r'pass\s*$', content, re.MULTILINE) or re.search(r'return\s*;\s*$', content, re.MULTILINE):
        fake_indicators.append("Empty functions (pass / empty return)")

    if re.search(r'console\.log\(|print\(|logger\.info\(', content) and total_lines < 25:
        fake_indicators.append("Mostly print/logging stubs")

    if re.search(r'dummy|mock|placeholder|fake|test_data|sample', content, re.IGNORECASE):
        fake_indicators.append("Hardcoded Mock / Dummy Data")

    if re.search(r'throw new Error\("Not implemented"\)|raise NotImplementedError', content):
        fake_indicators.append("NotImplemented exceptions")

    # Detect Functional patterns
    if re.search(r'async\s+function|export\s+default|class\s+\w+|def\s+\w+\(', content):
        functional_indicators.append("Defined functions/classes")

    if re.search(r'fetch\(|axios|http|requests\.|express\(|Worker|addEventListener', content):
        functional_indicators.append("Active I/O or HTTP handling")

    if re.search(r'try\s*\{|except\s+|catch\s*\(', content):
        functional_indicators.append("Error handling logic")

    if re.search(r'import\s+|require\(|from\s+\w+\s+import', content):
        functional_indicators.append("External modules linked")

    # Calculate Score
    score = 50
    score += len(functional_indicators) * 15
    score -= len(fake_indicators) * 20
    score = max(0, min(100, score))

    if total_lines < 5:
        status = "🔴 SKELETON (Fake)"
    elif score >= 70:
        status = "🟢 FUNCTIONAL (Real)"
    elif score >= 40:
        status = "🟡 PARTIAL / WIP"
    else:
        status = "🔴 MOCK / STUB (Fake)"

    return {
        'lines': total_lines,
        'status': status,
        'score': score,
        'fake_reasons': fake_indicators,
        'func_reasons': functional_indicators
    }

def main():
    root_dir = Path.cwd()
    print("=" * 70)
    print(f" 🔍 PROJECT REALITY CHECK REPORT")
    print(f" Target Path: {root_dir}")
    print("=" * 70)

    summary = {'REAL': 0, 'PARTIAL': 0, 'FAKE': 0, 'TOTAL': 0}
    report_rows = []

    for path in root_dir.rglob('*'):
        if path.is_file():
            # Skip ignored folders & binary extensions
            if any(part in IGNORE_DIRS for part in path.parts):
                continue
            if path.suffix.lower() in IGNORE_EXTS or path.name == 'reality_check.py':
                continue

            rel_path = path.relative_to(root_dir)
            res = analyze_file(path)
            if not res:
                continue

            summary['TOTAL'] += 1
            if "FUNCTIONAL" in res['status']:
                summary['REAL'] += 1
            elif "PARTIAL" in res['status']:
                summary['PARTIAL'] += 1
            else:
                summary['FAKE'] += 1

            report_rows.append((str(rel_path), res))

    # Print Summary Table
    print("\n📊 OVERALL SUMMARY:")
    print(f"   🟢 Fully Functional Files : {summary['REAL']}")
    print(f"   🟡 Partial / In-Progress  : {summary['PARTIAL']}")
    print(f"   🔴 Fake / Skeleton Stubs  : {summary['FAKE']}")
    print(f"   📂 Total Files Scanned    : {summary['TOTAL']}\n")

    print("-" * 70)
    print(f"{'FILE PATH':<40} | {'LINES':<6} | {'STATUS'}")
    print("-" * 70)

    for file_path, res in sorted(report_rows, key=lambda x: x[1]['score']):
        # Truncate long file paths nicely
        display_name = file_path if len(file_path) <= 38 else "..." + file_path[-35:]
        print(f"{display_name:<40} | {res['lines']:<6} | {res['status']}")
        if res['fake_reasons']:
            print(f"   └── ⚠️ Fake Indicators: {', '.join(res['fake_reasons'])}")

    print("-" * 70)
    print("\n✅ Reality Check Complete!\n")

if __name__ == '__main__':
    main()