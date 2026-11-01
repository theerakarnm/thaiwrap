# API gates

## wrapThaiBatch

### Method

- Candidate: `wrapThaiBatch(texts, maxLength, options?)`, built in the working tree on top of `e38521f` (tip of `feat/v0.2`).
  The UTF-16 binding was skipped, so the export returns `string[][]` built from UTF-8 strings.
- Case `batch-1000`: `wrapThaiBatch(TEXTS, 20)`.
  Case `loop-1000`: a JS loop calling `wrapThai(t, 20)` for each of the same 1,000 texts.
- `TEXTS` = the first 1,000 non-empty lines of `corpus/wisesight/lines.txt` (D10).
- Both cases run inside ONE build: `node bench/gate-ab.mjs pairs . batch-1000:loop-1000`, run twice as two independent tables.
- Each run uses node v22.19.0, node v24.22.2 and bun 1.4.4 (`bench/gate.mjs`, median of 21 timed batches per case; three alternating rounds, median reported).
- Gate (user answer 4, D9): `batch-1000` change <= -20.0% against `loop-1000` on node v22.19.0, node v24.22.2 and bun 1.4.4.
- Verdict rule: PASS only if both tables show <= -20.0% on all three runtimes; FAIL if for some runtime the change is above -20.0% in both tables; otherwise INCONCLUSIVE.
- Start rule: the 1-minute load average must be <= 6 at the start of a table.

### Table 1 (measured at load 5.10 at start, 4.96 at end)

#### node v22.19.0

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| batch-1000 | loop-1000 | 7298479 | 7141813 | 2.2% |

#### node v24.22.2

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| batch-1000 | loop-1000 | 7170386 | 7246073 | -1.0% |

#### bun 1.4.4

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| batch-1000 | loop-1000 | 6347709 | 6669083 | -4.8% |

### Table 2 (measured at load 4.96 at start, 6.26 at end)

#### node v22.19.0

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| batch-1000 | loop-1000 | 7024698 | 7179427 | -2.2% |

#### node v24.22.2

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| batch-1000 | loop-1000 | 7437584 | 7442854 | -0.1% |

#### bun 1.4.4

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| batch-1000 | loop-1000 | 6682813 | 6824802 | -2.1% |

### Result

| runtime | table 1 | table 2 |
| --- | --- | --- |
| node v22.19.0 | 2.2% | -2.2% |
| node v24.22.2 | -1.0% | -0.1% |
| bun 1.4.4 | -4.8% | -2.1% |

The best result in any table is -4.8% (bun 1.4.4, table 1).
No runtime reaches -20.0% in either table.

Gate: FAIL (node v22.19.0 2.2% / -2.2%, node v24.22.2 -1.0% / -0.1%, bun 1.4.4 -4.8% / -2.1%; need <= -20.0%)

Consequence (plan Step 4): the source, `binding.d.ts`, `index.js` and `index.d.ts` changes are discarded, and only this record is committed.
The user decides what happens next.

### Load records

Table 1, before:

```text
20:46  up 7 days, 11:56, 10 users, load averages: 5.10 4.64 5.96
138.7    03-07:46:04 /Applications/Orca.app/Contents/Frameworks/Orca Helper (Renderer).app/Contents/MacOS/Orca Helper (R
 88.6    07-13:33:28 /usr/libexec/syspolicyd
 20.7 18476-20:33:54 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 16.5    01-14:21:18 /usr/libexec/trustd
 14.7    03-07:46:08 /Applications/Orca.app/Contents/MacOS/Orca
```

Table 1, after:

```text
20:46  up 7 days, 11:56, 10 users, load averages: 4.96 4.63 5.93
 19.2    07-13:33:44 /usr/libexec/syspolicyd
 14.5       02:20:42 /System/Library/ExtensionKit/Extensions/Wi-Fi.appex/Contents/MacOS/Wi-Fi -LaunchArguments eyJ0eXBlI
  6.1 18476-20:34:09 /usr/libexec/airportd
  4.8    02-00:47:33 prime-agent
  4.3 18476-20:34:10 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
```

Table 2, before:

```text
20:46  up 7 days, 11:56, 10 users, load averages: 4.96 4.63 5.93
 14.5       02:20:42 /System/Library/ExtensionKit/Extensions/Wi-Fi.appex/Contents/MacOS/Wi-Fi -LaunchArguments eyJ0eXBlI
 11.7    07-13:33:44 /usr/libexec/syspolicyd
  4.8    02-00:47:33 prime-agent
  4.6 18476-20:34:10 /System/Library/CoreServices/loginwindow.app/Contents/MacOS/loginwindow console
  4.0 18476-20:34:13 /System/Library/CoreServices/launchservicesd
```

Table 2, after:

