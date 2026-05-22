"""
Forced alignment: audio + transcript → per-sentence timestamps
Uses ctc-forced-aligner with MMS-FA model
"""

import argparse
import json
import sys
import os
import tempfile
import numpy as np
import librosa
import ctc_forced_aligner as cfa

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio",      required=True)
    parser.add_argument("--transcript", required=True)
    parser.add_argument("--output",     required=True)
    args = parser.parse_args()

    with open(args.transcript, "r", encoding="utf-8") as f:
        sentences = [l.strip() for l in f.readlines() if l.strip()]

    if not sentences:
        print("No sentences found", file=sys.stderr)
        sys.exit(1)

    print(f"Aligning {len(sentences)} sentences...")

    # Load audio at required sample rate
    audio, sr = librosa.load(args.audio, sr=cfa.SAMPLING_FREQ, mono=True)
    audio = audio.astype(np.float32)

    # Generate emissions
    emissions, stride = cfa.generate_emissions(audio, batch_size=1)

    # Get uroman tokens — try Myanmar ISO code first, fallback to None
    full_text = " ".join(sentences)
    tokens = None
    for lang in ["mya", None]:
        try:
            t = cfa.get_uroman_tokens([full_text], lang)
            # Check tokens are not empty
            flat = [tok for sublist in t for tok in sublist]
            if flat:
                tokens = t
                print(f"Tokens OK with lang={lang}, count={len(flat)}")
                break
        except Exception as e:
            print(f"Token attempt lang={lang} failed: {e}", file=sys.stderr)

    if tokens is None or not any(tokens):
        print("ERROR: Could not tokenize text", file=sys.stderr)
        sys.exit(1)

    # Run alignment
    segments, scores = cfa.get_alignments(emissions, tokens, cfa.VOCAB_DICT)
    spans = cfa.get_spans(tokens, segments, cfa.VOCAB_DICT.get("<blank>", 0))

    # Get word-level results
    words = full_text.split()
    word_times = cfa.postprocess_results(words, spans, stride, scores)

    # Group back into sentences
    results = []
    word_index = 0

    for sentence in sentences:
        sentence_words = sentence.split()
        n = len(sentence_words)
        if word_index >= len(word_times):
            break
        chunk = word_times[word_index:word_index + n]
        word_index += n
        if not chunk:
            continue
        start    = chunk[0]["start"]
        end      = chunk[-1]["end"]
        duration = round(end - start, 3)
        results.append({
            "text":     sentence,
            "start":    round(start, 3),
            "end":      round(end, 3),
            "duration": duration,
        })
        print(f"  [{start:.2f}s - {end:.2f}s] {sentence[:50]}")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump({"sentences": results}, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(results)} sentence timings → {args.output}")

if __name__ == "__main__":
    main()
