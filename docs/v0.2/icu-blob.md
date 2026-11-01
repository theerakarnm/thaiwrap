# ICU data blob gate (Task 9)

Candidate: commit 1da2d49 (Thai-only ICU4X blob).
Baseline: commit 9a43ecf (compiled data).
Machine: Apple M1 Pro, darwin-arm64.

## Size

| build | bytes | change |
| --- | --- | --- |
| baseline (compiled data) | 1,477,760 | - |
| candidate (blob) | 586,112 | -60.3% |

Size gate (at least -40%): holds.

## Method

Both trees come from `git archive` (9a43ecf and 1da2d49) and were built in `/tmp/thaiwrap-gate` with separate `CARGO_TARGET_DIR`s.
JS speed: `node bench/gate-ab.mjs ab` (Node 22 local, Node 24.22.2, Bun 1.4.4; 3 alternations; median), run twice as two independent tables.
Rust speed: `cargo bench -p thaiwrap-core --bench wrap`, alternating base and cand 3 times per table, median of each benchmark's middle `time:` value, run as three independent tables (the plan asks for two; table 3 was added because tables 1 and 2 disagree).
The machine was never quiet: other sessions ran a vitest run and a memory benchmark.
Deviation from the plan: the user chose not to wait for a quiet machine.
Instead, `uptime` and the top 5 processes by CPU were recorded before and after every timing step.
A step starts only when the 1-minute load average is 8 or lower (waiting up to 10 minutes).
Every start was at or below 8.
Load often rose during a run (see below), so each table says at what load it was measured.

Verdict rule: PASS only if the size gate holds and in both tables every case on every runtime is at most +5.0% slower and no case is above +3.0% in both tables.
FAIL if a case is above +5.0% in both tables.
Otherwise INCONCLUSIVE.

## JS speed

### Table 1 (start load 6.75)
node v22.19.0

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3375 | 3441 | 2.0% |
| long | 854482 | 864009 | 1.1% |
| mixed | 163791 | 161844 | -1.2% |

node v24.22.2

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3348 | 3444 | 2.9% |
| long | 863122 | 876426 | 1.5% |
| mixed | 163097 | 162514 | -0.4% |

bun 1.4.4

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 2887 | 2908 | 0.7% |
| long | 693603 | 701249 | 1.1% |
| mixed | 140024 | 139706 | -0.2% |

### Table 2 (start load 7.79)
node v22.19.0

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3475 | 3538 | 1.8% |
| long | 887811 | 890949 | 0.4% |
| mixed | 165231 | 166080 | 0.5% |

node v24.22.2

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3602 | 3606 | 0.1% |
| long | 910531 | 922635 | 1.3% |
| mixed | 172305 | 170053 | -1.3% |

bun 1.4.4

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3007 | 3110 | 3.4% |
| long | 730383 | 740901 | 1.4% |
| mixed | 145552 | 149273 | 2.6% |

JS table 2 also ran while a foreign node process used 113% to 206% CPU (see s2b_before and s2b_after), the same process that loaded Rust table 1.
All 18 cells are at most +3.4%.
The only cell above +3.0% is Bun `short` in table 2 (+3.4%); in table 1 it is +0.7%.

## Rust speed

### Table 1 (start load 6.4, load 14.5 at the end: a vitest run started during the run)

| bench | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 1992 | 2264 | +13.7% |
| long | 579820 | 647060 | +11.6% |
| mixed | 124170 | 141350 | +13.8% |
| overflow_max4 | 932680 | 1082000 | +16.0% |
| graphemes_long | 710820 | 709840 | -0.1% |

### Table 2 (start load 6.19, load 9.2 at the end)

| bench | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 1981 | 2002 | +1.1% |
| long | 584050 | 583650 | -0.1% |
| mixed | 121400 | 124070 | +2.2% |
| overflow_max4 | 953170 | 960820 | +0.8% |
| graphemes_long | 639640 | 659450 | +3.1% |

