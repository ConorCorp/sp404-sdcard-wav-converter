# SP-404 MK2 WAV Converter

A nodejs/macos CLI tool that fixes all wavs on your sp404 mk2 formatted sd card in one command! 🏎️

The SP-404 MK2 doesn't support 24-bit (sometimes?) or 32-bit WAV files. This tool scans your SD card's IMPORT folder, identifies incompatible wav files (non 8 or 16 bit files), and converts them in place.

Can be used whenever to add new samples to your SP, just toss em onto your sd card, run the script, and start making music 🤘


## Example
```
🎹 Hello! Welcome to SE.CORP's SP404 MK2 WAV Converter.

✔ Which SP404 formatted SD card has your samples? SP404MKII

📂 Scanning /Volumes/SP404MKII/IMPORT for WAV files...

Found 4771 WAV file(s). Checking compatibility...

  ⚠️  Chordal Vocal One Shots Sample Pack - GowlerMusic /GowlerMusic - Chordal Vocal One Shots - Free Sample Pack #GM0127 - 02 GowlerMusic_Chordal Vocal One Shots_A7#9.wav (48000Hz, 24-bit)
  ⚠️  Chordal Vocal One Shots Sample Pack - GowlerMusic /GowlerMusic - Chordal Vocal One Shots - Free Sample Pack #GM0127 - 03 GowlerMusic_Chordal Vocal One Shots_Abaug.wav (48000Hz, 24-bit)
  
  ...

  ⚠️  shakers/One-shots/Tambourine 8.wav (44100Hz, 24-bit)
  ⚠️  shakers/One-shots/Tambourine 9.wav (44100Hz, 24-bit)

1765 file(s) need conversion to 16-bit.

✔ Convert these files? (Warning: Original files will be deleted) Yes

🔄 Converting...

  Chordal Vocal One Shots Sample Pack - GowlerMusic /GowlerMusic - Chordal Vocal One Shots - Free Sample Pack #GM0127 - 02 GowlerMusic_Chordal Vocal One Shots_A7#9.wav... ✅
  Chordal Vocal One Shots Sample Pack - GowlerMusic /GowlerMusic - Chordal Vocal One Shots - Free Sample Pack #GM0127 - 03 GowlerMusic_Chordal Vocal One Shots_Abaug.wav... ✅
  
  ...

  shakers/One-shots/Tambourine 7.wav... ✅
  shakers/One-shots/Tambourine 8.wav... ✅
  shakers/One-shots/Tambourine 9.wav... ✅

🎉 Done! Converted: 1765, Failed: 0
```

## Disclaimer

**USE AT YOUR OWN RISK.** This tool modifies files directly on your SD card, replacing them. The author is not responsible for any data loss, corruption, or damage to your files or equipment. Always keep backups of your samples off of the your sd card before running.

**You should keep copies of the samples off of the sd card**, any converted files will drop in quality to become 16 bit.

## Requirements

- **macOS only**
- [ffmpeg](https://ffmpeg.org/) installed (`brew install ffmpeg` if using homebrew)
- Node.js 18+

## Installation

Install:
```bash
npm i
```

Running:
```bash
npm run dev

# or install globally on system
npm run build
npm i -g

# Now you can run this anywhere
sp404-convert
```


## Usage

0. Make sure you have your samples backed up off your sd card.
1. Insert your [SP-404 MK2 formatted SD card](https://support.roland.com/hc/en-us/articles/24692189759899-SP-404MK2-Formatting-an-SD-Card)
2. Run `sp404-convert` (or `npx sp404-sdcard-wav-converter`)
3. Select your SD card from the list
4. Review the incompatible files found
5. Confirm to convert

The tool will convert files which aren't 8 or 16 bit wavs to 16-bit PCM WAV in place. **Original files are replaced/deleted.**

### Test Mode

Run with `--test` or `-t` to only process a single file (useful for a safe test before converting 1000s of files):

```bash
sp404-convert --test
```

### Ignore list
You can add folders to ignore this process for. This is especially useful for samples you know are over 16 bit but work in the sp404 for some reason. If NearTao can't figure out what this device supports besides 16 bit, there's no hope for any of us.

To use it, just add folders to the [ignore.json](./ignore.json) with their imports relative to the IMPORT folder in your sp404.

#### Example:

Folders:
```
  drums/ -> Ignore
  drums2/
    BASEMENT DRUMS VOL 2/  -> Ignore
     sample.mp3
    SOME_32_BIT_SAMPLES/
```
ignore.json
```json
{
  "foldersInIMPORTToIgnore": ["drums", "drums2/BASEMENT DRUMS VOL 2"]
}
```



## License

ISC
