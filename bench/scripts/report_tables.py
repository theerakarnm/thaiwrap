#!/usr/bin/env python3
"""Aggregates bench/out/*.json + criterion baselines into tables for bench/RESULTS.md.

Run after the full suite has completed:
  node bench/index.mjs && node bench/bench-cold-start.mjs && node bench/bench-memory-run.mjs \\
    && node bench/bench-bundle-size.mjs && node bench/bench-quality.mjs \\
    && cargo bench -p bench-compare --bench compare -- --save-baseline r1 (r2, r3)

Prints ready-to-paste markdown fragments.
"""
import json
import math
import pathlib
import statistics as st

ROOT = pathlib.Path(__file__).resolve().parent.parent  # bench/
OUT = ROOT / "out"
CRIT = ROOT.parent / "target" / "criterion"

JS_TOOLS = [
    ("thaiwrap", "thaiwrap (ours)"),
    ("intl-reference", "Intl+Thai-rule ref wrap"),
    ("intl-simple", "Intl.Segmenter+greedy"),
    ("wordcut-greedy", "wordcut+greedy"),
    ("thai-wordcut-ts-greedy", "thai-wordcut-ts+greedy"),
    ("thai-break-greedy", "thai-break words+greedy"),
    ("thai-break-wrap", "thai-break wrap()"),
]
RUST_TOOLS = [
    ("thaiwrap-core", "thaiwrap-core (wrap)"),
    ("icu-greedy", "ICU4X+greedy"),
    ("chamkho-greedy", "wordcut-engine(chamkho)+greedy"),
    ("nlpo3-greedy", "nlpo3 newmm+greedy"),
    ("thaibreak-greedy", "thaibreak+greedy"),
    ("kham-greedy", "kham-core+greedy"),
]
LARGE_CHARS = 144706      # UTF-16 code units
LARGE_BYTES = 414790      # UTF-8 bytes


def load(name):
    return json.loads((OUT / name).read_text())


def js_speed_fragments():
    js = load("js-speed.json")
    lines = []
    for size in ["small", "medium", "large"]:
        lines.append(f"### {size}\n")
        lines.append("| tool | ml20 ms | ml40 ms | ml80 ms |")
        lines.append("|---|---|---|---|")
        for key, label in JS_TOOLS:
            cells = []
            for ml in [20, 40, 80]:
                k = f"{key}/{size}/ml{ml}"
                ms = [r["results"][k]["meanMs"] for r in js["raw"]]
                cells.append(f"{st.median(ms):.3f} ({min(ms):.3f} to {max(ms):.3f}; {1000 / st.median(ms):,.0f} ops/s)")
            lines.append("| " + label + " | " + " | ".join(cells) + " |")
        lines.append("")
    # throughput + p99 for large
    lines.append("### throughput, large fixture\n")
    lines.append("| tool | ml40 chars/s | ml40 MB/s | p99 ms (mean of rounds) |")
    lines.append("|---|---|---|---|")
    for key, label in JS_TOOLS:
        a = js["aggregate"][f"{key}/large/ml40"]
        ops = 1000 / st.median([r["results"][f"{key}/large/ml40"]["meanMs"] for r in js["raw"]])
        lines.append(f"| {label} | {ops * LARGE_CHARS / 1e6:.2f}M | {ops * LARGE_BYTES / 1e6:.2f} | {a['p99Ms']['mean']:.2f} |")
    return "\n".join(lines)


def crit_round(baseline):
    out = {}
    for f in CRIT.glob(f"*/*/{baseline}/estimates.json"):
        tool, bench = f.parts[-4], f.parts[-3]
        d = json.loads(f.read_text())
        out[f"{tool}/{bench}"] = d["median"]["point_estimate"] / 1e6
    return out


def rust_speed_fragments():
    rounds = [crit_round(f"r{i}") for i in (1, 2, 3)]
    lines = []
    for size in ["small", "medium", "large"]:
        lines.append(f"### {size} (criterion median estimate, median of 3 baselines, ms)\n")
        lines.append("| tool | ml20 | ml40 | ml80 |")
        lines.append("|---|---|---|---|")
        for key, label in RUST_TOOLS:
            cells = []
            for ml in [20, 40, 80]:
                vals = [r[f"{key}/{size}_ml{ml}"] for r in rounds]
                cells.append(f"{st.median(vals):.3f} ({min(vals):.3f} to {max(vals):.3f})")
            lines.append("| " + label + " | " + " | ".join(cells) + " |")
        lines.append("")
    return "\n".join(lines)


