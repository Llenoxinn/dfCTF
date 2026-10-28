export const LESSON_PLANS: Record<string, { prerequisites: string[]; goals: string[]; recap: string[] }> = {
  "general-skills": {
    prerequisites: [],
    goals: ["Find and preview files using a terminal.", "Compare file hashes and distinguish bytes from their displayed encoding.", "Keep originals, working copies, and repeatable investigation notes."],
    recap: ["Identify the file and preserve its original bytes before transforming it.", "A matching hash checks byte equality; readable output still needs an explanation."],
  },
  osint: {
    prerequisites: ["general-skills"],
    goals: ["Inspect metadata in permitted images and documents.", "Compare public records, archived pages, and image clues.", "Separate a supported observation from an unverified identity claim."],
    recap: ["Record where each clue came from and when it was observed.", "Corroborate public information and respect the investigation's stated scope."],
  },
  steganography: {
    prerequisites: ["general-skills"],
    goals: ["Identify image and audio formats before choosing a tool.", "Compare metadata, channels, and structural clues.", "Test a hidden-data hypothesis without confusing noise with evidence."],
    recap: ["Keep the untouched file and document each derived version.", "An unusual pattern is a lead; a repeatable explanation makes it useful evidence."],
  },
  forensics: {
    prerequisites: ["general-skills"],
    goals: ["Read evidence from supplied captures, logs, and disk images.", "Build a timeline while keeping timestamps and sources distinct.", "Explain recovery results and the limits of missing or changed evidence."],
    recap: ["Preserve originals and record the source and settings for each observation.", "A timeline should connect events to evidence, including gaps and uncertainty."],
  },
  "web-exploitation": {
    prerequisites: ["general-skills"],
    goals: ["Read browser requests, responses, cookies, and headers.", "Distinguish authentication from authorization.", "Investigate an explicitly authorized teaching application with repeatable requests."],
    recap: ["Compare what a request asks for with what the server actually permits.", "Limit testing to the supplied application and keep session secrets private."],
  },
  "binary-exploitation": {
    prerequisites: ["general-skills", "scripting-automation"],
    goals: ["Inspect the structure and behavior of a small teaching executable.", "Relate debugger observations to program state and memory.", "Recognize unsafe memory behavior and explain the evidence for it."],
    recap: ["Use disposable teaching environments for unfamiliar programs.", "Connect a debugger observation to the input and code path that produced it."],
  },
  miscellaneous: {
    prerequisites: ["general-skills"],
    goals: ["Identify unfamiliar file types and data representations.", "Use short scripts to compare text, timestamps, and transformations.", "Turn an observation into a small, testable puzzle hypothesis."],
    recap: ["Identify the data before chaining tools or transformations.", "Keep each step small enough to repeat and explain."],
  },
  cryptography: {
    prerequisites: ["general-skills", "scripting-automation"],
    goals: ["Distinguish encoding, hashing, and encryption.", "Inspect teaching certificates, signatures, and keys.", "Use small, controlled examples to understand cryptographic assumptions."],
    recap: ["Name the representation and the security property being studied.", "Keep private keys private and treat teaching examples as demonstrations of specific assumptions."],
  },
  "audio-recovery": {
    prerequisites: ["steganography"],
    goals: ["Identify a recording's streams, channels, codec, and sample rate.", "Compare listening observations with waveforms and spectrograms.", "Describe what a processing step changes and what information cannot be recovered."],
    recap: ["Retain the original recording and compare derived versions using documented settings.", "Enhancement can expose an existing signal, but it cannot reliably recreate discarded information."],
  },
  "network-defense": {
    prerequisites: ["forensics"],
    goals: ["Read traffic patterns in a permitted offline capture.", "Compare normal activity with possible service overload or suspicious behavior.", "Explain defensive observations using counts, timing, and context."],
    recap: ["Use bounded, authorized examples and preserve the capture's context.", "A traffic spike needs supporting evidence before it becomes an incident conclusion."],
  },
  "scripting-automation": {
    prerequisites: ["general-skills"],
    goals: ["Read and transform small files with a short script.", "Validate inputs and handle missing or malformed data.", "Produce repeatable results without overwriting original evidence."],
    recap: ["Start with one reliable manual observation, then automate it.", "Keep input checks, clear output, and failure handling in every useful script."],
  },
  "cloud-containers": {
    prerequisites: ["web-exploitation", "identity-host-security"],
    goals: ["Read container and cloud configuration with its intended permissions in mind.", "Recognize exposed secrets and unnecessarily broad access in teaching fixtures.", "Describe the isolation and trust boundaries of a containerized service."],
    recap: ["Check which identity can perform each action and where credentials are stored.", "Containers share host resources; inspect their actual isolation and configuration."],
  },
  "incident-response": {
    prerequisites: ["forensics", "identity-host-security"],
    goals: ["Collect observations from supplied Windows events and other logs.", "Compare detection rules with the evidence they match.", "Build an incident timeline that separates findings, hypotheses, and next steps."],
    recap: ["Record the event source, time window, and query or rule settings.", "A detection match starts an investigation; corroborate it before drawing a conclusion."],
  },
  "identity-host-security": {
    prerequisites: ["general-skills"],
    goals: ["Read user, process, and filesystem permissions.", "Compare an intended access rule with effective permissions.", "Explain least privilege and the boundary between identity and allowed actions."],
    recap: ["Inspect effective access and inherited permissions before changing a configuration.", "Use the minimum permission needed for the stated task and test changes in a lab."],
  },
  "mobile-wireless": {
    prerequisites: ["forensics", "binary-exploitation"],
    goals: ["Inspect a supplied teaching application or firmware fixture.", "Read permitted wireless capture metadata and traffic.", "Explain application and device observations within the limits of the available evidence."],
    recap: ["Use supplied application files and explicitly permitted captures.", "Record tool assumptions and distinguish a static clue from demonstrated runtime behavior."],
  },
};
