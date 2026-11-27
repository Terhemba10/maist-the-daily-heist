"""
Narration for the demo video: one MP3 per line with a Microsoft neural voice (edge-tts), so each line
can start exactly when its scene starts. Falls back to en-US-GuyNeural, then to Windows System.Speech.

  python scripts/video/voiceover.py        (needs: pip install edge-tts)

Writes docs/video/vo/line-XX.mp3 and docs/video/vo/lines.json (text + duration of each line).
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "video" / "vo"
VOICES = ["en-US-AndrewNeural", "en-US-GuyNeural"]
RATE = "+10%"

# One short sentence per scene (the demo must stay under 54.5 s).
LINES = [
    "Maist: The Daily Heist. A new heist every day, on Reddit.",
    "Three dream layers. One shared pool of moves.",
    "Vale folds walls, Wren fades, and Oto puts guards to sleep.",
    "Sneak past the bots, and stay out of the red beams!",
    "Wait… the vault slipped! Find it again.",
    "Race the ghost of tonight's number one player.",
    "Stuck? Friends rescue you by replying 'wake up'.",
    "Climb the daily leaderboard and keep your streak alive.",
    "White or night mode, five languages, smooth on any phone.",
    "New maps every day. Join r/MaistHeist.",
]


def duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip())


async def edge(text: str, path: Path) -> str:
    import edge_tts  # type: ignore

    last: Exception | None = None
    for voice in VOICES:
        try:
            await edge_tts.Communicate(text, voice, rate=RATE).save(str(path))
            return voice
        except Exception as e:  # noqa: BLE001 - try the next voice
            last = e
    raise RuntimeError(f"edge-tts failed: {last}")


def system_speech(text: str, path: Path) -> str:
    """Last resort: Windows' built-in voice to WAV, then MP3 with ffmpeg."""
    wav = path.with_suffix(".wav")
    ps = (
        "Add-Type -AssemblyName System.Speech;"
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
        "$s.Rate = 1;"
        f"$s.SetOutputToWaveFile('{wav}');"
        f"$s.Speak([IO.File]::ReadAllText('{wav}.txt'));"
        "$s.Dispose()"
    )
    Path(f"{wav}.txt").write_text(text, encoding="utf-8")
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), str(path)], check=True)
    wav.unlink()
    Path(f"{wav}.txt").unlink()
    return "System.Speech"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = []
    for i, text in enumerate(LINES):
        path = OUT / f"line-{i:02d}.mp3"
        try:
            voice = asyncio.run(edge(text, path))
        except Exception as e:  # noqa: BLE001
            print(f"line {i}: edge-tts unavailable ({e}); using System.Speech", file=sys.stderr)
            voice = system_speech(text, path)
        d = duration(path)
        meta.append({"i": i, "text": text, "file": path.name, "voice": voice, "duration": round(d, 2)})
        print(f"{i:02d} {d:5.2f}s {voice}: {text}")
    (OUT / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