def cold_start_fragment():
    cs = load("cold-start.json")
    lines = ["| tool | load ms | init ms | first call ms | warm call ms |", "|---|---|---|---|---|"]
    for tool in ["thaiwrap", "intl-reference", "intl-simple", "wordcut-greedy", "thai-wordcut-ts-greedy", "thai-break-greedy", "thai-break-wrap"]:
        t = cs["tools"][tool]
        def g(k):
            return f"{t[k]['median']:.2f}" if k in t else "-"
        lines.append(f"| {tool} | {g('loadMs')} | {g('initMs')} | {g('firstCallMs')} | {g('warmCallMs')} |")
    return "\n".join(lines)


def memory_fragment():
    mem = load("memory.json")
    lines = ["| tool | peak RSS (time -l) | max RSS sampled | max heap | heap after GC |", "|---|---|---|---|---|"]
    for key, label in JS_TOOLS:
        t = mem["tools"].get(key, {})
        if "error" in t:
            lines.append(f"| {label} | error | | | |")
            continue
        lines.append(f"| {label} | {t.get('timeMaxRssKb') or '-'} KB | {t['maxRssKb']:,} KB | {t['maxHeapUsedKb']:,} KB | {t['afterGcHeapUsedKb']:,} KB |")
    return "\n".join(lines)


def bundle_fragment():
    b = load("bundle-size.json")
    lines = ["| package | tarball (download) | unpacked (install) | payload gzip |", "|---|---|---|---|"]
    for r in b["results"]:
        lines.append(f"| {r['name']}@{r['version']} | {r['tarballBytes'] / 1024:.0f} KB | {r['unpackedBytes'] / 1024:.0f} KB | {r['payloadGzipSumBytes'] / 1024:.0f} KB |")
    return "\n".join(lines)


def quality_fragment():
    q = load("quality.json")
    tools = ["thaiwrap", "intl-reference", "intl-simple", "wordcut-greedy", "thai-wordcut-ts-greedy", "thai-break-greedy", "thai-break-wrap", "thaiwrap-core", "icu-greedy", "chamkho-greedy", "nlpo3-greedy", "thaibreak-greedy", "kham-greedy"]
    totals = {}
    for e in q["entries"]:
        if "error" in e:
            continue
        t = totals.setdefault(e["tool"], {"lines": 0, "overUtf16": 0, "overGrapheme": 0, "midWord": 0, "midWordIcu": 0, "startMark": 0, "startNo": 0, "endLead": 0, "notPreserved": 0, "lost": 0, "breaks": 0})
        t["lines"] += e["lineCount"]
        t["overUtf16"] += e["overLimit"]["utf16"]
        t["overGrapheme"] += e["overLimit"]["grapheme"]
        t["midWord"] += e["midWordCuts"]["count"]
        t["midWordIcu"] += e.get("midWordIcuCuts", {}).get("count", 0)
        t["startMark"] += len(e["ruleViolations"]["startCombining"])
        t["startNo"] += len(e["ruleViolations"]["startNoStart"])
        t["endLead"] += len(e["ruleViolations"]["endLeadingVowel"])
        t["notPreserved"] += 0 if e["preserved"] else 1
        t["lost"] += e["lostChars"]
    lines = ["| tool | lines | over-limit u16 / grapheme | mid-word (newmm) | mid-word (ICU) | starts w/ mark | starts w/ ะ า ำ ๆ ฯ | ends w/ เ แ โ ใ ไ | text preserved |", "|---|---|---|---|---|---|---|---|---|"]
    for tool in tools:
        if tool not in totals:
            continue
        t = totals[tool]
        preserved = "yes" if t["notPreserved"] == 0 else f"NO ({t['notPreserved']})"
        lines.append(f"| {tool} | {t['lines']:,} | {t['overUtf16']} / {t['overGrapheme']} | {t['midWord']:,} | {t['midWordIcu']:,} | {t['startMark']} | {t['startNo']} | {t['endLead']} | {preserved} |")
    return "\n".join(lines)


if __name__ == "__main__":
    print("<!-- JS SPEED -->")
    print(js_speed_fragments())
    print("<!-- RUST SPEED -->")
    print(rust_speed_fragments())
    print("<!-- COLD START -->")
    print(cold_start_fragment())
    print("<!-- MEMORY -->")
    print(memory_fragment())
    print("<!-- BUNDLE -->")
    print(bundle_fragment())
    print("<!-- QUALITY -->")
    print(quality_fragment())
