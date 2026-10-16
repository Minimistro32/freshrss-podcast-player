# Podcast Player for FreshRSS

A podcast listening extension for FreshRSS that puts the audio player above the show notes, with controls that fit a phone screen.

- Skip back 15 seconds or forward 30 seconds.
- Choose playback speeds of 0.8×, 1×, 1.3×, 1.5×, 1.8×, or 2×.
- Pick up where you left off with saved listening progress and **Resume**.
- Use **Start over** to return to the beginning.
- Remember your preferred speed and pause the previous episode when another starts.

*This extension streams podcasts.* It does not currently download or save episode audio for later or offline listening. Saved listening progress is a bookmark of your position, not a saved copy of the podcast.

## Install

1. Extract the plugin ZIP, or use the `xExtension-PodcastPlayer` folder in this repository.
2. Copy that folder into your FreshRSS `extensions` directory. `metadata.json` and `extension.php` must sit directly inside `xExtension-PodcastPlayer`, not inside another nested folder.
3. In FreshRSS, open **Configuration → Extensions** and enable **Podcast Player** for your user.
4. Reload FreshRSS and open a podcast article.

Requires PHP 8.0 or newer with DOM/libxml. No Node.js packages or build step are needed on the server.

## Using ReadKit on mobile

Enable experimental mode to bring the plugin’s mobile player controls into podcast articles in ReadKit:

1. In FreshRSS, open **Configuration → Extensions** and select the settings/gear button for **Podcast Player**.
2. Turn on **Embed player JavaScript and CSS in articles (experimental)** and save.
3. Sync ReadKit and open a newly fetched podcast article. Previously cached articles may need to be fetched again before the controls appear.
4. If ReadKit is showing the original webpage through reader mode, switch back to the feed’s article content.

This setting includes the player’s styling and controls in the article that FreshRSS sends to ReadKit. It is off by default and is not needed when using the player only in FreshRSS’s web interface. You can leave it enabled while using both FreshRSS and ReadKit.

With experimental mode enabled, the mobile UI, skip buttons, speed control, **Resume**, progress capture, and **Start over** have been manually confirmed in **ReadKit 3.4.5**, with **FreshRSS 1.29.1**. Experimental mode also works in FreshRSS itself.

It remains experimental because other clients or app versions may handle article scripts differently. If a client blocks those scripts, the extra controls will not appear, though a standard audio player may still be available.

Listening progress stays in the browser or client where you listened. Your position in ReadKit does not sync with the FreshRSS web player or other devices.

## System media controls

On browsers and clients that expose the [Media Session API](https://www.w3.org/TR/mediasession/), system controls target the most recently played episode. Play/pause, rewind, forward, and seeking to a position are supported. Rewind defaults to 15 seconds and forward to 30 seconds; a seek interval supplied by the OS takes precedence. Next/previous track buttons also skip +30/−15 seconds within the episode, since the player does not have a playlist.

The player reports its position and playback speed to the system. Available buttons depend on the browser, OS, and embedded client. Re-fetch cached articles after upgrading experimental mode so they receive the updated embedded script.


## Progress and playback

- **Resume** starts playback from your saved position. Playback can also restore your position automatically; opening an article does not start audio by itself.
- **Start over** resets the position to the beginning without starting paused audio.
- Progress is saved about every five seconds while listening, on pause and seek, and when the page becomes hidden. Finishing an episode clears its resume point.
- Clearing browser or client storage clears saved positions. If storage is blocked, playback still works, but progress cannot be kept for next time.
- Audio streams from the podcast’s original source. There is no episode download, saved-audio library, or offline listening feature.
- Standard audio players and FreshRSS audio enclosures are supported. Plain MP3 links and third-party embedded players are not converted.
- Navigating away from the FreshRSS page ends playback. A persistent mini-player and synchronized progress are not currently supported.
- Listening does not change an article’s read/unread status. Disabling the extension leaves stored feed entries unchanged; native apps may retain previously fetched content until refreshed.

## License

Copyright (c) 2026 Tyson Freeze. Released under the [MIT License](LICENSE).

Created by Tyson Freeze with assistance from OpenAI’s Codex.