```text
20:46  up 7 days, 11:57, 10 users, load averages: 6.26 4.93 6.02
 24.4    07-13:33:59 /usr/libexec/syspolicyd
 19.1 18476-20:34:25 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
  8.6    01-14:21:49 /usr/libexec/trustd
  8.2    03-07:46:35 /Applications/Orca.app/Contents/Frameworks/Orca Helper (Renderer).app/Contents/MacOS/Orca Helper (R
  6.8    03-07:46:39 /Applications/Orca.app/Contents/MacOS/Orca
```

## wrapThaiRanges

### Method

- Candidate: `wrapThaiRanges(text, maxLength, options?)`, built in the working tree on top of `389c5b2` (tip of `feat/v0.2`).
  The UTF-16 binding was skipped, so the text is read with `read_string` (UTF-8, lone surrogates become U+FFFD) and wrapped with `thaiwrap_core::wrap`.
  The new private helper `utf16_offsets` turns the byte ranges into flat UTF-16 offsets in one forward pass.
  The export returns a `Uint32Array`.
- Smoke test before gating: `wrapThaiRanges(ACCEPTANCE, 10)` is `[0,9,9,16,17,27,27,32,32,38]` and `text.slice(r[2*i], r[2*i+1])` equals the `wrapThai` lines for the acceptance text and for 200 corpus lines (first 200 non-empty lines of `corpus/wisesight/lines.txt` at 20).
  Node 22 and Bun 1.4.4 gave the same result; the error class and message for `1,0`, `'x',0` and a bad `measure` equal those of `wrapThai`.
- Cases (`bench/gate.mjs`): `ranges-short` is `wrapThaiRanges(SHORT, 10)` against `short`, which is `wrapThai(SHORT, 10)`.
  `ranges-long` is `wrapThaiRanges(LONG, 10)` against `long`.
  `ranges-loop-1000` is a JS loop of `wrapThaiRanges(t, 20)` over the 1,000 texts against `loop-1000`, a JS loop of `wrapThai(t, 20)` over the same texts.
- Inputs (D10): `SHORT` is the acceptance text at 10.
  `LONG` is the acceptance text repeated 300 times at 10.
  `TEXTS` is the first 1,000 non-empty lines of `corpus/wisesight/lines.txt`.
- All cases run inside ONE build: `node bench/gate-ab.mjs pairs . ranges-short:short ranges-long:long ranges-loop-1000:loop-1000`, run twice as two independent tables.
- Each run uses node v22.19.0, node v24.22.2 and bun 1.4.4 (`bench/gate.mjs`, median of 21 timed batches per case; three alternating rounds, median reported).
- Gate (user answer 4, D9): every pair change <= -20.0% on node v22.19.0, node v24.22.2 and bun 1.4.4 (9 cells).
- Verdict rule: PASS only if both tables show <= -20.0% in all 9 cells; FAIL if some cell is above -20.0% in both tables; otherwise INCONCLUSIVE.
- Start rule: the 1-minute load average must be <= 6 at the start of a table (it was).

### Table 1 (measured at load 5.48 at start, 5.35 at end)

#### node v22.19.0

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| ranges-short | short | 2857 | 3294 | -13.3% |
| ranges-long | long | 601598 | 850578 | -29.3% |
| ranges-loop-1000 | loop-1000 | 6832448 | 7262521 | -5.9% |

#### node v24.22.2

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| ranges-short | short | 3094 | 3464 | -10.7% |
| ranges-long | long | 631888 | 878779 | -28.1% |
| ranges-loop-1000 | loop-1000 | 6902708 | 7426823 | -7.1% |

#### bun 1.4.4

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| ranges-short | short | 2965 | 2982 | -0.6% |
| ranges-long | long | 600732 | 713342 | -15.8% |
| ranges-loop-1000 | loop-1000 | 6641167 | 6769917 | -1.9% |

### Table 2 (measured at load 5.02 at start, 7.44 at end)

#### node v22.19.0

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| ranges-short | short | 3035 | 3376 | -10.1% |
| ranges-long | long | 618090 | 866536 | -28.7% |
| ranges-loop-1000 | loop-1000 | 6982427 | 7546334 | -7.5% |

#### node v24.22.2

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| ranges-short | short | 3089 | 3503 | -11.8% |
| ranges-long | long | 643668 | 901802 | -28.6% |
| ranges-loop-1000 | loop-1000 | 7013771 | 7459521 | -6.0% |

#### bun 1.4.4

| new | old | new ns | old ns | change |
| --- | --- | --- | --- | --- |
| ranges-short | short | 2951 | 3031 | -2.6% |
| ranges-long | long | 606857 | 733961 | -17.3% |
| ranges-loop-1000 | loop-1000 | 6607177 | 6818802 | -3.1% |

### Result