### Table 3, extra (start load 7.67, load 15.7 at the end)

| bench | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 1988 | 1990 | +0.1% |
| long | 560260 | 579480 | +3.4% |
| mixed | 120100 | 122160 | +1.7% |
| overflow_max4 | 944200 | 944230 | +0.0% |
| graphemes_long | 646790 | 644890 | -0.3% |

Tables 1 and 2 disagree: table 1 has four benchmarks at +11.6% to +16.0%, while table 2 has all benchmarks within +3.1%.
Table 1 ran while a vitest process used about 134% CPU.
The extra table 3 agrees with table 2, except `long` at +3.4%.
Table 3 is not part of the verdict rule.

## First call (not gated)

The blob is parsed on the first call.
Five fresh processes per build, `wrapThai('ก', 1)` including `require`:

```
base 11.581791 ms
base 2.9545 ms
base 2.092292 ms
base 1.995333 ms
base 2.093584 ms
cand 5.121 ms
cand 2.039542 ms
cand 2.050333 ms
cand 2.035666 ms
cand 2.144875 ms
```

The first process of each build is a cold start (disk cache); the later runs are 2.0 to 3.0 ms for both builds.
Machine load was not controlled for this step.

## Data parity

The test `embedded_data` (Task 8 Step 7) compares line and grapheme breaks of the blob against the compiled data:

```
corpus/wisesight/lines.txt: 0 differences
corpus/wikipedia-th/lines.txt: 0 differences
corpus/samples/matrix-inputs.txt: 0 differences
corpus/samples/thai.txt: 0 differences
corpus/samples/latin.txt: 0 differences
corpus/samples/digits.txt: 0 differences
corpus/samples/punct.txt: 0 differences
corpus/samples/emoji.txt: 0 differences
corpus/samples/cjk.txt: 0 differences
```

CJK (corpus/samples/cjk.txt, 100 lines): 0 differences.
Lao, Khmer and Burmese (corpus/samples/sea.txt): 5 differences, as intended (no dictionary for those scripts in the blob).

## Load records

Before and after each timing step: `uptime`, then the top foreign processes by CPU.

### s2a_before
```
19:29  up 7 days, 10:39, 12 users, load averages: 6.75 13.62 18.19
 73.2          00:02 /System/Library/Frameworks/Metal.framework/Versions/A/XPCServices/MTLCompilerService.xpc/
 48.4    01-00:04:37 /System/Library/ExtensionKit/Extensions/Storage.appex/Contents/MacOS/Storage -LaunchArgum
 39.4          00:09 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config
 31.0    07-12:16:19 /usr/libexec/syspolicyd
 28.1          00:00 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Ver
```

### s2a_after
```
19:29  up 7 days, 10:40, 12 users, load averages: 10.63 13.31 17.80
 38.0    07-12:17:07 /usr/libexec/syspolicyd
 27.0          00:03 /Users/jametirakarn/.cache/uv/archive-v0/QTYHVk0aEtrtKLXQjEZae/lib/python3.12/site-packag
 24.7 18476-19:17:33 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 11.3          00:02 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Ver
 11.2       03:25:53 prime-agent
```

### s2b_before
```
19:37  up 7 days, 10:48, 12 users, load averages: 7.79 11.90 15.18
205.5          00:47 node /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/apps/backend/node_modules/.bin/
 47.2          00:04 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 46.8          00:04 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 37.5          00:04 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 37.4          00:04 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
```

### s2b_after
```
19:38  up 7 days, 10:48, 12 users, load averages: 7.29 11.16 14.74
113.2          01:31 node /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/apps/backend/node_modules/.bin/
 53.1          00:05 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 43.4          00:04 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 22.8          00:00 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 22.0          00:00 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
```

### r1_before
```
19:42  up 7 days, 10:52, 12 users, load averages: 6.40 10.54 13.87
163.5          04:57 node /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/apps/backend/node_modules/.bin/
 23.7          00:02 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 23.2          00:02 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 23.1          00:02 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
 22.0          00:02 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
```

