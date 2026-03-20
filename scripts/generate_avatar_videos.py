#!/usr/bin/env python3
"""
Generate avatar videos with TTS voice for Skool formation transcripts.
Uses edge-tts (Microsoft) for high-quality French TTS and ffmpeg for video.
"""

import argparse
import asyncio
import os
import subprocess
import sys
import textwrap

TRANSCRIPTIONS_DIR = '/data/media/skool-formation/transcriptions'
GENERATED_DIR = '/data/media/skool-formation/generated'
VOICE = 'fr-FR-RemyMultilingualNeural'
AVATAR_SIZE = (1280, 720)
AVATAR_BG_COLOR = '#1e1e2e'
AVATAR_TEXT_COLOR = '#e0e0e0'
ACCENT_COLOR = '#6366f1'


def create_avatar_frame(output_path):
    """Create a static avatar frame image with Pillow."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("Pillow not installed, using ffmpeg color source instead")
        return None

    img = Image.new('RGB', AVATAR_SIZE, AVATAR_BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Draw circle for avatar
    cx, cy = AVATAR_SIZE[0] // 2, AVATAR_SIZE[1] // 2 - 40
    r = 80
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT_COLOR)

    # Draw "PE" initials
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    except (OSError, IOError):
        font = ImageFont.load_default()
        small_font = font

    bbox = draw.textbbox((0, 0), "PE", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw // 2, cy - th // 2), "PE", fill='#ffffff', font=font)

    # Draw name below
    name = "Pierre Evrard"
    bbox2 = draw.textbbox((0, 0), name, font=small_font)
    nw = bbox2[2] - bbox2[0]
    draw.text((cx - nw // 2, cy + r + 20), name, fill=AVATAR_TEXT_COLOR, font=small_font)

    # Subtle waveform decoration
    wave_y = AVATAR_SIZE[1] - 60
    for i in range(0, AVATAR_SIZE[0], 8):
        h = 10 + (i * 7 % 20)
        draw.line([(i, wave_y - h), (i, wave_y + h)], fill=ACCENT_COLOR + '40', width=2)

    img.save(output_path)
    return output_path


def clean_transcript(text, max_chars=None):
    """Clean Whisper transcript for TTS: add punctuation pauses, limit length."""
    # Whisper transcripts are often one long line
    text = text.strip()
    # Limit for very long transcripts (edge-tts handles long text but video gets huge)
    if max_chars and len(text) > max_chars:
        text = text[:max_chars]
        # Cut at last sentence boundary
        last_period = text.rfind('.')
        if last_period > max_chars * 0.7:
            text = text[:last_period + 1]
    return text


async def generate_tts(text, audio_path, subtitle_path):
    """Generate TTS audio and subtitles using edge-tts."""
    import edge_tts

    communicate = edge_tts.Communicate(text, VOICE)
    submaker = edge_tts.SubMaker()

    with open(audio_path, 'wb') as f:
        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                f.write(chunk['data'])
            elif chunk['type'] in ('WordBoundary', 'SentenceBoundary'):
                submaker.feed(chunk)

    with open(subtitle_path, 'w', encoding='utf-8') as f:
        f.write(submaker.get_srt())


def generate_video(avatar_path, audio_path, subtitle_path, output_path):
    """Combine avatar image + audio + subtitles into MP4 with ffmpeg."""
    # Escape path for ffmpeg subtitles filter (colons and backslashes)
    escaped_path = subtitle_path.replace('\\', '\\\\').replace(':', '\\:')
    vf = (
        f"subtitles='{escaped_path}':"
        "force_style='FontName=DejaVu Sans,FontSize=18,"
        "PrimaryColour=&Hffffff&,OutlineColour=&H000000&,"
        "Outline=2,MarginV=40,Alignment=2'"
    )
    cmd = [
        'ffmpeg', '-y',
        '-loop', '1', '-i', avatar_path,
        '-i', audio_path,
        '-vf', vf,
        '-c:v', 'libx264', '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        '-movflags', '+faststart',
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr[-500:]}")
        return False
    return True


async def process_transcript(transcript_path, week_num, video_num, avatar_path):
    """Process a single transcript: TTS + video generation."""
    base_name = f'S{week_num}_{video_num:02d}'
    output_dir = os.path.join(GENERATED_DIR, f'S{week_num}')
    os.makedirs(output_dir, exist_ok=True)

    audio_path = os.path.join(output_dir, f'{base_name}_audio.mp3')
    subtitle_path = os.path.join(output_dir, f'{base_name}_subs.srt')
    video_path = os.path.join(output_dir, f'{base_name}_avatar.mp4')

    if os.path.exists(video_path):
        size = os.path.getsize(video_path)
        if size > 100000:  # >100KB = likely valid
            print(f"  {base_name}: video exists ({size // 1024}KB), skipping")
            return True

    print(f"  {base_name}: reading transcript...")
    with open(transcript_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Limit to ~5000 chars (~3-4 min audio) for reasonable video size
    text = clean_transcript(text, max_chars=5000)
    print(f"  {base_name}: generating TTS ({len(text)} chars)...")

    await generate_tts(text, audio_path, subtitle_path)
    audio_size = os.path.getsize(audio_path) // 1024
    print(f"  {base_name}: TTS done ({audio_size}KB audio)")

    print(f"  {base_name}: generating video...")
    ok = generate_video(avatar_path, audio_path, subtitle_path, video_path)
    if ok:
        video_size = os.path.getsize(video_path) // (1024 * 1024)
        print(f"  {base_name}: done ({video_size}MB)")
    return ok


async def main():
    parser = argparse.ArgumentParser(description='Generate avatar TTS videos')
    parser.add_argument('--week', type=int, default=1, help='Week number (default: 1)')
    parser.add_argument('--video', type=int, help='Specific video number (default: all)')
    parser.add_argument('--max-chars', type=int, default=5000, help='Max chars per transcript')
    args = parser.parse_args()

    week_num = args.week
    print(f"=== Generating avatar videos for S{week_num} ===")

    # Create avatar frame
    avatar_path = os.path.join(GENERATED_DIR, 'avatar_frame.png')
    if not os.path.exists(avatar_path):
        print("Creating avatar frame...")
        create_avatar_frame(avatar_path)

    if not os.path.exists(avatar_path):
        print("ERROR: Could not create avatar frame")
        raise SystemExit(1)

    # Find transcripts
    prefix = f'S{week_num}_'
    transcripts = sorted([
        f for f in os.listdir(TRANSCRIPTIONS_DIR)
        if f.startswith(prefix) and f.endswith('.txt')
    ])

    if args.video:
        transcripts = [f for f in transcripts if f.startswith(f'S{week_num}_{args.video:02d}_')]

    if not transcripts:
        print(f"No transcripts found for S{week_num}")
        raise SystemExit(1)

    print(f"Found {len(transcripts)} transcripts")

    success_count = 0
    for fname in transcripts:
        # Extract video number from filename like S1_02_title.txt
        parts = fname.split('_')
        video_num = int(parts[1])
        transcript_path = os.path.join(TRANSCRIPTIONS_DIR, fname)

        ok = await process_transcript(transcript_path, week_num, video_num, avatar_path)
        if ok:
            success_count += 1

    print(f"\n=== Done: {success_count}/{len(transcripts)} videos generated ===")


if __name__ == '__main__':
    asyncio.run(main())