| runtime | case | table 1 | table 2 | cell |
| --- | --- | --- | --- | --- |
| node v22.19.0 | ranges-short | -13.3% | -10.1% | fail |
| node v22.19.0 | ranges-long | -29.3% | -28.7% | pass |
| node v22.19.0 | ranges-loop-1000 | -5.9% | -7.5% | fail |
| node v24.22.2 | ranges-short | -10.7% | -11.8% | fail |
| node v24.22.2 | ranges-long | -28.1% | -28.6% | pass |
| node v24.22.2 | ranges-loop-1000 | -7.1% | -6.0% | fail |
| bun 1.4.4 | ranges-short | -0.6% | -2.6% | fail |
| bun 1.4.4 | ranges-long | -15.8% | -17.3% | fail |
| bun 1.4.4 | ranges-loop-1000 | -1.9% | -3.1% | fail |

- Passing cells (<= -20.0% in both tables): `ranges-long` on node v22.19.0 (-29.3% / -28.7%) and on node v24.22.2 (-28.1% / -28.6%).
- Failing cells (above -20.0% in both tables): the other 7.
  - `ranges-short`: node v22.19.0 -13.3% / -10.1%, node v24.22.2 -10.7% / -11.8%, bun 1.4.4 -0.6% / -2.6%.
  - `ranges-long` on bun 1.4.4: -15.8% / -17.3%.
  - `ranges-loop-1000`: node v22.19.0 -5.9% / -7.5%, node v24.22.2 -7.1% / -6.0%, bun 1.4.4 -1.9% / -3.1%.
- The table 2 end load (7.44) is above 6, but the load was 5.02 when the table started and no failing cell is near the gate.

Gate: FAIL (7 of 9 cells above -20.0% in both tables: ranges-short node v22.19.0 -13.3% / -10.1%, node v24.22.2 -10.7% / -11.8%, bun 1.4.4 -0.6% / -2.6%; ranges-long bun 1.4.4 -15.8% / -17.3%; ranges-loop-1000 node v22.19.0 -5.9% / -7.5%, node v24.22.2 -7.1% / -6.0%, bun 1.4.4 -1.9% / -3.1%; need <= -20.0%; ranges-long passes on both Node versions)

Consequence (plan Step 4): the source, `binding.d.ts`, `index.js` and `index.d.ts` changes are discarded, and only this record is committed.
The user decides what happens next.

### Load records

Table 1, before:

```text
20:56  up 7 days, 12:07, 10 users, load averages: 5.48 5.92 5.95
 67.7    01-01:32:25 /System/Library/ExtensionKit/Extensions/Storage.appex/Contents/MacOS/Storage -LaunchArguments eyJzZ
 12.8    07-13:44:07 /usr/libexec/syspolicyd
 11.9       01:33:06 /Applications/Dia.app/Contents/Frameworks/ArcCore.framework/Helpers/Browser Helper (Renderer).app/C
 11.4    04-01:39:33 prime-agent
  9.2    07-13:44:06 /System/Library/DriverExtensions/com.apple.DriverKit-AppleBCMWLAN.dext/com.apple.DriverKit-AppleBCM
```

Table 1, after:

```text
20:59  up 7 days, 12:09, 10 users, load averages: 5.35 5.56 5.78
 19.7    07-13:46:24 /usr/libexec/syspolicyd
  9.6    03-07:59:00 /Applications/Orca.app/Contents/Frameworks/Orca Helper (Renderer).app/Contents/MacOS/Orca Helper (R
  9.0 20758-13:42:49 /sbin/launchd
  7.5          33:47 /System/Library/Frameworks/Virtualization.framework/Versions/A/XPCServices/com.apple.Virtualization
  6.2 18476-20:46:50 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
```

Table 2, before:

```text
20:59  up 7 days, 12:09, 10 users, load averages: 5.02 5.48 5.75
 81.3 18476-20:47:13 /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/FSEvents.framework/Versions
 30.5    07-13:46:44 /usr/libexec/syspolicyd
 20.4 18476-20:47:10 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 14.0    01-23:49:25 /Applications/Dia.app/Contents/MacOS/Dia
 11.3          39:36 /System/Library/PrivateFrameworks/IntelligencePlatformCompute.framework/Versions/A/XPCServices/Inte
```

Table 2, after:

```text
21:01  up 7 days, 12:12, 10 users, load averages: 7.44 7.48 6.62
 57.4    07-13:49:02 /usr/libexec/syspolicyd
 24.3       02:36:00 /System/Library/ExtensionKit/Extensions/Wi-Fi.appex/Contents/MacOS/Wi-Fi -LaunchArguments eyJ0eXBlI
 23.5 18476-20:49:28 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
 22.1          31:16 /Applications/Dia.app/Contents/Frameworks/ArcCore.framework/Helpers/Browser Helper (Renderer).app/C
 18.5 18476-20:49:27 /usr/libexec/airportd
```
