import type { ResourceGuide } from "./resources";

export const RESOURCE_SPECIALTIES: ResourceGuide[] = [
  {
    "id": "audio-recovery",
    "title": "Audio & media recovery",
    "summary": "An audio recording contains more than the sounds you notice on the first listen: it also has channels, timing, and information about how it was stored. Audio analysis helps you understand those layers, while restoration explores whether an existing sound can be made clearer.",
    "tools": [
      {
        "id": "audio-channel-isolation",
        "name": "FFmpeg: isolate audio channels",
        "platform": "Windows, macOS, or Linux; install the official FFmpeg toolchain",
        "when": "Use a self-recorded, 16-bit PCM stereo WAV to separate left and right evidence. Start with the ffprobe stream guide in Steganography to verify its channels and sample format.",
        "steps": [
          "Hash the original and work on a copy named sample.wav. Record a different harmless sound on each channel, using a known stereo PCM recording setup.",
          "Verify that the input has two channels and pcm_s16le audio. Run the two commands below; -n refuses to overwrite an existing output.",
          "Import left.wav and right.wav into an editor. Compare the same timestamp, waveform, and spectrogram; keep the original channel labels in your notes.",
          "Explain which channel contains each sound, then compare a separate mono mix. Describe any information the mix obscures and retain both derived files."
        ],
        "example": {
          "label": "Extract channels from your 16-bit stereo PCM teaching file",
          "code": "ffmpeg -n -i sample.wav -map 0:a:0 -af \"pan=mono|c0=c0\" -c:a pcm_s16le left.wav\nffmpeg -n -i sample.wav -map 0:a:0 -af \"pan=mono|c0=c1\" -c:a pcm_s16le right.wav"
        },
        "observe": "Channels can contain different evidence. With the specified PCM input, isolation keeps the selected channel's samples; mixing is a separate transformation.",
        "pitfall": "These commands assume two-channel 16-bit PCM. Resampling, bit-depth reduction, and lossy conversion can change evidence; conversion cannot recreate discarded detail.",
        "links": [
          {
            "label": "FFmpeg: pan filter and channel mapping",
            "href": "https://ffmpeg.org/ffmpeg-filters.html#pan"
          },
          {
            "label": "FFmpeg: output handling and -n",
            "href": "https://ffmpeg.org/ffmpeg.html"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "audio-restoration",
        "name": "Audacity: noise profiles & restoration limits",
        "platform": "Windows, macOS, or Linux desktop",
        "when": "Use a self-recorded speech-and-fan-noise sample to learn restoration. Work on duplicate tracks so an apparent improvement can be compared with untouched evidence.",
        "steps": [
          "Import your working copy and duplicate its track. Label one Original and mute it while processing the other; record all effect settings.",
          "Find a short interval containing only steady background noise. Use Noise Reduction to capture its noise profile; a speech-containing selection teaches the wrong profile.",
          "Preview a modest reduction on the duplicate. Listen both to the retained audio and to the residue being removed; lower the reduction if meaningful sound disappears.",
          "Compare the same interval against Original and inspect its spectrogram. Export to a new filename, retain the project, and report both improvements and processing artifacts."
        ],
        "observe": "Steady hiss may decrease while speech also becomes distorted. Spectrogram patterns can guide inspection but do not establish words or prove that a message exists.",
        "pitfall": "Heavy processing can manufacture convincing artifacts. Clipped, missing, or heavily compressed information may be unrecoverable; enhancement is not independent evidence of what was said.",
        "links": [
          {
            "label": "Audacity: noise reduction workflow and limitations",
            "href": "https://manual.audacityteam.org/man/noise_reduction.html"
          }
        ]
      },
      {
        "id": "ffmpeg-spectrogram",
        "name": "FFmpeg: reproducible spectrograms",
        "platform": "Windows, macOS, or Linux command line",
        "when": "Create a derived frequency-over-time view of a harmless recording to compare with a listening observation.",
        "steps": [
          "Choose a short recording you created, record its channels and sample rate, and preserve the original hash.",
          "Review the official showspectrumpic filter settings and choose a documented time/frequency scale and output size.",
          "Render to a new image filename with overwrite refusal enabled, keeping all chosen filter settings in your notes.",
          "Compare a known tone and a silent interval, explaining which visual changes reflect settings rather than a new signal."
        ],
        "observe": "Spectral resolution and color scale influence what becomes visible. A pattern needs reproducible settings and corroboration.",
        "pitfall": "A spectrogram does not decode meaning by itself. Do not infer speech or hidden messages from arbitrary visual patterns.",
        "links": [
          {
            "label": "FFmpeg: showspectrumpic filter",
            "href": "https://ffmpeg.org/ffmpeg-filters.html#showspectrumpic"
          }
        ]
      },
      {
        "id": "mediainfo-compare",
        "name": "MediaInfo: compare container and codec properties",
        "platform": "Windows, macOS, or Linux; desktop or CLI edition",
        "when": "Check whether two recording exports differ before attributing their appearance to hidden information.",
        "steps": [
          "Choose two exports of the same harmless recording and record a hash for each file.",
          "Open the files in MediaInfo and compare general-container and audio-stream fields separately.",
          "Record codec, sample rate, channel count, duration, and available bit-depth information, marking fields that are absent.",
          "Explain which conversion differences might affect later waveform or spectrogram analysis without modifying either export."
        ],
        "observe": "Container metadata and decoded signal properties are related but distinct; some values are estimated or unavailable.",
        "pitfall": "A format description is not a quality or authenticity verdict. Avoid uploading private recordings to online inspection services.",
        "links": [
          {
            "label": "MediaInfo: official capabilities and supported formats",
            "href": "https://mediaarea.net/en/MediaInfo"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Sampling and channels",
        "detail": "Sample rate limits represented frequency, while channels can preserve separate signals. Changing playback speed, channel mixing, or resampling changes the interpretation and sometimes the underlying evidence."
      },
      {
        "title": "Enhancement and recovery",
        "detail": "Filtering can expose a signal already present, but cannot reliably recreate information that was clipped or never recorded. Compare processed audio with the untouched original and listen for introduced artifacts."
      },
      {
        "title": "Measurements and perception",
        "detail": "Peak level, average level, spectral energy, and perceived loudness describe different properties. Document the measurement window and settings before comparing recordings."
      }
    ]
  },
  {
    "id": "network-defense",
    "title": "Network defense & DDoS",
    "summary": "Network defense is about keeping connected systems available and understanding the traffic moving between them. A denial-of-service attack tries to interrupt that availability; learning to investigate one begins with recognizing normal demand, bottlenecks, and the signals of a service under pressure.",
    "tools": [
      {
        "id": "network-ddos-triage",
        "name": "Availability triage: logs & baselines",
        "platform": "Spreadsheet or text editor; offline synthetic metrics",
        "when": "Use request, error, and latency measurements to investigate a fictional availability incident. DoS reduces availability; DDoS uses distributed sources. Neither is established by a busy graph alone.",
        "steps": [
          "Copy the fictional table below into your notes. Label requests and errors as per-minute counts and latency as a percentile, not an average.",
          "Compare the incident minute with both quiet minutes. Calculate error proportions as well as request growth; keep the original units.",
          "List competing explanations: a legitimate flash crowd, a failed dependency, an expensive endpoint, or hostile traffic. State what edge, application, and host evidence would distinguish them.",
          "Write a short incident hypothesis and uncertainty statement. Analyze a supplied capture or log export if available; no traffic generation is needed for this exercise."
        ],
        "example": {
          "label": "Fictional availability measurements; no requests are sent",
          "code": "minute,requests,errors,p95_ms\n12:00,120,1,85\n12:01,135,1,90\n12:02,900,180,1300"
        },
        "observe": "The last minute has higher demand, a larger error share, and worse tail latency. Those observations demonstrate an availability problem, not its cause or attribution.",
        "pitfall": "Source IP counts can be distorted by proxies and shared networks. Application logs also cannot measure traffic dropped before reaching the application.",
        "links": [
          {
            "label": "Cloudflare: application-layer DDoS concepts",
            "href": "https://www.cloudflare.com/learning/ddos/application-layer-ddos-attack/"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "network-resilience-review",
        "name": "Layered mitigation & response planning",
        "platform": "Offline architecture sketch and saved incident metrics",
        "when": "Use the fictional incident to select controls at the layer experiencing pressure. This is a tabletop exercise, with no flooding, public targets, or live configuration changes.",
        "steps": [
          "Sketch client, edge/CDN, application queue, and database. Locate the bottleneck: volumetric bandwidth saturation, protocol or connection exhaustion, or application-layer CPU and queue pressure.",
          "Assign candidate controls: upstream filtering for network pressure, caching for repeatable responses, and bounded queues, request budgets, or rate limits for application work.",
          "For each control, write the evidence needed, an owner, a rollback condition, and a false-positive example such as many students sharing one campus address.",
          "Compare fictional before/after error and latency measurements. Decide whether legitimate service recovered and whether rejected traffic moved the bottleneck elsewhere; retain a response timeline."
        ],
        "observe": "An HTTP rate limit cannot repair a saturated upstream link. A successful response protects legitimate users and restores service, rather than merely reducing a request counter.",
        "pitfall": "Copying a provider rule or threshold into production without a baseline can block real users. Any future load test needs a separately approved, bounded lab plan and stop conditions.",
        "links": [
          {
            "label": "Cloudflare: network and HTTP DDoS managed rulesets",
            "href": "https://developers.cloudflare.com/ddos-protection/managed-rulesets/"
          }
        ]
      },
      {
        "id": "tshark-offline",
        "name": "TShark: repeatable offline packet summaries",
        "platform": "Windows, macOS, or Linux; Wireshark command-line tools",
        "when": "Translate an offline packet observation into a reproducible field-level report.",
        "steps": [
          "Obtain a small sanitized capture, record its hash, and note its capture location and duration.",
          "Use -r to select the saved file explicitly; choose fields appropriate to protocols actually present.",
          "Print packet number, relative time, and protocol fields for a small bounded sample and compare them with Wireshark.",
          "Describe missing packets, encrypted payload, and vantage-point limitations before generalizing the result to an incident."
        ],
        "observe": "Explicit fields make comparisons reproducible, while capture quality still limits the conclusion.",
        "pitfall": "Without -r, TShark may attempt live capture. Do not mistake a display filter or limited sample for the complete traffic population.",
        "links": [
          {
            "label": "Wireshark: TShark manual",
            "href": "https://www.wireshark.org/docs/man-pages/tshark.html"
          }
        ],
        "example": {
          "label": "Read a bounded sample from a saved training capture",
          "code": "tshark -r training.pcapng -c 20 -T fields -e frame.number -e frame.time_relative -e _ws.col.Protocol"
        }
      },
      {
        "id": "zeek-offline",
        "name": "Zeek: connect protocol logs to packets",
        "platform": "Linux or another supported Unix-like environment",
        "when": "Create structured protocol evidence from a saved teaching capture instead of collecting live network traffic.",
        "steps": [
          "Place a verified synthetic capture outside a fresh output directory and record the input hash.",
          "From the empty output directory, run Zeek with -r pointing to that saved capture and JSON log output enabled.",
          "Compare connection identifiers and timestamps across the logs that were actually produced, then trace one observation back to packets.",
          "Document missing protocol logs, encrypted content, and incomplete connections as analysis limits rather than suspicious findings by default."
        ],
        "observe": "Protocol logs summarize observed traffic; they are a derived representation rather than a replacement for the original capture.",
        "pitfall": "Use an empty output directory because log filenames can recur. Protocol visibility depends on the capture and enabled analyzers.",
        "links": [
          {
            "label": "Zeek: offline capture analysis quick start",
            "href": "https://docs.zeek.org/en/current/quickstart.html"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Protocol layers and vantage points",
        "detail": "Bandwidth saturation, connection exhaustion, and expensive application work need different measurements. A server log cannot show packets discarded upstream."
      },
      {
        "title": "Baseline and legitimate demand",
        "detail": "Compare request rates, errors, latency percentiles, and resource use with normal traffic. A flash crowd or broken dependency can resemble an attack in a single graph."
      },
      {
        "title": "Resilience and response",
        "detail": "Locate the exhausted resource before selecting caching, budgets, queues, rate limits, or upstream filtering. Assess whether legitimate users recover, and keep rollback conditions for false positives."
      }
    ]
  },
  {
    "id": "scripting-automation",
    "title": "Scripting & automation",
    "summary": "Scripting lets you turn a repeatable task into a small program, such as organizing records or summarizing a log. In cybersecurity, a useful script makes a careful investigation easier to repeat while keeping its assumptions and mistakes visible.",
    "tools": [
      {
        "id": "automation-python-jsonl",
        "name": "Python: bounded JSONL triage",
        "platform": "Python 3; standard library only",
        "when": "Use a small offline JSONL fixture to count response statuses. Each line is one JSON object; these are fictional records, not live requests.",
        "steps": [
          "Create sample.jsonl with two UTF-8 lines: {\"status\":200,\"path\":\"/training\"} and {\"status\":503,\"path\":\"/training\"}. Put each object on its own line and retain an unchanged copy.",
          "Save the script below as triage.py beside the fixture and run python triage.py. It reads at most 65,537 bytes so an oversized file is rejected without loading the entire input.",
          "Require status to be an integer from 100 through 599 before counting it. Report the line number on failure instead of silently discarding a surprising row.",
          "Compare your totals with the two-line fixture. Add a malformed line to a separate copy and confirm that the script fails visibly rather than producing a believable partial report."
        ],
        "example": {
          "label": "triage.py: a bounded parser for your synthetic sample.jsonl",
          "code": "from collections import Counter\nimport json\nfrom pathlib import Path\n\nwith Path(\"sample.jsonl\").open(\"rb\") as source:\n    data = source.read(65537)\nif len(data) > 65536:\n    raise SystemExit(\"sample.jsonl exceeds 65536 bytes\")\ncounts = Counter()\nfor line_no, raw in enumerate(data.splitlines(), 1):\n    if line_no > 500:\n        raise SystemExit(f\"line {line_no}: limit is 500 records\")\n    try:\n        row = json.loads(raw.decode(\"utf-8\"))\n    except (UnicodeDecodeError, json.JSONDecodeError):\n        raise SystemExit(f\"line {line_no}: invalid UTF-8 or JSON\") from None\n    if not isinstance(row, dict) or type(row.get(\"status\")) is not int:\n        raise SystemExit(f\"line {line_no}: status must be an integer 100..599\")\n    if not 100 <= row[\"status\"] <= 599:\n        raise SystemExit(f\"line {line_no}: status must be an integer 100..599\")\n    counts[row[\"status\"]] += 1\nprint(json.dumps(dict(sorted(counts.items()))))"
        },
        "observe": "The valid fixture has one successful response and one server error. Schema checks separate a missing status from an actual status value.",
        "pitfall": "Iteration alone does not bound an enormous line; limit input size too. Never use eval or execute text from a log, and do not include tokens in shared output.",
        "links": [
          {
            "label": "Python: JSON parsing and input-size caution",
            "href": "https://docs.python.org/3/library/json.html"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "automation-powershell-inventory",
        "name": "PowerShell: structured file inventory",
        "platform": "PowerShell 7; local practice directory",
        "when": "Use a small inventory to compare files by properties rather than screen-formatted text. This example lists immediate files without recursively traversing a folder tree.",
        "steps": [
          "Create a practice folder with two harmless text files. Record its resolved path and keep inventory output outside that folder if you later save it.",
          "Run the read-only command below. Select the properties you need before converting objects to JSON; do not parse the spacing of a formatted table.",
          "Check that Length is numeric and LastWriteTimeUtc has an unambiguous meaning. Record SHA-256 separately when you need byte-identity evidence; size and timestamp alone are insufficient.",
          "Compare the output before and after changing only a copy. Document missing files, access errors, and symbolic links instead of broadening traversal or suppressing failures."
        ],
        "example": {
          "label": "Read immediate file properties as JSON",
          "code": "Get-ChildItem -LiteralPath .\\practice -File |\n  Select-Object Name, Length, LastWriteTimeUtc |\n  ConvertTo-Json -Depth 3"
        },
        "observe": "Structured output keeps numeric properties distinct from strings. Selecting fields also avoids accidentally serializing a large object graph.",
        "pitfall": "Pipeline output may be one object or an array depending on item count; downstream code must handle its intended shape. Inventory scripts should never move, rewrite, or delete evidence.",
        "links": [
          {
            "label": "Microsoft: ConvertTo-Json and serialization depth",
            "href": "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/convertto-json"
          }
        ]
      },
      {
        "id": "sqlite-triage",
        "name": "SQLite CLI: query a read-only evidence copy",
        "platform": "Windows, macOS, or Linux command line",
        "when": "Aggregate a small synthetic event table without parsing screen-formatted output or changing the source.",
        "steps": [
          "Use a teaching database containing an events table and document its columns and row meaning.",
          "Open the file with the CLI read-only option and inspect its schema before writing a SELECT query.",
          "Group events by a documented field and compare counts with a tiny fixture whose expected result you calculated manually.",
          "Check NULL handling and duplicate rows, then record the query and output without creating or altering tables."
        ],
        "observe": "SQL handles grouping and explicit NULL behavior, but reliable totals still depend on the table grain.",
        "pitfall": "Work from a consistent export rather than copying a live database arbitrarily. Do not enable extensions or execute SQL supplied by strangers.",
        "links": [
          {
            "label": "SQLite: command-line shell and read-only databases",
            "href": "https://sqlite.org/cli.html"
          }
        ]
      },
      {
        "id": "argparse-fixtures",
        "name": "Python argparse: explicit inputs and reproducible runs",
        "platform": "Python 3; standard library only",
        "when": "Give a small local investigation script a clear interface before reusing it on another fixture.",
        "steps": [
          "Take the bounded JSONL parser and identify its input path and record limit as explicit parameters.",
          "Add argparse definitions with useful help text, a numeric limit, and an input-path argument while retaining the parser validation.",
          "Run --help, a valid fixture, an invalid limit, and a missing file; compare exit behavior and diagnostic clarity.",
          "Record one complete invocation with its expected output and keep malformed-input fixtures alongside the valid case."
        ],
        "observe": "A clear interface makes assumptions visible and lets another person repeat the same investigation.",
        "pitfall": "Argument parsing does not validate file contents or authorize a target. Keep byte limits and schema checks in the processing code.",
        "links": [
          {
            "label": "Python: argparse documentation",
            "href": "https://docs.python.org/3/library/argparse.html"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Bounded input",
        "detail": "Limit bytes, records, and expensive operations before parsing untrusted data. Streaming by itself does not protect against a single enormous line."
      },
      {
        "title": "Schema and error handling",
        "detail": "Validate the fields you actually use and report the failing record without leaking its sensitive content. Silent skips can turn an incomplete investigation into a convincing but wrong report."
      },
      {
        "title": "Repeatable interfaces",
        "detail": "Explicit arguments, stable output formats, exit codes, and small fixtures make scripts reviewable. Keep evidence-reading code separate from any operation that changes files or systems."
      }
    ]
  },
  {
    "id": "cloud-containers",
    "title": "Cloud & container security",
    "summary": "Cloud services and containers give applications flexible places to run, but their security still depends on configuration and access choices. This area explains how permissions, network exposure, and isolation fit together, and who is responsible for each part.",
    "tools": [
      {
        "id": "cloud-container-review",
        "name": "Docker: configuration review",
        "platform": "Text editor; local Dockerfile and Compose teaching files",
        "when": "Use a static review to explain a container's privileges and exposure. Reading these files needs no image download, running container, or Docker daemon.",
        "steps": [
          "Open a teaching Dockerfile and Compose file. Identify the base image, final execution user, copied files, mounts, and published ports.",
          "Read the illustrative Compose fragment below. Explain what each setting requests, including why a loopback-bound port differs from publishing on every host interface.",
          "Check the surrounding sample for privileged mode, host namespace sharing, writable host mounts, and a mounted Docker socket. Describe which trust boundary each would cross.",
          "Write a review with proposed least-privilege settings and compatibility questions. Do not run the sample; static review cannot prove the application's runtime behavior."
        ],
        "example": {
          "label": "Illustrative Compose settings; review only",
          "code": "services:\n  training:\n    image: locally-built-training:demo\n    user: \"10001:10001\"\n    read_only: true\n    cap_drop: [ALL]\n    ports: [\"127.0.0.1:8080:8080\"]"
        },
        "observe": "Execution identity, Linux capabilities, filesystem writes, and network publishing are separate controls. A restricted setting still needs an application that works within it.",
        "pitfall": "Containers share their host kernel; configuration is not a complete isolation guarantee. Never mount personal directories or the Docker socket into an unfamiliar image.",
        "links": [
          {
            "label": "Docker: Compose service configuration reference",
            "href": "https://docs.docker.com/reference/compose-file/services/"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "cloud-plan-review",
        "name": "Terraform: sanitized plan & identity review",
        "platform": "Text editor or jq; a lab-supplied sanitized plan.json",
        "when": "Use an offline plan export to ask who gains access and what becomes reachable. This exercise does not initialize providers, contact a cloud account, or apply changes.",
        "steps": [
          "Obtain a synthetic or carefully sanitized plan.json from the training lab. Keep real plans and state private: a sensitive marker does not remove secret values from JSON output.",
          "Inspect resource_changes and each change's actions. Separate creates, updates, replacements, and deletes before interpreting the proposed after values.",
          "For identity, storage, and network changes, compare before and after. Ask which principal, action, resource, and condition grant access; flag broad scopes and newly public exposure for review.",
          "Record unknown values and provider-specific fields that need documentation. Write an approval question and a least-privilege alternative without changing or applying the plan."
        ],
        "example": {
          "label": "Read only change addresses and action lists from a sanitized export",
          "code": "jq '.resource_changes[] | {address, actions: .change.actions}' plan.json"
        },
        "observe": "An update can widen access without creating a new resource. Unknown planned values and inherited permissions limit what a single export establishes.",
        "pitfall": "A plan is proposed state, not evidence of a deployed control. Terraform JSON may contain plaintext secrets; do not upload real exports or run apply as part of this lesson.",
        "links": [
          {
            "label": "HashiCorp: show, plan JSON, and sensitive values",
            "href": "https://developer.hashicorp.com/terraform/cli/commands/show"
          }
        ]
      },
      {
        "id": "trivy-config",
        "name": "Trivy: review configuration findings",
        "platform": "Windows, macOS, or Linux; official Trivy installation",
        "when": "Analyze a local teaching configuration and explain why a static rule reported a setting.",
        "steps": [
          "Prepare a tiny Dockerfile or infrastructure fixture with no credentials and record the scanner and check versions.",
          "Use the documented configuration-scanning mode on that exact fixture, noting any check-bundle downloads required by the installed version.",
          "For one finding, locate the referenced configuration line and explain the resource and trust boundary affected.",
          "Compare a revised fixture with the original and record both the removed finding and any compatibility question the revision introduces."
        ],
        "observe": "A scanner finding encodes a check and assumptions; static success does not establish the running deployment state.",
        "pitfall": "Do not equate severity with confirmed impact or scan private configuration through an online service. No deployment is required for this exercise.",
        "links": [
          {
            "label": "Trivy: configuration and misconfiguration scanning",
            "href": "https://trivy.dev/docs/latest/scanner/misconfiguration/"
          }
        ]
      },
      {
        "id": "conftest-policy",
        "name": "Conftest: test a configuration policy",
        "platform": "Windows, macOS, or Linux; local fixtures and policy files",
        "when": "Turn one plain-language configuration expectation into a reviewable policy and test its edge cases.",
        "steps": [
          "Choose a simple teaching requirement, such as a container not requesting privileged execution.",
          "Use the official Conftest examples to create a policy for the exact configuration schema used by your fixture.",
          "Test compliant, noncompliant, and missing-field fixtures, keeping the expected outcome beside each input.",
          "Explain the policy result, its input assumptions, and which effective runtime controls remain outside the check."
        ],
        "observe": "A policy test makes an expectation repeatable and can reveal whether missing data accidentally passes.",
        "pitfall": "Policy language and input schemas have versions. Passing a local rule does not certify every setting or a cloud account.",
        "links": [
          {
            "label": "Conftest: policy evaluation and testing",
            "href": "https://www.conftest.dev/"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Shared responsibility",
        "detail": "A cloud provider secures some layers while the application owner remains responsible for identities, exposed resources, and data handling. State which boundary each configuration control protects."
      },
      {
        "title": "Desired and effective state",
        "detail": "A configuration file or proposed plan describes intent, not necessarily the running environment. Unknown values, inheritance, drift, and external policies limit a static review."
      },
      {
        "title": "Least privilege and isolation",
        "detail": "Identity permissions, network reachability, filesystem access, and process capabilities are separate controls. A restrictive setting needs both a compatible application and a way to verify that it is effective."
      }
    ]
  },
  {
    "id": "incident-response",
    "title": "Detection & incident response",
    "summary": "Detection is the work of noticing activity that deserves attention; incident response is the process of understanding it and deciding what to do next. Both rely on connecting evidence, considering other explanations, and keeping a clear record of decisions.",
    "tools": [
      {
        "id": "response-event-timeline",
        "name": "Get-WinEvent: exported event timelines",
        "platform": "Windows PowerShell or PowerShell 7 on Windows; permitted .evtx export",
        "when": "Use a small exported training log to connect events by time, provider, and record identifier. This reads a file instead of collecting logs from another computer.",
        "steps": [
          "Obtain a synthetic or permitted training.evtx export and record its SHA-256. Keep the original unchanged and note the export's source and time coverage.",
          "Run the bounded preview below. Retain ProviderName with Id because an event number alone does not identify a universal event meaning.",
          "Inspect the relevant records' details and XML. Normalize timestamps in your notes, preserve the original timezone, and distinguish event time from export time.",
          "Create a timeline that cites provider and RecordId for every observation. Mark gaps, clock uncertainty, and alternative explanations before proposing containment actions."
        ],
        "example": {
          "label": "Preview a permitted offline event export",
          "code": "Get-WinEvent -Path .\\training.evtx -MaxEvents 100 |\n  Select-Object TimeCreated, ProviderName, Id, RecordId"
        },
        "observe": "Related events may come from several providers. A bounded preview is an entry point, not proof that the rest of the export contains no relevant activity.",
        "pitfall": "Logs can contain personal data and command-line secrets. Do not clear logs, infer compromise from one event, or collect another person's records without permission.",
        "links": [
          {
            "label": "Microsoft: Get-WinEvent and exported log files",
            "href": "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.diagnostics/get-winevent"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "response-yara-fixtures",
        "name": "YARA: explainable fixture detection",
        "platform": "Windows, macOS, or Linux; YARA command line",
        "when": "Use a rule matching a harmless marker to understand static detection and false positives. The scanned fixture is plain text, with no executable content.",
        "steps": [
          "Create positive.txt containing DFCTF_TRAINING_MARKER and negative.txt containing an unrelated sentence. Keep both files small and local.",
          "Save the rule below as training.yar, then run yara training.yar positive.txt and repeat against negative.txt. The rule tests only the supplied file's bytes.",
          "Change one character in a copy of the positive marker and repeat. Explain precisely why the match changes rather than treating the rule name as an analysis result.",
          "Add an unrelated document containing the same marker to your test set. Record that false positive and explain which additional evidence a real detection decision would require."
        ],
        "example": {
          "label": "A harmless marker rule for your own text fixtures",
          "code": "rule training_marker {\n  strings:\n    $marker = \"DFCTF_TRAINING_MARKER\"\n  condition:\n    filesize < 65536 and $marker\n}"
        },
        "observe": "A match supports the rule's stated byte-pattern condition. It does not establish intent, family attribution, or whether a program was executed.",
        "pitfall": "A string rule is not an antivirus verdict. Do not execute unknown samples or recursively scan private folders just to find something that matches.",
        "links": [
          {
            "label": "YARA: strings, conditions, and file-size checks",
            "href": "https://yara.readthedocs.io/en/stable/writingrules.html"
          }
        ]
      },
      {
        "id": "sigma-detection",
        "name": "Sigma: explain a detection rule",
        "platform": "Text editor; synthetic event fixtures",
        "when": "Express a small log-detection hypothesis with its required source fields and false positives.",
        "steps": [
          "Choose a harmless marker event from a synthetic export and list its provider, fields, and collection assumptions.",
          "Create a teaching Sigma rule following the official structure, with an explicit log source, selection, and condition.",
          "Evaluate expected positive and negative fixture records manually or with the intended backend tooling.",
          "Document field mappings and legitimate matching activity before considering how the rule would behave in a real pipeline."
        ],
        "observe": "A portable rule still depends on the backend and normalization supplying the expected event fields.",
        "pitfall": "A generated query is not a tested detection. Do not omit known false positives or assume absent logs mean absent activity.",
        "links": [
          {
            "label": "Sigma: rule structure and detection basics",
            "href": "https://sigmahq.io/docs/basics/rules.html"
          }
        ]
      },
      {
        "id": "sigcheck-local",
        "name": "Sigcheck: signatures, hashes, and provenance",
        "platform": "Windows; Microsoft Sysinternals",
        "when": "Inspect a known teaching executable as data and connect its signature information to a provenance question.",
        "steps": [
          "Choose a self-built harmless executable or an official training file and preserve its origin and hash.",
          "Read Sigcheck help and select file-version, signature, and hash inspection without VirusTotal or sample-submission options.",
          "Inspect only that file and record signing identity, chain or verification errors, and timestamps as separate observations.",
          "Compare with another permitted build and explain why signed, unsigned, and failed-verification outcomes need context."
        ],
        "observe": "A signature supports a relationship to a signing key; it is not a general verdict that software is safe.",
        "pitfall": "Certificate checks can depend on trust and network conditions. Never enable upload options for private or unknown evidence.",
        "links": [
          {
            "label": "Microsoft Sysinternals: Sigcheck",
            "href": "https://learn.microsoft.com/en-us/sysinternals/downloads/sigcheck"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Evidence before conclusions",
        "detail": "Record what each source actually shows, its time coverage, and its collection limits. A suspicious string or event is a lead that needs corroboration."
      },
      {
        "title": "Detection engineering",
        "detail": "A useful rule identifies its log source, selection logic, expected matches, and false positives. Conversion into a query does not guarantee the deployed logging pipeline supplies the required fields."
      },
      {
        "title": "Response and preservation",
        "detail": "Containment, eradication, and recovery have different goals and can change evidence. Preserve relevant exports and record the decision, owner, and timeline before modifying a real environment."
      }
    ]
  },
  {
    "id": "identity-host-security",
    "title": "Identity & host security",
    "summary": "Identity security concerns who a user or program is, while access controls decide what that identity is allowed to do. Host security applies those ideas to a computer, its files, and its services so that the right people have the access they need.",
    "tools": [
      {
        "id": "identity-windows-acl",
        "name": "PowerShell: Windows ACL review",
        "platform": "Windows; PowerShell Get-Acl",
        "when": "Use a self-created practice folder to learn how Windows records access. Reading its security descriptor does not grant, revoke, or test another user's access.",
        "steps": [
          "Create a harmless practice folder in your own workspace and identify its exact path. Start with ordinary user privileges.",
          "Run the read-only command below. Identify the owner and examine each access entry's identity, rights, allow/deny type, and inheritance flag.",
          "Compare the folder with a self-created child file. Explain which entries were inherited and which identities are groups rather than individual people.",
          "Write a proposed access policy in plain language and list what effective-access checks would still be needed. Keep this lesson read-only; do not take ownership or edit ACLs."
        ],
        "example": {
          "label": "Read a practice folder's security descriptor",
          "code": "Get-Acl -LiteralPath .\\practice |\n  Format-List Owner, AccessToString"
        },
        "observe": "Ownership, group membership, inherited entries, and individual access rules describe different parts of the decision. An ACL listing alone is not a full effective-access test.",
        "pitfall": "Removing inherited rules or adding a broad allow entry can expose data or lock out users. Permission review does not require credential extraction or administrator elevation.",
        "links": [
          {
            "label": "Microsoft: Get-Acl security descriptors",
            "href": "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-acl"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "identity-linux-permissions",
        "name": "Linux: identity & permission baselines",
        "platform": "GNU/Linux or a disposable Linux lab; GNU coreutils",
        "when": "Use your own practice file to relate the current identity to owner, group, and mode bits. Commands print information without changing permissions.",
        "steps": [
          "Choose a plain file named notes.txt in your own lab directory. Run id to record the current user and supplementary groups; keep usernames private when sharing notes.",
          "Run stat with the format below. Read the symbolic mode alongside its octal value, owner, and group rather than memorizing one permission number.",
          "Inspect the parent directory too. Explain why file readability and permission to traverse its containing directories are separate requirements.",
          "Compare two self-owned files with different existing modes. Record questions about ACLs, mount behavior, or mandatory access controls without using sudo or changing the system."
        ],
        "example": {
          "label": "Read identity and GNU/Linux file permissions",
          "code": "id\nstat -c '%A %a %U %G %n' -- notes.txt ."
        },
        "observe": "Mode bits are one layer of access control. A directory's execute bit governs traversal; it does not mean the directory is an executable program.",
        "pitfall": "Windows-mounted files in WSL can follow different metadata rules. Do not infer effective access from mode bits alone or try broad chmod changes on real files.",
        "links": [
          {
            "label": "Debian/coreutils: stat format fields",
            "href": "https://manpages.debian.org/bookworm/coreutils/stat.1.en.html"
          },
          {
            "label": "Debian/coreutils: id and group information",
            "href": "https://manpages.debian.org/bookworm/coreutils/id.1.en.html"
          }
        ]
      },
      {
        "id": "accesschk-folder",
        "name": "AccessChk: compare permissions for an exact resource",
        "platform": "Windows; Microsoft Sysinternals",
        "when": "Review a self-owned training folder and compare effective-access evidence with its ACL listing.",
        "steps": [
          "Identify the exact teaching folder and your own account, using ordinary user privileges.",
          "Read the documented AccessChk syntax and request file-permission information for that single resource and account.",
          "Compare the reported permissions with Get-Acl output, noting group and inheritance assumptions.",
          "Record a proposed access expectation and what additional account or policy evidence would be needed to verify it."
        ],
        "observe": "A resource-specific check narrows the question more effectively than collecting broad permission listings.",
        "pitfall": "Do not broaden the exercise to unrelated users, services, or remote machines, or change permissions merely to make an output match.",
        "links": [
          {
            "label": "Microsoft Sysinternals: AccessChk",
            "href": "https://learn.microsoft.com/en-us/sysinternals/downloads/accesschk"
          }
        ]
      },
      {
        "id": "getfacl-masks",
        "name": "getfacl: ACL entries and effective masks",
        "platform": "Linux filesystem with ACL support; optional ACL tools package",
        "when": "Explain why an ACL can express more than the owner/group/other mode bits.",
        "steps": [
          "Select a self-owned training file and directory and record their ordinary mode and ownership with stat.",
          "Read their ACLs with getfacl and identify named entries, the mask, and any default directory ACL.",
          "Explain any effective-rights annotation by comparing the entry with its mask, without modifying the ACL.",
          "Document whether the filesystem supports ACLs and distinguish inherited directory defaults from the existing file access ACL."
        ],
        "observe": "The ACL mask can limit named-user and group-class rights even when an individual entry appears permissive.",
        "pitfall": "An ACL listing does not cover every mandatory or mount-based control. Do not use broad chmod or setfacl commands on real evidence.",
        "links": [
          {
            "label": "Linux ACL project: getfacl manual",
            "href": "https://man7.org/linux/man-pages/man1/getfacl.1.html"
          }
        ],
        "example": {
          "label": "Read ACLs without changing permissions",
          "code": "getfacl -- notes.txt ."
        }
      }
    ],
    "concepts": [
      {
        "title": "Identity and effective access",
        "detail": "Authentication identifies a principal; authorization evaluates its requested action. Group membership, inheritance, deny entries, ACL masks, and other operating-system controls can change the effective result."
      },
      {
        "title": "Privilege boundaries",
        "detail": "Administrative rights, file ownership, service identity, and application permissions are distinct. Review an exact resource and account rather than assuming one privilege answers every access question."
      },
      {
        "title": "Local and organizational controls",
        "detail": "A local permission listing does not describe all directory, device-management, or cloud policies. State which host and filesystem the evidence represents and what additional checks remain."
      }
    ]
  },
  {
    "id": "mobile-wireless",
    "title": "Mobile, wireless & IoT",
    "summary": "Phones, wireless networks, and connected devices combine software, hardware, and communication in one system. Understanding their security means looking at what an app contains, what a device can access, and what its network activity can actually tell you.",
    "tools": [
      {
        "id": "mobile-apk-analysis",
        "name": "Android Studio: APK Analyzer",
        "platform": "Windows, macOS, or Linux; self-built Android teaching APK",
        "when": "Use APK Analyzer to inspect your own packaged application without installing or running it. Compare the manifest and bundled resources with the source you built.",
        "steps": [
          "Build a harmless sample you own or obtain an explicitly permitted teaching APK. Record its hash, build type, and origin before inspection.",
          "Open Android Studio's Build > Analyze APK, then select the local file. Expand the file tree and identify the manifest, DEX files, resources, and bundled libraries.",
          "Read the reconstructed manifest. Note declared permissions, exported components, SDK targets, and application settings; distinguish declarations from observed runtime use.",
          "Compare a debug and release build of your own sample. Document meaningful differences and which questions would require a separately isolated emulator test."
        ],
        "observe": "The package shows what was bundled and declared. A permission can be unused, and a static URL string does not prove that a connection occurred.",
        "pitfall": "Do not install unfamiliar APKs on a personal device or treat static review as a complete mobile assessment. Avoid distributing private app packages or embedded identifiers.",
        "links": [
          {
            "label": "Android Developers: APK Analyzer workflow",
            "href": "https://developer.android.com/studio/debug/apk-analyzer"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "wireless-offline-capture",
        "name": "Wireshark: supplied wireless & IoT captures",
        "platform": "Windows, macOS, or Linux; offline permitted .pcapng fixture",
        "when": "Use a sanitized training capture to distinguish link, network, and application evidence. No adapter capture, nearby-device discovery, deauthentication, or password guessing is required.",
        "steps": [
          "Open a supplied capture in Wireshark and record its hash, link type, duration, and capture location from the lab notes.",
          "Inspect Protocol Hierarchy and a representative packet's decoded layers. Determine whether the file contains wireless headers, ordinary Ethernet, or another link type before choosing filters.",
          "Apply a display filter for a protocol actually present, such as dns. Trace an exchange using packet numbers and timestamps, and separate decoded payload from encrypted bytes.",
          "Describe one observed device conversation and its limitations. Record whether name resolution, missing packets, or the capture vantage point could change your interpretation."
        ],
        "example": {
          "label": "Display filter for a permitted capture containing DNS",
          "code": "dns"
        },
        "observe": "An offline capture can show endpoints and timing without revealing encrypted application content. Wireless behavior cannot be inferred from headers the capture never recorded.",
        "pitfall": "Display filters hide packets without deleting them. MAC addresses, device names, and DNS questions can identify people; use sanitized fixtures and keep original captures private.",
        "links": [
          {
            "label": "Wireshark: captured packets, display filters, and time references",
            "href": "https://www.wireshark.org/docs/wsug_html_chunked/ChapterWork.html"
          }
        ]
      },
      {
        "id": "jadx-static",
        "name": "JADX: inspect a self-built Android package",
        "platform": "Windows, macOS, or Linux; official JADX release",
        "when": "Compare decompiled application logic with the source of a harmless app you built.",
        "steps": [
          "Record the hash and build configuration of your own teaching APK before opening it in JADX GUI.",
          "Find a known class and string, then follow references to the method where the string is used.",
          "Compare the decompiled control flow and resources with your original source and APK Analyzer observations.",
          "Record unresolved code, obfuscation, and inferred names, separating static possibilities from demonstrated runtime behavior."
        ],
        "observe": "Decompiled source is an approximation; references and bytecode provide supporting evidence for important claims.",
        "pitfall": "Do not redistribute private packages or install an unfamiliar APK on a personal device. Static inspection does not prove every runtime path.",
        "links": [
          {
            "label": "JADX: official project and usage",
            "href": "https://github.com/skylot/jadx"
          }
        ]
      },
      {
        "id": "binwalk-signatures",
        "name": "Binwalk: firmware signatures and offsets",
        "platform": "Linux or supported build environment; synthetic firmware fixtures",
        "when": "Locate candidate embedded formats in a teaching firmware container without extracting or executing them.",
        "steps": [
          "Use a synthetic or explicitly permitted firmware file and record its hash and provenance.",
          "Inspect the documented signature-scan mode and keep extraction, recursive extraction, and external helpers disabled.",
          "Compare reported offsets with a bounded hex preview and a known component you intentionally placed in the fixture.",
          "Explain false matches, compressed regions, and which evidence would be required before attempting a separately isolated extraction."
        ],
        "observe": "A signature identifies a candidate format at an offset; it does not prove the whole embedded component is valid.",
        "pitfall": "Extraction can invoke additional parsers and create many files. This exercise performs static signature triage only.",
        "links": [
          {
            "label": "Binwalk: official firmware analysis project",
            "href": "https://github.com/ReFirmLabs/binwalk"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Package versus behavior",
        "detail": "A manifest, decompiled method, or embedded endpoint describes packaged content. It does not by itself establish which code ran or which permissions were exercised."
      },
      {
        "title": "Capture visibility",
        "detail": "Encryption, capture location, link type, and missing packets constrain what wireless evidence reveals. Distinguish an observed endpoint from a claim about the device owner."
      },
      {
        "title": "Firmware and device boundaries",
        "detail": "Firmware packages can contain nested formats, compressed regions, and executable components. Static signatures locate candidates; extraction or execution requires a separate isolated analysis plan."
      }
    ]
  }
];