### r1_after
```
19:47  up 7 days, 10:57, 12 users, load averages: 14.52 11.52 12.92
133.8          02:42 node /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/apps/backend/node_modules/.bin/
 56.3       01:24:11 /Applications/Dia.app/Contents/Frameworks/ArcCore.framework/Helpers/Browser Helper (Rende
 33.4          01:44 /System/Library/PrivateFrameworks/WorkflowKit.framework/XPCServices/BackgroundShortcutRun
 29.3 18476-19:35:17 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 22.2          00:01 /Users/jametirakarn/.claude-worktrees/munmuang/pr-86/node_modules/.bun/@cloudflare+worker
```

### r2_before
```
19:51  up 7 days, 11:01, 12 users, load averages: 6.19 9.48 11.72
 38.7    01-00:27:12 /System/Library/ExtensionKit/Extensions/Storage.appex/Contents/MacOS/Storage -LaunchArgum
 32.6    07-12:38:54 /usr/libexec/syspolicyd
 10.3          00:00 /bin/zsh -c IFS= builtin read -r -d '' __cursor_command <&5 2>/dev/null || { builtin prin
  7.7       01:37:49 /Applications/Grok Bot.app/Contents/Frameworks/Grok Bot Helper (Renderer).app/Contents/Ma
  6.1    01-13:26:44 /usr/libexec/trustd
```

### r2_after
```
19:57  up 7 days, 11:07, 12 users, load averages: 9.17 8.37 10.30
 38.0    02-01:43:35 /Applications/Gemini.app/Contents/MacOS/Gemini
 27.7 18476-19:44:56 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 22.1    07-12:44:30 /usr/libexec/syspolicyd
  8.7 18476-19:44:55 /usr/libexec/airportd
  4.2       01:31:28 /System/Library/ExtensionKit/Extensions/Wi-Fi.appex/Contents/MacOS/Wi-Fi -LaunchArguments
```

### r3_before
```
19:57  up 7 days, 11:07, 12 users, load averages: 7.67 8.08 10.16
 43.5    02-01:43:49 /Applications/Gemini.app/Contents/MacOS/Gemini
 42.6    07-12:44:44 /usr/libexec/syspolicyd
 27.9    01-00:33:02 /System/Library/ExtensionKit/Extensions/Storage.appex/Contents/MacOS/Storage -LaunchArgum
 26.6 18476-19:45:10 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
  7.3 18476-19:45:09 /usr/libexec/airportd
```

### r3_after
```
20:03  up 7 days, 11:13, 12 users, load averages: 15.65 11.44 10.86
 26.3 18476-19:50:46 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 19.7    03-07:02:56 /Applications/Orca.app/Contents/Frameworks/Orca Helper (Renderer).app/Contents/MacOS/Orca
 11.2    03-06:37:00 /Users/jametirakarn/.prime/agent/kernel-venv/bin/python -m rlm.repl
 11.1    03-07:03:00 /Applications/Orca.app/Contents/MacOS/Orca
 10.1          58:45 /Applications/Claude.app/Contents/MacOS/Claude
```

## Verdict

Size: holds (-60.3%).
JS: all cells at most +3.4%; no cell above +3.0% in both tables.
Rust: table 1 has `short` +13.7%, `long` +11.6%, `mixed` +13.8%, `overflow_max4` +16.0% (measured at load up to 14.5); table 2 has all at most +3.1%; no case is above +5.0% in both tables.

Gate: PASS (accepted by the user; the verdict rule alone gave INCONCLUSIVE because Rust table 1 was measured under foreign load)

## Decision

The verdict rule gave INCONCLUSIVE because Rust table 1 ran while another process loaded the machine.
Table 1 showed +11.6% to +16.0% on four benchmarks while table 2 showed at most +3.1%, and the extra table 3 showed at most +3.4%.
The user reviewed the three Rust tables and the two JS tables on 2026-11-01 and accepted the gate as passed.
