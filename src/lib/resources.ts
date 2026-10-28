import { RESOURCE_SPECIALTIES } from "./resource-specialties";

export type ResourceTool = {
  id: string;
  name: string;
  platform: string;
  when: string;
  steps: string[];
  example?: { label: string; code: string };
  observe: string;
  pitfall: string;
  links: { label: string; href: string }[];
};

export type ResourceGuide = {
  id: string;
  title: string;
  summary: string;
  tools: ResourceTool[];
  deeper: ResourceTool[];
  concepts: { title: string; detail: string }[];
};

export const RESOURCE_GUIDES: ResourceGuide[] = [
  {
    "id": "general-skills",
    "title": "General skills",
    "summary": "General skills are the everyday foundations of cybersecurity: understanding files, reading unfamiliar data, and keeping track of what you discover. They help you make sense of a clue before deciding which specialist tool might help.",
    "tools": [
      {
        "id": "powershell",
        "name": "PowerShell 7",
        "platform": "Windows native; also available on macOS and Linux",
        "when": "Use a shell to find files, inspect short text, and record a file's SHA-256 so you can tell later whether a copy has changed. You do not need a Linux terminal for these first steps.",
        "steps": [
          "Create a separate practice folder and put a self-written notes.txt inside it. In Windows Terminal, select a PowerShell profile and use Get-Location to confirm where commands will run.",
          "List the folder with Get-ChildItem. Read a small preview with Get-Content -LiteralPath .\\notes.txt -TotalCount 20; -LiteralPath treats square brackets in filenames as ordinary characters.",
          "Compute the file hash with the command below. Compare the complete hexadecimal value with a trusted expected digest; letter case does not matter, but every digit does.",
          "Change one character in a separate copy, hash that copy, and record the difference. Keep your notes beside the working copy rather than editing the original evidence."
        ],
        "example": {
          "label": "PowerShell: inspect a file you created",
          "code": "Get-Content -LiteralPath .\\notes.txt -TotalCount 20\nGet-FileHash -LiteralPath .\\notes.txt -Algorithm SHA256"
        },
        "observe": "The preview contains your text, and the hash is 64 hexadecimal characters. A changed byte produces a different digest.",
        "pitfall": "A matching hash establishes byte equality with the reference, not that a file is harmless. Avoid opening arbitrary executables or treating a filename extension as proof of file type.",
        "links": [
          {
            "label": "Microsoft: Get-Content",
            "href": "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-content"
          },
          {
            "label": "Microsoft: Get-FileHash",
            "href": "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/get-filehash?view=powershell-7.5"
          }
        ]
      },
      {
        "id": "cyberchef",
        "name": "CyberChef",
        "platform": "Browser; an official downloaded build can run locally",
        "when": "Use CyberChef when a short piece of synthetic data looks encoded, escaped, compressed, or represented as hexadecimal. A visible recipe makes each transformation easier to inspect and undo.",
        "steps": [
          "Open the official application or its downloaded local build. Start a fresh recipe, then paste SGVsbG8= into Input. This example is the ordinary greeting Hello, not a challenge answer.",
          "Search Operations for From Base64 and drag it into Recipe. Read Output, then disable the operation briefly to distinguish the original input from its decoded representation.",
          "Replace the input with 48656c6c6f and replace the operation with From Hex. Compare the two routes to the same bytes instead of assuming every readable result proves a hypothesis.",
          "For your own practice strings, add one operation at a time and write down its settings. Preserve a plain-text description of the recipe so you can repeat the experiment without sharing its input."
        ],
        "example": {
          "label": "Synthetic input and recipe",
          "code": "Input: SGVsbG8=\nRecipe: From Base64\nExpected output: Hello"
        },
        "observe": "Two different encodings can describe the same text. Encoding changes representation; it does not provide secrecy.",
        "pitfall": "Magic suggestions are leads, not evidence. Recipe links can embed input: never share actual flags, private artifacts, tokens, or personal data in those URLs.",
        "links": [
          {
            "label": "Official CyberChef application",
            "href": "https://gchq.github.io/CyberChef/"
          },
          {
            "label": "GCHQ: usage and local builds",
            "href": "https://github.com/gchq/CyberChef"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "format-hex",
        "name": "PowerShell: file signatures and byte offsets",
        "platform": "PowerShell 7 on Windows, macOS, or Linux",
        "when": "Use a short hexadecimal preview to test whether a file matches its claimed format before opening a viewer or trying an extraction.",
        "steps": [
          "Choose a tiny PNG or ZIP you created. Keep its original and use a working copy named sample.bin so the extension does not influence your first observation.",
          "Read the first 64 bytes with Format-Hex. The offset column is a byte position, the hexadecimal column is the data, and the character column is only a possible rendering.",
          "Compare the opening bytes with the format documentation: a PNG begins with 89 50 4E 47 0D 0A 1A 0A. Confirm with a format-aware reader instead of accepting a short match alone.",
          "Record the offset, exact bytes, expected format, and next check. Compare a second self-created file to separate a format header from content-specific data."
        ],
        "observe": "Renaming the file changes its name, not its bytes. A signature is a useful lead but does not establish that the entire structure is valid.",
        "pitfall": "Do not patch the original or infer that every matching byte sequence is a complete embedded file. Format-Hex displays bytes; it does not validate or repair them.",
        "links": [
          {
            "label": "Microsoft: Format-Hex",
            "href": "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/format-hex"
          },
          {
            "label": "W3C: PNG datastream signature",
            "href": "https://www.w3.org/TR/png-3/#5PNG-file-signature"
          }
        ],
        "example": {
          "label": "PowerShell 7: bounded byte preview",
          "code": "Format-Hex -LiteralPath .\\sample.bin -Count 64"
        }
      },
      {
        "id": "python-text-boundaries",
        "name": "Python: byte and Unicode boundaries",
        "platform": "Python 3 standard library; no extra packages",
        "when": "Use explicit decoding when copied text looks wrong, a byte-order mark appears, or two visually identical strings produce different hashes.",
        "steps": [
          "Run the synthetic example below in a new Python file. It creates a few bytes in memory and never edits an artifact.",
          "Compare strict UTF-8 decoding with utf-8-sig. The latter recognizes a leading UTF-8 byte-order mark; repr makes the otherwise invisible character visible.",
          "Try decoding the same bytes as ASCII with strict errors and explain the failure. Keep the error instead of hiding it with errors=\"ignore\".",
          "For a small permitted file, read bytes first and record the chosen encoding separately. Confirm your interpretation with expected structure or a documented export format."
        ],
        "observe": "Byte length and character count measure different things. A successful decode does not prove you selected the intended encoding.",
        "pitfall": "Ignoring decode errors destroys evidence. Do not repeatedly re-save a file through guessed encodings; keep the original bytes and document each interpretation.",
        "links": [
          {
            "label": "Python: codecs and error handling",
            "href": "https://docs.python.org/3/library/codecs.html"
          },
          {
            "label": "Python: pathlib byte reads",
            "href": "https://docs.python.org/3/library/pathlib.html#pathlib.Path.read_bytes"
          }
        ],
        "example": {
          "label": "Python: a visible check for a UTF-8 byte-order mark",
          "code": "raw = b\"\\xef\\xbb\\xbfHello\"\nprint(repr(raw.decode(\"utf-8\")))\nprint(repr(raw.decode(\"utf-8-sig\")))\nassert raw.decode(\"utf-8-sig\") == \"Hello\""
        }
      },
      {
        "id": "sevenzip-list",
        "name": "7-Zip: inspect an archive before extraction",
        "platform": "Windows desktop; official 7-Zip File Manager",
        "when": "Inspect a ZIP you created to distinguish archive metadata from extracted files.",
        "steps": [
          "Create a small ZIP containing two harmless text files; preserve an untouched copy and its SHA-256.",
          "Open the copy in 7-Zip File Manager and inspect entry names, sizes, packed sizes, and directory structure without launching an entry.",
          "Compare the listing with the files you intentionally packaged. Explain the difference between compressed and uncompressed totals.",
          "Document unusual paths, unexpected types, and size expansion before deciding whether extraction is necessary."
        ],
        "observe": "An archive listing helps scope an investigation without treating its contents as trusted programs.",
        "pitfall": "A listing is not malware analysis. Do not extract unfamiliar archives into personal folders or overwrite existing files.",
        "links": [
          {
            "label": "7-Zip: official usage and format guidance",
            "href": "https://www.7-zip.org/faq.html"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Bytes, formats, and containers",
        "detail": "A filename is a label; signatures and internal structure describe the bytes. An archive can contain several file types, and changing an extension does not convert any of them."
      },
      {
        "title": "Representation and transformation",
        "detail": "Hexadecimal, Base64, text encodings, compression, and encryption solve different problems. Record each transformation and verify it against a known example before chaining operations."
      },
      {
        "title": "Reproducibility",
        "detail": "Keep originals separate from derived files and record hashes, tool versions, settings, and errors. A repeatable observation is stronger than an interesting-looking output."
      }
    ]
  },
  {
    "id": "osint",
    "title": "OSINT",
    "summary": "Open-source intelligence, or OSINT, means finding and checking information from public sources. It brings together clues from things such as published pages, photographs, and domain records to build a picture you can explain and support.",
    "tools": [
      {
        "id": "exiftool",
        "name": "ExifTool",
        "platform": "Windows native executable; Perl-based installation on macOS and Linux",
        "when": "Use ExifTool to read metadata before guessing what an image, document, or export might reveal. It can expose useful fields without needing to upload the file to an online service.",
        "steps": [
          "Choose a photograph you created that contains no private location or personal information. Work on a copy. Install only from the official project and follow its Windows executable naming instructions if applicable.",
          "Run the command below after making exiftool available in your terminal. If the executable is in the current PowerShell folder, invoke .\\exiftool.exe instead of relying on a PATH entry.",
          "Read the grouped fields: file properties, camera information, software, and timestamps describe different things. Note which group each observation came from rather than copying an isolated value.",
          "Compare the image with an export you make yourself. Record which fields disappear or change, then explain what the remaining metadata supports and what it cannot establish."
        ],
        "example": {
          "label": "Read metadata from your own sample",
          "code": "exiftool -G1 -a -s sample.jpg"
        },
        "observe": "Some fields may be absent, duplicated, editable, or inherited from an earlier export. Missing GPS metadata does not identify where a picture was taken.",
        "pitfall": "Keep this exercise read-only: assignment options such as -Tag=value write metadata. Timestamps and author fields are clues, not independently verified identity or provenance.",
        "links": [
          {
            "label": "Official ExifTool source and documentation",
            "href": "https://github.com/exiftool/exiftool"
          }
        ]
      },
      {
        "id": "google-lens",
        "name": "Google Lens",
        "platform": "Browser; online service that receives the submitted image or URL",
        "when": "Use reverse image search to find possible earlier appearances of a public, non-sensitive image. It is useful for source comparison, but it does not prove identity, authorship, or a precise location.",
        "steps": [
          "Pick an openly published illustration or landmark image that you are allowed to share. Do not use a private challenge artifact, a person's photograph, or an image containing documents or location details.",
          "Open Google Search, choose Search by image, and submit the permitted picture or its public image URL. Understand that this sends the image or URL to Google; use a different offline exercise if that is inappropriate.",
          "Compare several matching pages. Open the original pages and record their URLs, captions, publication context, and visible dates. A search thumbnail alone is not a reliable source.",
          "Crop a non-sensitive region and repeat once to see whether the results change. Distinguish an exact image match from a visually similar subject, and keep uncertainty explicit in your notes."
        ],
        "observe": "The useful result is a documented trail of candidate sources and matching details. An older visible page is a lead, not necessarily the first publication.",
        "pitfall": "Search rankings, inferred labels, and AI summaries can be wrong. Do not contact, identify, track, or accuse real people based on an image match.",
        "links": [
          {
            "label": "Google: search with an image",
            "href": "https://support.google.com/websearch/answer/1325808"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "rdap-source-check",
        "name": "ICANN Lookup: domain registration context",
        "platform": "Browser; public registration lookup with redacted fields",
        "when": "Use RDAP registration records to check a claim about a domain you own or an explicitly assigned training domain, without treating registration data as a person lookup.",
        "steps": [
          "Write the exact question first, such as whether a claimed website launch predates the displayed registration event. Use your own domain or the reserved example.com domain for practice.",
          "Open ICANN Lookup and inspect the returned registrar, domain status, nameserver, and event fields. Record the lookup time and the event label beside each date.",
          "Compare the record with an independent source you control, such as a deployment record. A registration date, an updated date, and a content publication date describe different events.",
          "Write one supported conclusion and one remaining uncertainty. Preserve the source URL and observation time rather than filling redacted fields with guesses."
        ],
        "observe": "RDAP can provide registration context while personal data remains unavailable. The domain registrant, hosting provider, and author of a page need not be the same party.",
        "pitfall": "A young domain is not proof of fraud, and privacy redaction is not suspicious by itself. Do not automate contact discovery or investigate private accounts.",
        "links": [
          {
            "label": "ICANN: Lookup FAQ",
            "href": "https://lookup.icann.org/en/faq"
          },
          {
            "label": "ICANN: RDAP overview",
            "href": "https://www.icann.org/rdap/"
          }
        ]
      },
      {
        "id": "image-corroboration",
        "name": "Image research: corroborate place and time",
        "platform": "Browser and your own notes; use permitted public images",
        "when": "Go beyond a visual match by testing whether visible landmarks, publication context, and dates support the same account of an image.",
        "steps": [
          "Choose a public landmark photograph with permission to investigate. List visible observations such as a sign, road layout, or building outline before making a location guess.",
          "Use Google About this image or image search to find other contexts. Open the source pages and distinguish a search snippet from the actual publication.",
          "Compare at least two independent clues using an official landmark or mapping source. Record disagreements and consider cropping, mirroring, renovation, or an old image reused in a new story.",
          "Build a small claim table: observation, source, date checked, confidence, and alternative explanation. Mark the capture time as unknown unless evidence actually supports it."
        ],
        "observe": "Finding an older indexed use can challenge a claim that a picture is new. It does not establish the first publication or the precise moment of capture.",
        "pitfall": "Do not infer a private person’s home or live location. Similar architecture, editable metadata, and repeated reposts are not independent confirmation.",
        "links": [
          {
            "label": "Google: About this image",
            "href": "https://support.google.com/websearch/answer/14177408"
          },
          {
            "label": "Google: image details and metadata",
            "href": "https://support.google.com/websearch/answer/9789430"
          }
        ]
      },
      {
        "id": "wayback-context",
        "name": "Wayback Machine: compare publication history",
        "platform": "Browser; public archive",
        "when": "Compare permitted public pages across archived captures while recording what each capture actually preserves.",
        "steps": [
          "Choose a public project page you maintain or a teaching page approved for this exercise; record its exact URL.",
          "Find two available captures in the Wayback Machine and note their capture dates separately from any date printed on the page.",
          "Compare one specific claim, image, or link across the captures and the current page, recording missing resources.",
          "Write a corroborated change statement with capture URLs and an explicit explanation of gaps in archive coverage."
        ],
        "observe": "An archived capture establishes that a representation was captured, not the exact time the original content changed.",
        "pitfall": "Absent captures do not prove a page never existed; archived scripts and images may come from different capture times.",
        "links": [
          {
            "label": "Internet Archive: using the Wayback Machine",
            "href": "https://help.archive.org/help/using-the-wayback-machine/"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Source provenance",
        "detail": "Separate an original publication from a repost, search snippet, and archived capture. Record the exact URL and retrieval date so another reader can assess the same source."
      },
      {
        "title": "Corroboration and uncertainty",
        "detail": "A matching username, photograph, or timestamp is a lead, not proof of identity or location. Compare independent sources and explicitly record conflicting observations."
      },
      {
        "title": "Time and geography",
        "detail": "Publication time, capture time, camera time, and archive time may differ. Compare visible landmarks and time-zone assumptions without treating missing metadata as evidence of absence."
      }
    ]
  },
  {
    "id": "steganography",
    "title": "Steganography",
    "summary": "Steganography is the practice of hiding information inside something that looks ordinary, such as a picture or an audio recording. Learning about it starts with understanding how those files store information and how a hidden signal might differ from normal content.",
    "tools": [
      {
        "id": "audacity",
        "name": "Audacity",
        "platform": "Windows, macOS, and Linux desktop application",
        "when": "Use Audacity to compare the waveform of a permitted audio sample with its spectrogram: a picture of frequency energy over time. This helps you reason about tones, gaps, and repeated patterns.",
        "steps": [
          "Create a new project and generate a short sine tone, such as 1000 Hz at a moderate amplitude. Keep playback volume low; this exercise needs observation rather than loud listening.",
          "Use the track dropdown to switch from Waveform to Spectrogram, or choose a combined view if your installed version offers it. Locate the time axis and frequency scale before interpreting shapes.",
          "Open the track's spectrogram settings and compare two window sizes. A larger window can separate nearby frequencies better, while a smaller one can show rapid timing changes more clearly.",
          "Generate a second, differently pitched tone in another short section. Describe the visible bands and their positions, then save the project separately from any imported evidence."
        ],
        "observe": "A steady tone appears near a fixed frequency; changes in pitch move the band. Display settings can change how convincing a pattern looks.",
        "pitfall": "Random audio can resemble letters or images. Do not treat a spectrogram as an automatic decoder, overwrite the source audio, or amplify unknown recordings without checking volume.",
        "links": [
          {
            "label": "Audacity: spectrogram view and settings",
            "href": "https://manual.audacityteam.org/man/spectrogram_view.html"
          }
        ]
      },
      {
        "id": "zsteg",
        "name": "zsteg",
        "platform": "Ruby command line; Linux or WSL is the recommended path for this guide",
        "when": "Use zsteg for a specific hypothesis about least-significant-bit data in a permitted PNG or BMP. It is a format-focused inspection tool, not a universal image decoder.",
        "steps": [
          "Install Ruby and zsteg using the project's documented gem installation in a disposable Linux practice environment. WSL is convenient for commands, but it does not isolate unknown files from your Windows data.",
          "Create a tiny PNG yourself with a drawing tool and keep an untouched copy. Run the basic inspection below; --no-file disables external file-type probing while leaving the normal textual findings visible.",
          "Read each result's channel and bit-order description. A report about red-channel low bits is a different hypothesis from combined RGB bits; write down the exact interpretation before trying another setting.",
          "Compare two images you generated with different flat colors. Use the project examples to learn the output notation, and stop when there is no evidence supporting a hidden payload."
        ],
        "example": {
          "label": "Inspect a self-created PNG",
          "code": "zsteg --no-file sample.png"
        },
        "observe": "A normal image may produce short strings or apparent file signatures by chance. No findings is also a valid observation.",
        "pitfall": "Do not run every extraction blindly or execute extracted content. This tool targets PNG/BMP; JPEG compression and unrelated hiding methods need different reasoning.",
        "links": [
          {
            "label": "Official zsteg usage and supported methods",
            "href": "https://github.com/zed-0xff/zsteg"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "sonic-visualiser",
        "name": "Sonic Visualiser: compare spectral patterns",
        "platform": "Desktop application for Windows, macOS, and Linux",
        "when": "Use another time-frequency view when a supplied training recording contains an unusual tone pattern and you want to test whether it survives different display settings.",
        "steps": [
          "Open a copy of a short recording you created with two different tones. Add a spectrogram layer using the official manual and keep the waveform visible for timing context.",
          "Compare the same interval at a short and a longer analysis window. Keep track of window size, frequency range, scale, and the selected audio channel.",
          "Mark the start and end of one visible tone and compare it with playback. Try the left and right channels separately when your sample is stereo.",
          "Save your annotations or notes alongside the original hash. Explain the trade-off you observed rather than treating one attractive spectrogram as the only valid view."
        ],
        "observe": "A longer window can separate nearby frequencies more clearly while smearing brief events in time. A line or shape is an observation, not automatically an encoded message.",
        "pitfall": "Avoid reading words into random spectral texture. Plugins are optional; start with built-in layers and do not install unknown analysis plugins for a first inspection.",
        "links": [
          {
            "label": "Sonic Visualiser: reference manual",
            "href": "https://www.sonicvisualiser.org/doc/reference/5.0.1/en/"
          }
        ]
      },
      {
        "id": "ffprobe-streams",
        "name": "ffprobe: inspect audio streams and containers",
        "platform": "FFmpeg command line; install from the project’s documented distribution options",
        "when": "Inspect an audio or video file’s streams before assuming that its extension, number of channels, sample rate, or duration tells the whole story.",
        "steps": [
          "Use two short media files you exported yourself, such as a stereo WAV and a compressed copy. Run the read-only command below on each local file.",
          "Identify the container format separately from each stream codec. Count audio streams and note sample_rate, channels, duration, and any tags that are actually present.",
          "Compare missing fields and duration differences. A container-level duration may be absent or differ from a stream’s duration; record which field you used.",
          "Use the stream inventory to choose the next inspection, such as separate channel views in Audacity. Keep the original media; probing is not evidence of a successful recovery."
        ],
        "observe": "A file can hold several streams and editable tags. Its container name and codec describe different layers of the media representation.",
        "pitfall": "Use a local filename, not an arbitrary remote URL. Probing parses the file, so use current tooling in an isolated environment for untrusted samples; do not publish private tags.",
        "links": [
          {
            "label": "FFmpeg: ffprobe options and JSON output",
            "href": "https://ffmpeg.org/ffprobe.html"
          }
        ],
        "example": {
          "label": "Read-only stream inventory for a local sample",
          "code": "ffprobe -v error -show_format -show_streams -of json sample.wav"
        }
      },
      {
        "id": "pngcheck-structure",
        "name": "pngcheck: image chunks and structural errors",
        "platform": "Command line; install the official pngcheck project",
        "when": "Inspect a self-created PNG before assuming an unusual image contains a hidden payload.",
        "steps": [
          "Create and hash a small PNG, then preserve that original while inspecting a copy.",
          "Run pngcheck in verbose mode on the copy and identify its image header, data chunks, and end marker.",
          "Compare a second export from your drawing tool, noting ancillary chunks, dimensions, and integrity diagnostics.",
          "Separate a format error from a hiding hypothesis and record the exact chunk or offset supporting your next investigation."
        ],
        "observe": "Chunk names, lengths, and integrity checks describe structure; a strange ancillary chunk is not automatically a secret.",
        "pitfall": "Do not repair the original or execute embedded content. Corruption and metadata can produce anomalies without deliberate hiding.",
        "links": [
          {
            "label": "pngcheck: official project and command reference",
            "href": "https://github.com/pnggroup/pngcheck"
          }
        ],
        "example": {
          "label": "Inspect a self-created PNG without modifying it",
          "code": "pngcheck -v sample.png"
        }
      }
    ],
    "concepts": [
      {
        "title": "Carrier and hiding method",
        "detail": "Pixel bits, image chunks, audio frequencies, channels, and appended bytes are different possible carriers. Select a technique that fits the actual file format rather than trying every decoder."
      },
      {
        "title": "Signal versus coincidence",
        "detail": "Random data often produces short printable strings and apparent signatures. Validate a candidate with its length, structure, settings, and an independent reproduction."
      },
      {
        "title": "Lossy transformations",
        "detail": "Resizing an image or recompressing audio can destroy the evidence you are testing. Preserve the original bytes and document every converted copy."
      }
    ]
  },
  {
    "id": "forensics",
    "title": "Forensics",
    "summary": "Digital forensics uses the traces left in files, devices, and recordings of activity to understand what happened. It is a little like reconstructing a story: each clue needs context, and the explanation should be supported by evidence someone else can check.",
    "tools": [
      {
        "id": "wireshark",
        "name": "Wireshark",
        "platform": "Windows, macOS, and Linux desktop application",
        "when": "Use Wireshark to read an existing packet capture and understand which hosts, protocols, requests, and responses it contains. Opening a saved capture does not require capturing your own network.",
        "steps": [
          "Open a permitted training .pcap or .pcapng through File → Open. Do not choose a live network interface. Note the capture's time range and the displayed packet-count information.",
          "Select one packet and compare the packet list, decoded protocol tree, and raw bytes. Expand a header and observe which bytes it describes; this connects a human-readable field to the evidence.",
          "Apply a display filter such as dns or tcp to narrow what you see. Clear it again and check the counts so you understand that filtering changes the view rather than deleting captured packets.",
          "If the training capture contains an ordinary TCP conversation, use Follow → TCP Stream on a relevant packet. Record both directions and the stream number, then verify any interesting text against its original packets."
        ],
        "example": {
          "label": "Display-filter examples for an existing training capture",
          "code": "dns\ntcp\nhttp.request"
        },
        "observe": "Protocols, endpoints, timings, and payload visibility depend on what was captured. Encrypted traffic may expose metadata without exposing message contents.",
        "pitfall": "Display filters and capture filters use different syntax. Never capture other people's traffic, collect credentials, or assume an absent packet proves an event never happened.",
        "links": [
          {
            "label": "Wireshark: working with captured packets",
            "href": "https://www.wireshark.org/docs/wsug_html_chunked/ChapterWork.html"
          }
        ]
      },
      {
        "id": "autopsy",
        "name": "Autopsy",
        "platform": "Windows desktop installation; consult official instructions for other platforms",
        "when": "Use Autopsy when a collection of files or a fictional disk image needs an organized case, keyword search, metadata view, and an evidence trail. A case stores analysis results separately from its source.",
        "steps": [
          "Make a small practice folder containing text files you wrote yourself, with a distinctive word in one file. Create a new case in a separate empty directory and give it a descriptive name.",
          "Add the practice folder using the logical-files data-source option. For a later disk-image exercise, select only an explicitly permitted training image; never point this walkthrough at your personal drive.",
          "Choose only the ingest modules needed for the exercise, such as file-type identification and keyword search. Wait for ingest to finish, then search for your distinctive word and open the matching result.",
          "Compare the displayed text, metadata, and source path. Tag the relevant result and produce a short report that distinguishes the source file from the generated case files."
        ],
        "observe": "You should be able to trace a search hit back to one known input file and repeat the search. Case output is an index of evidence, not a substitute for the original.",
        "pitfall": "Timestamps need timezone context, and recovered fragments can be incomplete. A logical-files exercise does not demonstrate recovery of deleted disk contents.",
        "links": [
          {
            "label": "Autopsy: official user guide",
            "href": "https://www.sleuthkit.org/autopsy/docs/user-docs/4.22.0/"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "photorec-image",
        "name": "PhotoRec: recover files from a training image",
        "platform": "Windows, macOS, or Linux; work on an image file rather than a live disk",
        "when": "Learn file carving when a supplied practice image has missing directory entries and ordinary file browsing cannot recover its contents.",
        "steps": [
          "Obtain a purpose-built training disk image with known expected files. Hash it, copy it, and choose an output directory on a different destination from the image’s source media.",
          "Open the image copy in PhotoRec following the official image-file instructions. Check the displayed input carefully; do not select your system disk or a personal storage device.",
          "Select the documented filesystem/search options for that fixture and recover into the separate output directory. Record the image hash, tool settings, and scan extent.",
          "Validate recovered files by format, readable content, and expected fixture hashes. Count duplicates and partial results separately; never execute recovered programs."
        ],
        "observe": "Carving finds recognizable content without necessarily recovering original filenames, folders, or complete fragmented files. A recovered file is not automatically attributable to a particular user.",
        "pitfall": "Writing results back to the source can overwrite recoverable bytes. An overwritten region cannot be recreated by choosing a more aggressive scan option.",
        "links": [
          {
            "label": "CGSecurity: PhotoRec recovery workflow",
            "href": "https://www.cgsecurity.org/testdisk_doc/photorec.html"
          },
          {
            "label": "CGSecurity: working with image files",
            "href": "https://www.cgsecurity.org/testdisk_doc/running.html#disk-image"
          }
        ]
      },
      {
        "id": "volatility-processes",
        "name": "Volatility 3: reconstruct an offline process tree",
        "platform": "Python environment and a permitted memory image; Windows plugins shown",
        "when": "Use a supplied synthetic or training memory image to compare process identifiers, parent relationships, and creation times without running the captured programs.",
        "steps": [
          "Use an image explicitly released for training and note the expected operating system. Hash the image and record the Volatility version; memory images may contain sensitive data.",
          "From the installed source checkout, run windows.info to inspect the image context. Resolve missing-symbol errors using the official documentation; they are not evidence that a process is absent.",
          "Run windows.pslist and windows.pstree on the same image. Match PID and PPID values and examine whether the reported timestamps support the proposed parent-child sequence.",
          "Write a small timeline with image offsets or process identifiers so another learner can repeat it. Treat an unusual name or parent as a lead requiring additional evidence."
        ],
        "observe": "The process tree is one snapshot of recorded memory, not a complete activity history. Volatility analysis does not acquire memory, and symbols may require a documented download.",
        "pitfall": "Do not extract credentials, publish memory contents, or run dumped executables. A plugin failure or a missing process name cannot by itself establish concealment.",
        "links": [
          {
            "label": "Volatility 3: Windows tutorial",
            "href": "https://volatility3.readthedocs.io/en/latest/getting-started-windows-tutorial.html"
          }
        ],
        "example": {
          "label": "Offline analysis from a Volatility source checkout",
          "code": "python vol.py -f training-memory.raw windows.info\npython vol.py -f training-memory.raw windows.pslist\npython vol.py -f training-memory.raw windows.pstree"
        }
      },
      {
        "id": "sleuthkit-filesystem",
        "name": "The Sleuth Kit: filesystem records in an image",
        "platform": "Linux or WSL command line; training disk images",
        "when": "Compare filesystem metadata with carved content using a supplied synthetic image.",
        "steps": [
          "Record the training image hash and whether it represents a whole disk or an individual filesystem.",
          "For a whole-disk image, inspect its partition layout with mmls and record the selected partition start in sectors.",
          "Use fls with the documented image offset to list a small directory; preserve inode, name, and deletion indicators.",
          "Compare those records with a PhotoRec result and explain which names, times, or content each method retains."
        ],
        "observe": "Filesystem-aware analysis may retain relationships that signature-based carving loses. An offset must use the units expected by the tool.",
        "pitfall": "Do not guess a byte offset where a sector offset is required, mount the source writable, or assume a deleted record guarantees recoverable bytes.",
        "links": [
          {
            "label": "The Sleuth Kit: fls file and directory listing",
            "href": "https://www.sleuthkit.org/sleuthkit/man/fls.html"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Acquisition and provenance",
        "detail": "A logical file export, disk image, memory image, and packet capture preserve different evidence. Record how a training artifact was produced and analyze a verified working copy."
      },
      {
        "title": "Metadata and recovered content",
        "detail": "Filesystem records can retain names and times while file carving searches for recognizable content. Neither guarantees that deleted files remain complete or that timestamps describe real-world actions."
      },
      {
        "title": "Timeline correlation",
        "detail": "Correlate records by timestamp, identifier, source, and time-zone assumptions. Distinguish a missing record from evidence that an action never occurred."
      }
    ]
  },
  {
    "id": "web-exploitation",
    "title": "Web exploitation",
    "summary": "Web security looks at how browsers, websites, and their servers exchange information and decide who can do what. Understanding those everyday interactions makes it easier to see how a website can accidentally expose information or trust the wrong input.",
    "tools": [
      {
        "id": "chrome-devtools",
        "name": "Chrome DevTools",
        "platform": "Chrome browser on Windows, macOS, or Linux",
        "when": "Use the Network panel to understand requests and responses before trying security exercises. A tiny local static page is enough to learn status codes, headers, resource types, and request timing.",
        "steps": [
          "Create an empty tutorial folder containing only a self-written index.html. Serve that folder on loopback using the example command; choose another unused port if 8000 is already occupied.",
          "Open http://127.0.0.1:8000 in Chrome, open Developer Tools, and select Network. Reload the page while the panel is open so the document request appears in the log.",
          "Select the document and compare Headers, Response, and Timing. Identify the request method, status code, content type, and the HTML body you wrote, then relate each field to the browser's visible page.",
          "Request a nonexistent filename on this same local server and compare the resulting 404. Stop the server with Ctrl+C after the exercise; do not leave a practice file server running."
        ],
        "example": {
          "label": "From your empty tutorial folder: Windows Python launcher / Linux or WSL",
          "code": "py -3 -m http.server 8000 --bind 127.0.0.1\n# Linux or WSL alternative:\npython3 -m http.server 8000 --bind 127.0.0.1"
        },
        "observe": "The response body and status explain different things. A successful transport request can still contain an application error.",
        "pitfall": "Serve only the empty practice folder. HAR exports and copied requests can contain cookies or tokens; do not inspect dfCTF traffic as an attack exercise or share private captures.",
        "links": [
          {
            "label": "Chrome: inspect network activity",
            "href": "https://developer.chrome.com/docs/devtools/network/"
          },
          {
            "label": "Python: local HTTP server",
            "href": "https://docs.python.org/3/library/http.server.html"
          }
        ]
      },
      {
        "id": "burp-community",
        "name": "Burp Suite Community Edition",
        "platform": "Windows, macOS, and Linux desktop application",
        "when": "Use Burp to inspect and manually repeat requests to your own loopback practice server or a lab that explicitly permits it. The purpose here is learning request structure, not scanning a target.",
        "steps": [
          "Start with the self-created static site from the DevTools exercise. Open a temporary Burp project and its dedicated built-in browser; keep personal browsing and signed-in accounts outside this browser.",
          "Add only http://127.0.0.1:8000 to the target scope. Follow the scope documentation to limit out-of-scope logging, then confirm the browser is visiting this local address rather than dfCTF.",
          "Keep interception off initially and load your page. Find its request in Proxy HTTP history, inspect its method and path, and send that one request to Repeater.",
          "Repeat the unchanged request once, then change only its path to a nonexistent local file. Compare status, headers, and body with the earlier response and document the single change."
        ],
        "observe": "Repeater makes a controlled comparison: the same local server returns different results for different paths. Scope is a practical boundary you must still check.",
        "pitfall": "Burp can record traffic outside scope by default. Avoid personal sessions, credentials, automated scans, extensions, and unrelated hosts; do not install a proxy certificate into your everyday browser for this exercise.",
        "links": [
          {
            "label": "PortSwigger: getting started",
            "href": "https://portswigger.net/burp/documentation/desktop/getting-started"
          },
          {
            "label": "PortSwigger: target scope",
            "href": "https://portswigger.net/burp/documentation/desktop/testing-workflow/test-scope"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "wstg-authorization",
        "name": "OWASP WSTG: build an authorization test matrix",
        "platform": "Browser or an API client against an isolated exercise you own",
        "when": "Turn a vague access-control question into a small set of permitted and denied cases using fictional accounts and data.",
        "steps": [
          "Choose a disposable local training app, not dfCTF. Create two fictional users with the same role and one separate staff account; write the expected access rules first.",
          "Choose one harmless read-only resource owned by each user. Keep browser profiles or API sessions separate so you know which identity makes each request.",
          "Check the owner, the other same-role user, a lower-privilege user, and a signed-out session against that fixture. Record the status and whether any private body data was returned.",
          "Compare observations with the matrix and report the smallest reproducible discrepancy. Restore the lab state and avoid automated enumeration or state-changing requests."
        ],
        "observe": "Authentication identifies a session; authorization decides what that identity may access. A hidden button or a different status code is insufficient if the response still discloses private data.",
        "pitfall": "Changing a session or resource identifier belongs only in an authorized lab. Do not try these checks against real students, real accounts, or the platform itself.",
        "links": [
          {
            "label": "OWASP WSTG v4.2: authorization schema testing",
            "href": "https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/05-Authorization_Testing/02-Testing_for_Bypassing_Authorization_Schema/"
          }
        ]
      },
      {
        "id": "curl-response-review",
        "name": "curl: inspect a local HTTP response",
        "platform": "Command line; use curl.exe in Windows PowerShell if curl is an alias",
        "when": "Read status and header behavior directly when learning redirects, caching, cookies, and browser security controls in a local exercise.",
        "steps": [
          "Start your own toy HTTP service on 127.0.0.1:8000 with fictional content. Confirm it is bound to loopback and use one request at a time.",
          "Run the bounded HEAD request below. Record the status line and any headers actually present; HEAD support and header behavior depend on the service.",
          "Compare the response with the browser Network panel. Explain a cache directive or content-type value, and distinguish response headers from request headers.",
          "Change one harmless setting in your toy service and repeat. If HEAD is unsupported, inspect an ordinary GET in DevTools rather than assuming the service is broken."
        ],
        "observe": "A header is evidence of what this response sent. Browser protection depends on the complete policy and context; a header checklist is not a security certification.",
        "pitfall": "Do not add loops, concurrency, or real targets. Do not copy cookies or authorization headers into shared notes; an HTTP localhost fixture cannot demonstrate deployed HTTPS protection.",
        "links": [
          {
            "label": "curl: command options",
            "href": "https://curl.se/docs/manpage.html"
          },
          {
            "label": "MDN: HTTP response headers",
            "href": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers"
          }
        ],
        "example": {
          "label": "One bounded request to your own local toy service",
          "code": "curl --head --max-time 5 http://127.0.0.1:8000/"
        }
      },
      {
        "id": "zap-passive",
        "name": "OWASP ZAP: passive request review",
        "platform": "Desktop; a dedicated browser and a self-owned local teaching app",
        "when": "Learn how passive findings arise from ordinary requests and responses in an authorized local lab.",
        "steps": [
          "Create a ZAP session dedicated to the local teaching app, keeping personal browsing and credentials out of it.",
          "Use a browser configured for this session to visit a few known lab pages manually; do not start a spider or active scan.",
          "Inspect the captured history and a passive alert, identifying the exact response bytes and rule explanation.",
          "Reproduce the observation manually, explain its context and impact, and record a counterexample where the same signal is acceptable."
        ],
        "observe": "Passive analysis evaluates the traffic you supplied; it does not establish that unvisited routes have been assessed.",
        "pitfall": "Proxy scope and browser separation matter. A passive alert is a review lead, not automatic proof of exploitability.",
        "links": [
          {
            "label": "OWASP ZAP: passive scanning",
            "href": "https://www.zaproxy.org/docs/desktop/start/features/pscan/"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Authentication and authorization",
        "detail": "Proving who a user is differs from checking what that user may do. Compare permitted and denied actions across two fictional accounts in an authorized lab."
      },
      {
        "title": "Trust boundaries",
        "detail": "Cookies, headers, URL parameters, and browser validation are client-controlled inputs. Trace which checks happen on the server before trusting an interface response."
      },
      {
        "title": "Findings and verification",
        "detail": "A scanner alert or absent header is an observation, not automatically an exploitable flaw. Preserve the request, response, context, expected behavior, and a reproducible impact statement."
      }
    ]
  },
  {
    "id": "binary-exploitation",
    "title": "Binary exploitation",
    "summary": "Binary analysis explores how a compiled program works when its original source code may not be available. It introduces the instructions, memory, and decisions behind software, and helps explain why mistakes in those areas can become security problems.",
    "tools": [
      {
        "id": "ghidra",
        "name": "Ghidra",
        "platform": "Windows, macOS, and Linux desktop application; requires the JDK specified by its release",
        "when": "Use Ghidra for static inspection: comparing machine instructions, strings, and a decompiler's approximation of program logic. You can build these habits without running a downloaded executable.",
        "steps": [
          "Install the official release and its documented JDK. Write the tiny C program below and compile it yourself with a trusted local compiler; the output is a program whose source you already understand.",
          "Create a non-shared Ghidra project in a separate practice directory. Import your compiled output, check the detected format and architecture, then open it in CodeBrowser and allow the standard analysis.",
          "Find main in the function list, or locate the tutorial string through the string-search tools. Follow its reference to the code that uses it and compare the Listing with the Decompiler view.",
          "Rename one local variable or function in the analysis project and add a comment explaining the source-to-instruction relationship. Keep the original executable and C source unchanged for comparison."
        ],
        "example": {
          "label": "Save as hello.c, then compile with your trusted C compiler",
          "code": "#include <stdio.h>\nint main(void) {\n    puts(\"Hello from a local tutorial\");\n    return 0;\n}"
        },
        "observe": "Decompiler output is reconstructed pseudocode, not the original source. Compiler choices can change names, layout, and how recognizable the logic is.",
        "pitfall": "Static analysis still parses input files. Use your own build here; do not enable unreviewed scripts, run unknown programs, or mistake readable strings for proof that code executes.",
        "links": [
          {
            "label": "Official Ghidra releases and installation",
            "href": "https://github.com/NationalSecurityAgency/ghidra"
          },
          {
            "label": "Ghidra: beginner student guide",
            "href": "https://ghidra.re/ghidra_docs/GhidraClass/Beginner/Introduction_to_Ghidra_Student_Guide.html"
          }
        ]
      },
      {
        "id": "gdb",
        "name": "GDB",
        "platform": "Linux or WSL for this walkthrough; GCC and GDB must be installed",
        "when": "Use a debugger to connect source lines, program state, and execution order in a program you wrote. Unlike static inspection, debugger commands such as run and start actually execute the program.",
        "steps": [
          "Use the self-written hello.c from the Ghidra exercise inside your Linux practice directory. Compile it with debug information and optimizations disabled so source lines are easier to follow.",
          "Launch GDB with the startup command below. -nx skips initialization files, and disabling auto-load prevents object-associated scripts from loading automatically; neither option makes arbitrary code safe to execute.",
          "At the GDB prompt, enter break main and run. Confirm execution pauses at your own main function, then use list to inspect source and next to advance over the output call.",
          "Use info locals and backtrace to inspect the current frame. Finish with continue and quit, recording which observations came from execution rather than guessing from disassembly."
        ],
        "example": {
          "label": "Linux or WSL: only your own hello.c; the remaining lines are GDB commands",
          "code": "gcc -g -O0 -o hello hello.c\ngdb -nx -iex \"set auto-load off\" ./hello\n# At the (gdb) prompt:\nbreak main\nrun\nlist\nnext\nbacktrace\ncontinue\nquit"
        },
        "observe": "A breakpoint pauses before the selected code executes. An empty local-variable list can be correct for this simple example.",
        "pitfall": "Never run a downloaded challenge binary on your normal host or assume WSL provides isolation. An unfamiliar program needs an appropriately isolated analysis environment and explicit authorization.",
        "links": [
          {
            "label": "GDB: sample debugging session",
            "href": "https://sourceware.org/gdb/current/onlinedocs/gdb.html/Sample-Session.html"
          },
          {
            "label": "GDB: auto-loading behavior",
            "href": "https://sourceware.org/gdb/current/onlinedocs/gdb.html/Auto_002dloading.html"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "objdump-static",
        "name": "GNU objdump: connect assembly to source",
        "platform": "GNU Binutils in Linux or WSL; use a self-built executable",
        "when": "Read disassembly and section information when you want to explain what a tiny program does without starting its executable.",
        "steps": [
          "Write a small C function that adds two numbers and compile it yourself with debug information. Keep its source beside the resulting training executable.",
          "Use objdump -f to read the file and architecture information, then objdump -h to inspect section names and sizes.",
          "Use the disassembly command below and locate your function by name. Relate one arithmetic instruction and its return to the source instead of interpreting every byte as code.",
          "Compile a second copy with different optimization settings and compare the same function. Document architecture, compiler settings, and the file hash with your notes."
        ],
        "observe": "Compiler optimization changes instructions and can inline or remove functions. Sections, file offsets, and virtual addresses are different concepts.",
        "pitfall": "Disassembly alone does not reveal every runtime behavior. Do not execute an unknown binary just to confirm a guess; this exercise uses only code you wrote and compiled.",
        "links": [
          {
            "label": "GNU Binutils: objdump",
            "href": "https://sourceware.org/binutils/docs/binutils/objdump.html"
          }
        ],
        "example": {
          "label": "Static disassembly of your own executable",
          "code": "objdump -f ./training-demo\nobjdump -h ./training-demo\nobjdump -d ./training-demo"
        }
      },
      {
        "id": "address-sanitizer",
        "name": "Clang AddressSanitizer: understand a memory error",
        "platform": "Clang with AddressSanitizer support in a disposable Linux or WSL lab",
        "when": "Learn how a debugger report connects an invalid memory access to source code, then fix the cause in a self-written toy program.",
        "steps": [
          "Write a tiny local program with a fixed array and a deliberately out-of-range index. Use no network, user files, shell commands, or externally supplied executable.",
          "Compile the source using the instrumentation flags below. Run only that self-built toy and record the reported access type, source location, and allocation context.",
          "Fix the index or input validation in the source and repeat the same input. Compare the instrumented runs instead of suppressing the diagnostic.",
          "Test the boundary just below, at, and beyond the valid index. Explain which condition excludes the invalid access and which inputs remain untested."
        ],
        "observe": "Instrumentation makes certain memory errors easier to diagnose. A clean run means this execution did not report an instrumented error; it does not prove every path is safe.",
        "pitfall": "This is a bug diagnosis and repair exercise, not a payload exercise. Sanitizer builds are not a substitute for production hardening or a complete test suite.",
        "links": [
          {
            "label": "Clang: AddressSanitizer usage and limitations",
            "href": "https://clang.llvm.org/docs/AddressSanitizer.html"
          }
        ],
        "example": {
          "label": "Compile only a training source file you wrote",
          "code": "clang -g -O1 -fsanitize=address -fno-omit-frame-pointer training-demo.c -o training-demo"
        }
      },
      {
        "id": "cutter-static",
        "name": "Cutter: functions, strings, and cross-references",
        "platform": "Windows, macOS, or Linux desktop",
        "when": "Trace a simple self-built program through static views without running it in a debugger.",
        "steps": [
          "Build a tiny program you wrote that prints a known message and retain the source alongside its hash.",
          "Open the binary in Cutter as a static analysis project and confirm its architecture and entry point.",
          "Find the known string, follow its cross-references to a function, and compare graph, disassembly, and decompiler views.",
          "Repeat with a different build configuration and explain what changed in symbols, instruction layout, and inferred source."
        ],
        "observe": "A cross-reference connects a specific use to evidence in the binary; decompiled variable names and types remain approximations.",
        "pitfall": "Do not equate a string with executed behavior or start debugging an unfamiliar sample on a personal host.",
        "links": [
          {
            "label": "Cutter: official user documentation",
            "href": "https://cutter.re/docs/"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "File layout and runtime layout",
        "detail": "Executable sections, virtual addresses, file offsets, and process memory are related but not interchangeable. Identify the architecture and format before interpreting an address."
      },
      {
        "title": "Control flow and decompilation",
        "detail": "A decompiler reconstructs an approximation of source from machine instructions. Confirm important conditions and calls in the disassembly, especially when symbols or types are missing."
      },
      {
        "title": "Memory safety and mitigations",
        "detail": "Bounds, object lifetime, and integer conversions influence whether a program behaves safely. A mitigation setting or clean sanitizer run covers specific conditions; neither proves a program has no defects."
      }
    ]
  },
  {
    "id": "miscellaneous",
    "title": "Miscellaneous",
    "summary": "Some cybersecurity problems are mostly about making sense of information: finding a pattern, comparing two records, or putting events in the right order. This area brings together useful ways of thinking about data that apply across many kinds of investigation.",
    "tools": [
      {
        "id": "jq",
        "name": "jq",
        "platform": "Windows native executable; macOS and Linux command line",
        "when": "Use jq to inspect and transform JSON without manually copying fields. It is especially useful for nested objects, arrays, filtering, and distinguishing actual numbers from strings that only look numeric.",
        "steps": [
          "Create items.json in a text editor using the synthetic array below. Keep numbers unquoted and strings quoted, then run jq . items.json to check that the file parses.",
          "Run the sort_by command to order the objects by sequence. Compare the complete sorted objects first so you can verify that each number remains attached to its original label.",
          "Add the second pipeline stage to select each label. The -r option prints strings without JSON quotation marks, which is useful for a plain-text report rather than another JSON document.",
          "Change one sequence value to the string \"10\" in a copy and observe how mixed types affect your assumption. Decide whether the input needs validation before adding more transformations."
        ],
        "example": {
          "label": "Save the first line as items.json; run commands in PowerShell 7 or a Unix shell",
          "code": "[{\"sequence\":10,\"label\":\"later\"},{\"sequence\":2,\"label\":\"earlier\"}]\n\njq . items.json\njq -r 'sort_by(.sequence) | .[].label' items.json"
        },
        "observe": "With numeric sequence fields, earlier prints before later. Pretty formatting changes presentation without changing the original file.",
        "pitfall": "Do not split JSON with ad hoc text substitutions. Shell quoting differs in cmd.exe; use PowerShell 7 or put a more complicated jq program in a filter file.",
        "links": [
          {
            "label": "jq: official tutorial",
            "href": "https://jqlang.org/tutorial/"
          },
          {
            "label": "jq: manual and shell quoting",
            "href": "https://jqlang.org/manual/"
          }
        ]
      },
      {
        "id": "python",
        "name": "Python 3",
        "platform": "Windows native via py -3; Linux or WSL via python3",
        "when": "Use a short Python script when a data rule needs numeric sorting, validation, or repeatable checks. The standard library is enough for this CSV exercise, so no packages or notebook setup are needed.",
        "steps": [
          "Create rows.csv with headers position,label and two rows: 10,later and 2,earlier. Save the script below as read_rows.py in the same practice directory.",
          "Run it with py -3 read_rows.py on Windows or python3 read_rows.py on Linux. DictReader maps each field to its header; int explicitly makes the ordering numeric.",
          "Check that the output is earlier followed by later. Add a third row with a position between those values and predict the result before running the script again.",
          "Try a non-numeric position in a copy of the CSV. Notice the conversion error instead of silently accepting it, then decide how a larger script should report malformed rows."
        ],
        "example": {
          "label": "read_rows.py: standard-library CSV parsing",
          "code": "import csv\n\nwith open(\"rows.csv\", newline=\"\", encoding=\"utf-8\") as source:\n    rows = list(csv.DictReader(source))\nfor row in sorted(rows, key=lambda item: int(item[\"position\"])):\n    print(row[\"label\"])"
        },
        "observe": "Numeric sorting places 2 before 10; sorting their text representations would produce a different order. A visible error is better than an unnoticed wrong reconstruction.",
        "pitfall": "Use a CSV parser because quoted fields can contain commas. Do not run scripts supplied by strangers, install random packages, or evaluate input as Python code.",
        "links": [
          {
            "label": "Python: csv and DictReader",
            "href": "https://docs.python.org/3/library/csv.html"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "python-diff",
        "name": "Python difflib: compare two evidence exports",
        "platform": "Python 3 standard library; small UTF-8 text files",
        "when": "Compare a before-and-after export when you need to identify exact changes without rewriting the original files.",
        "steps": [
          "Create two short fictional configuration exports that differ by one setting. Record the file hashes and confirm both exports use the same text encoding.",
          "Read both files with explicit UTF-8 decoding and retain line endings. Generate a unified diff using the example below.",
          "Read the file labels, hunk positions, removed lines, and added lines separately. Compare the diff with the known change you made.",
          "Repeat with a line-ending-only change and note the extra noise. Preserve the raw files and explain any normalization before treating two exports as equivalent."
        ],
        "observe": "A diff describes textual differences between these inputs. It does not explain who changed them, whether an order is meaningful, or whether the new configuration is safer.",
        "pitfall": "Do not silently discard whitespace or failed decoding. A small-memory example is appropriate for short exports; large evidence collections need streaming or a dedicated comparison tool.",
        "links": [
          {
            "label": "Python: difflib unified_diff",
            "href": "https://docs.python.org/3/library/difflib.html#difflib.unified_diff"
          }
        ],
        "example": {
          "label": "Python: print a diff without changing either input",
          "code": "from pathlib import Path\nfrom difflib import unified_diff\n\nbefore = Path(\"before.txt\").read_bytes().decode(\"utf-8\").splitlines(keepends=True)\nafter = Path(\"after.txt\").read_bytes().decode(\"utf-8\").splitlines(keepends=True)\nprint(\"\".join(unified_diff(before, after, fromfile=\"before.txt\", tofile=\"after.txt\")))"
        }
      },
      {
        "id": "python-timeline",
        "name": "Python datetime: normalize a small event timeline",
        "platform": "Python 3 standard library; fictional timestamps with explicit offsets",
        "when": "Normalize timezones before correlating events from two systems whose clocks or display settings differ.",
        "steps": [
          "Create three fictional events containing a source label, the original timestamp, and a note. Include explicit UTC offsets rather than ambiguous local dates.",
          "Parse one value with datetime.fromisoformat and convert it to UTC with astimezone. Keep the original timestamp beside the normalized value.",
          "Sort the events using aware datetime values. Repeat the exercise with two records that represent the same instant using different offsets.",
          "Record any known clock drift and timestamp precision. If an offset is absent, mark the timezone as unknown until the log format or source configuration establishes it."
        ],
        "observe": "The synthetic Manila and UTC values below refer to the same instant. Display order is not necessarily event causality when clocks are skewed or resolution is coarse.",
        "pitfall": "Attaching a guessed timezone is not conversion. Do not overwrite original event times or turn an uncertain timestamp into a precise narrative.",
        "links": [
          {
            "label": "Python: aware and naive datetime values",
            "href": "https://docs.python.org/3/library/datetime.html"
          }
        ],
        "example": {
          "label": "Python: compare explicit timezone offsets",
          "code": "from datetime import datetime, timezone\n\nlocal = datetime.fromisoformat(\"2026-10-27T12:00:00+08:00\")\nutc = datetime.fromisoformat(\"2026-10-27T04:00:00+00:00\")\nassert local == utc\nprint(local.astimezone(timezone.utc).isoformat())"
        }
      },
      {
        "id": "ripgrep-evidence",
        "name": "ripgrep: precise searches across text exports",
        "platform": "Windows, macOS, or Linux command line",
        "when": "Search a small local teaching export while keeping literal matching separate from regular expressions.",
        "steps": [
          "Create two small text fixtures, including a line containing the literal token training.case and a near miss.",
          "Run the literal search below and record filenames, line numbers, and the per-file match limit.",
          "Remove the literal flag in a separate experiment and explain how the dot changes the regex interpretation.",
          "Compare results with the known fixtures and document ignored files, encoding assumptions, and unsearched binary content."
        ],
        "observe": "A fixed-string search answers a different question from a regex. No match is meaningful only within the search scope.",
        "pitfall": "The match limit is per file, not a total byte budget. Restrict the input folder and avoid exposing secrets from real exports.",
        "links": [
          {
            "label": "ripgrep: official guide",
            "href": "https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md"
          }
        ],
        "example": {
          "label": "Bound matches in a small teaching folder",
          "code": "rg -n -F -m 20 -- \"training.case\" ./practice"
        }
      }
    ],
    "concepts": [
      {
        "title": "Structured versus unstructured data",
        "detail": "Use a JSON or CSV parser when the input has a schema; use text search to locate candidates. Quoting, escaping, missing values, and multiline fields can invalidate an apparent text shortcut."
      },
      {
        "title": "Ordering and normalization",
        "detail": "Numeric order differs from text order, and timestamps need explicit zones. Define your comparison rules before sorting or deduplicating evidence."
      },
      {
        "title": "Test a hypothesis",
        "detail": "Keep small positive and negative examples and change one variable at a time. A useful tool result explains both the matches and the cases it should reject."
      }
    ]
  },
  {
    "id": "cryptography",
    "title": "Cryptography foundations",
    "summary": "Cryptography helps protect information and check whether it has changed or who signed it. Its different building blocks have different jobs, so the first step is understanding what encoding, hashing, encryption, and digital signatures each do.",
    "tools": [
      {
        "id": "openssl",
        "name": "OpenSSL",
        "platform": "Linux or WSL command line for this walkthrough; not included with Windows PowerShell",
        "when": "Use OpenSSL to calculate a standard digest and learn what a cryptographic hash does. This read-only file experiment needs no keys, network connection, certificates, or password-cracking tools.",
        "steps": [
          "Create a short sample.txt yourself in a practice folder. Check that openssl is installed in your Linux or WSL environment; a similarly named command from another toolchain may have different installation details.",
          "Run the SHA-256 digest command below and record only its 64 hexadecimal digest characters. The surrounding label and filename are output formatting, not part of the digest.",
          "Make a second file with exactly the same bytes and compare its digest. Then change one character, or add a final newline, and repeat the comparison on that copy.",
          "Compare the outcome with the PowerShell hash exercise using the same file bytes. Agreement between tools checks your handling of the input; it does not reveal or decrypt the original text."
        ],
        "example": {
          "label": "Linux or WSL: hash a self-created text file",
          "code": "openssl dgst -sha256 sample.txt"
        },
        "observe": "Identical bytes produce the same SHA-256 value across tools. A digest has fixed length even when the input grows.",
        "pitfall": "Hashing is not encryption or reversible encoding. Do not use these commands to design password storage or invent a cryptographic protocol; newline and text-encoding differences are common comparison mistakes.",
        "links": [
          {
            "label": "OpenSSL: digest command reference",
            "href": "https://docs.openssl.org/master/man1/openssl-dgst/"
          }
        ]
      },
      {
        "id": "sagemath",
        "name": "SageMath",
        "platform": "Local SageMath environment; use its official WSL/Linux installation route on Windows",
        "when": "Use SageMath for exact arithmetic, modular inverses, and number-theory experiments. It helps you state and test a mathematical idea without relying on floating-point approximations or an unexplained online decoder.",
        "steps": [
          "Open a local SageMath session after following the official installation guide. These expressions belong at the Sage prompt, not a PowerShell prompt and not an ordinary Python interpreter.",
          "Calculate gcd(7, 26), then inverse_mod(7, 26). The greatest common divisor explains whether a multiplicative inverse can exist for these two small integers.",
          "Check the proposed inverse by multiplying it by 7 and taking the remainder modulo 26. Predict the result before evaluating it, and write the equality down in ordinary mathematical notation.",
          "Try the same question with 13 and 26. Observe why no inverse exists in that case, then compare exact integer arithmetic with the unhelpful decimal result of ordinary division."
        ],
        "example": {
          "label": "At a local SageMath prompt",
          "code": "gcd(7, 26)\ninverse_mod(7, 26)\n(7 * 15) % 26\ngcd(13, 26)"
        },
        "observe": "The results are 1, 15, 1, and 13. The inverse check works because 7 and 26 are coprime; 13 and 26 are not.",
        "pitfall": "Toy arithmetic is not evidence that real encryption is broken. Keep private data out of public notebook services, and distinguish Sage's syntax and exact number types from ordinary Python.",
        "links": [
          {
            "label": "SageMath: number theory tutorial",
            "href": "https://doc.sagemath.org/html/en/tutorial/tour_numtheory.html"
          },
          {
            "label": "SageMath: official installation guide",
            "href": "https://doc.sagemath.org/html/en/installation/"
          }
        ]
      }
    ],
    "deeper": [
      {
        "id": "openssl-certificate",
        "name": "OpenSSL: inspect a certificate offline",
        "platform": "OpenSSL command line and a public training certificate in PEM format",
        "when": "Understand subjects, issuers, validity periods, and fingerprints without connecting to a remote host or handling a private key.",
        "steps": [
          "Export a public certificate from a toy service you own or use a documented public training fixture. Keep private-key files out of this exercise.",
          "Run the x509 inspection command below on the PEM certificate. Record the subject, issuer, validity interval, and SHA-256 fingerprint.",
          "Read the Subject Alternative Name extension in a full text view and compare it with the toy hostname. Distinguish the certificate’s claims from a verified trust chain.",
          "Compare a second public certificate and explain the differences. Use the separate OpenSSL verification documentation when studying trust rather than treating readable fields as verification."
        ],
        "observe": "The fingerprint identifies the certificate bytes. Displaying an issuer name and valid dates does not verify its signature, hostname match, revocation state, or trust chain.",
        "pitfall": "Never upload a private key or paste it into notes. Do not use an offline display command to claim that a live site’s TLS setup is secure.",
        "links": [
          {
            "label": "OpenSSL: x509 inspection options",
            "href": "https://docs.openssl.org/3.5/man1/openssl-x509/"
          },
          {
            "label": "OpenSSL: certificate verification",
            "href": "https://docs.openssl.org/3.5/man1/openssl-verify/"
          }
        ],
        "example": {
          "label": "Read a public training certificate",
          "code": "openssl x509 -in training-cert.pem -noout -subject -issuer -dates -fingerprint -sha256"
        }
      },
      {
        "id": "python-modular-math",
        "name": "Python: modular arithmetic on toy values",
        "platform": "Python 3.8 or newer standard library",
        "when": "Explore why an inverse exists for some modular values and not others before studying a toy cipher or a number-theory exercise.",
        "steps": [
          "Run the small synthetic example below. All numbers are public teaching values and have no connection to real keys or passwords.",
          "Use gcd to check whether the value and modulus are coprime. Then compute the modular inverse with pow and verify it by multiplication modulo the same modulus.",
          "Replace 5 with 2 while keeping modulus 26. Explain the common factor and observe that pow raises ValueError because the inverse does not exist.",
          "Write the precondition and verification step in your notes. Compare this arithmetic with an intentionally small classroom cipher, keeping it separate from production cryptography."
        ],
        "observe": "For 5 modulo 26, the inverse is 21 because their product leaves remainder 1. Not every nonzero value has an inverse under a composite modulus.",
        "pitfall": "Toy arithmetic is not a secure encryption design. Do not reuse these small parameters for secrets or extend this example into password guessing or real-key recovery.",
        "links": [
          {
            "label": "Python: math.gcd",
            "href": "https://docs.python.org/3/library/math.html#math.gcd"
          },
          {
            "label": "Python: pow modular inverse",
            "href": "https://docs.python.org/3/library/functions.html#pow"
          }
        ],
        "example": {
          "label": "Python: verify a modular inverse",
          "code": "from math import gcd\n\nassert gcd(5, 26) == 1\ninverse = pow(5, -1, 26)\nassert (5 * inverse) % 26 == 1\nprint(inverse)  # 21"
        }
      },
      {
        "id": "gnupg-signatures",
        "name": "GnuPG: detached signatures and key identity",
        "platform": "Windows, macOS, or Linux; a dedicated training keyring",
        "when": "Verify a teaching document and explain the difference between mathematical verification and trust in its signer.",
        "steps": [
          "Obtain a harmless document, detached signature, and public training key from the exercise author.",
          "Use a separate training keyring and compare the full public-key fingerprint with the author through an independent trusted channel.",
          "Verify the detached signature against the exact document and record the signing key, result, and trust explanation.",
          "Change one character in a copy and repeat verification, preserving both the original and the failed-verification evidence."
        ],
        "observe": "Successful verification binds exact content to a key; it does not independently establish who controls that key.",
        "pitfall": "Importing a key is not endorsing its identity. Keep this exercise separate from personal keyrings and never share private keys.",
        "links": [
          {
            "label": "GnuPG: signature operations and verification",
            "href": "https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html"
          }
        ]
      }
    ],
    "concepts": [
      {
        "title": "Different security properties",
        "detail": "Encoding provides representation, hashing provides a fixed-size digest, encryption protects confidentiality, and signatures support integrity and signer verification. Choose the property before choosing the tool."
      },
      {
        "title": "Keys and identity",
        "detail": "A signature can verify under a key while that key belongs to someone else. Compare a trusted fingerprint and explain where that trust came from."
      },
      {
        "title": "Models and real systems",
        "detail": "Toy modular arithmetic makes mathematical relationships visible. Real cryptographic systems also depend on key management, randomness, protocol design, and maintained implementations."
      }
    ]
  },
  ...RESOURCE_SPECIALTIES,
];
