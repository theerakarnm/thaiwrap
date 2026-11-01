# UTF-16 binding gate

## ICU4X finding

`icu_segmenter 2.4.0` already has `segment_utf16(&[u16])` for both segmenters.
Positions are in u16 units, and lone surrogates are kept without panicking.
A core-level UTF-16 path is therefore possible, but it is not needed to remove the JS-side costs.
Those costs are the UTF-8 transcoding of the input and one `napi_create_string_utf8` per output line, and both sit in the binding (D11).

## What changed

Only the binding changed (candidate commit d243298 on branch `spike/utf16`).
It reads the JS string as UTF-16, calls the unchanged core, and returns UTF-16 strings.
Lone surrogates are kept instead of becoming U+FFFD.
The core crate did not change, so no Rust benchmark was run.

## Method

- Baseline: `57cb8f2` (tip of `feat/v0.2`). Candidate: `d243298` (tip of `spike/utf16`).
- Both were built with `git archive`, `bun install --frozen-lockfile` and `bun run build` in `/tmp/thaiwrap-gate`.
- `node bench/gate-ab.mjs ab /tmp/thaiwrap-gate/base /tmp/thaiwrap-gate/cand short long mixed`, run twice as two independent tables.
- Each run uses node v22.19.0, node v24.22.2 and bun 1.4.4. Per case: three alternating rounds, median reported.
- Gate (user answer 3, D9): `long` change <= -15.0% on node v22.19.0 and node v24.22.2; `short` change <= +5.0% on node v22.19.0, node v24.22.2 and bun 1.4.4.
- `mixed` and Bun `long` are reported, not gated.
- Verdict rule: PASS only if every gated cell meets its gate in both tables; FAIL if a gated cell misses its gate in both tables; otherwise INCONCLUSIVE.
- Start rule: the 1-minute load average must be <= 6 at the start.
  Table 1 broke this rule (6.65 at start); it is kept because its numbers agree with table 2 and the gate verdict does not depend on it.

## Table 1 (measured at load 6.65 at start, 13.22 at end)

Load was above 6 at the start of this table (6.65, so the start rule was not met), and rose during the run because another process (Gemini) used about 470% CPU at the end.

#### node v22.19.0

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3360 | 3096 | -7.9% |
| long | 846573 | 755619 | -10.7% |
| mixed | 161502 | 150118 | -7.0% |

#### node v24.22.2

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3392 | 3112 | -8.2% |
| long | 874126 | 745277 | -14.7% |
| mixed | 162211 | 148133 | -8.7% |

#### bun 1.4.4

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 2995 | 3091 | 3.2% |
| long | 717064 | 699426 | -2.5% |
| mixed | 142941 | 145124 | 1.5% |

## Table 2 (measured at load 5.36 at start, 3.85 at end)

#### node v22.19.0

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3338 | 3147 | -5.7% |
| long | 853199 | 760147 | -10.9% |
| mixed | 160090 | 148641 | -7.2% |

#### node v24.22.2

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 3382 | 3106 | -8.2% |
| long | 866859 | 745798 | -14.0% |
| mixed | 161015 | 145703 | -9.5% |

#### bun 1.4.4

| case | baseline ns | candidate ns | change |
| --- | --- | --- | --- |
| short | 2897 | 2975 | 2.7% |
| long | 699355 | 681143 | -2.6% |
| mixed | 139060 | 139480 | 0.3% |

## Load records

Table 1, before:

```text
20:38  up 7 days, 11:48, 10 users, load averages: 6.65 5.21 6.81
 32.3    02-02:24:39 /Applications/Gemini.app/Contents/MacOS/Gemini
 29.8 18476-20:26:00 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 15.0    06-05:19:03 /System/Library/PrivateFrameworks/BiomeStreams.framework/Support/BiomeAgent
 13.1    01-23:28:15 /Applications/Dia.app/Contents/MacOS/Dia
 13.1          00:02 /Applications/Dia.app/Contents/Frameworks/ArcCore.framework/Helpers/Browser Helper (Renderer).app/C
```

Table 1, after:

```text
20:39  up 7 days, 11:49, 10 users, load averages: 13.22 6.95 7.35
467.9    02-02:25:22 /Applications/Gemini.app/Contents/MacOS/Gemini
 44.2 18476-20:26:43 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 10.6    07-13:26:17 /usr/libexec/syspolicyd
  1.9    01-14:14:07 /usr/libexec/trustd
  0.9       01:15:16 /Applications/Dia.app/Contents/Frameworks/ArcCore.framework/Helpers/Browser Helper (Renderer).app/C
```

Table 2, before:

```text
20:41  up 7 days, 11:51, 10 users, load averages: 5.36 6.07 6.93
 46.7 18476-20:29:10 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 20.2    07-13:28:44 /usr/libexec/syspolicyd
  7.7    02-00:42:33 prime-agent
  6.8    01-01:17:02 /System/Library/ExtensionKit/Extensions/Storage.appex/Contents/MacOS/Storage -LaunchArguments eyJzZ
  4.5          04:09 /opt/homebrew/bin/prime-agent worker
```

Table 2, after:

```text
20:42  up 7 days, 11:52, 10 users, load averages: 3.85 5.60 6.72
  3.6    07-13:28:58 /Library/Frameworks/Python.framework/Versions/3.11/Resources/Python.app/Contents/MacOS/Python -m he
  3.3    07-13:28:57 /Applications/AlDente.app/Contents/MacOS/AlDente
  1.6    02-00:43:16 prime-agent
  1.5       01:18:26 /Applications/Dia.app/Contents/Frameworks/ArcCore.framework/Helpers/Browser Helper (Renderer).app/C
  1.1 18476-20:29:56 /usr/sbin/bluetoothd
```

Both builds were made at load 1.5 to 5.2.

## Reading

- `long` on node v22.19.0: -10.7% and -10.9%. Gate is -15.0%.
- `long` on node v24.22.2: -14.7% and -14.0%. Gate is -15.0%.
- `short`: at most +3.2% (bun 1.4.4, +3.2% and +2.7%); negative on both Node versions. Gate is +5.0%.
- Bun `long` is -2.5% and -2.6% (reported, not gated).
- The `long` result is not within 1 point of the line on Node 22 in either table (about 4 points short).
- On Node 24, table 1 (-14.7%) is within 1 point of the line; table 2 (-14.0%) is not.

The review of Task 12 listed two optional micro-optimizations that were NOT applied: decode with `String::from_utf16_lossy`, and build the output array without a per-line copy.

Gate: FAIL (long node v22.19.0 -10.7% / -10.9%, long node v24.22.2 -14.7% / -14.0%, both above -15.0%; short passes at -7.9%/-5.7% (v22), -8.2%/-8.2% (v24), +3.2%/+2.7% (bun))

The change is not merged; it stays on branch `spike/utf16`. A UTF-16 path inside the core was not tried (D11).
