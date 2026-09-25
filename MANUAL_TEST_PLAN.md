# Manual Test Plan

## Prerequisites

- `.env` file with valid `SARVAM_API_KEY` and `CEREBRAS_API_KEY`
- `npm install` and `npm run build --workspace shared` completed
- Backend running: `npm run dev --workspace server` (port 8080)
- Frontend running: `npm run dev --workspace web` (port 3000)
- Microphone-enabled browser (Chrome/Edge recommended)
- Quiet environment (for VAD accuracy)
- Two people (or two languages you can speak) for translation tests

## Test Cases

### 1. Connection

| # | Action | Expected Result |
|---|--------|-----------------|
| 1.1 | Open http://localhost:3000 | Page loads with microphone button, "Not connected" status, brand shows "Airco Talks" |
| 1.2 | Tap microphone button | Status changes to "Connecting…" then "Connected", state shows "Listening" |
| 1.3 | Tap microphone button again | Session stops, status returns to "Not connected", state "Idle" |

### 2. Basic Translation Loop (Punjabi → Marathi)

| # | Action | Expected Result |
|---|--------|-----------------|
| 2.1 | Open Settings, set "You speak" = Punjabi, "They speak" = Marathi | Both selects show the chosen languages |
| 2.2 | Tap mic, speak in Punjabi: "ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?" | Partial transcript appears live, then the spoken text lands in history |
| 2.3 | Wait for the translation | Marathi audio plays ("तू कसा आहेस?" or equivalent), translation text appears, state → "Speaking translation…" → "Listening" |
| 2.4 | Reply in Marathi: "मी बरा आहे" | Translation plays in Punjabi ("ਮੈਂ ਠੀਕ ਹਾਂ"), history shows both directions |

### 3. Language Pair Presets

| # | Action | Expected Result |
|---|--------|-----------------|
| 3.1 | On the welcome screen, click the "Punjabi ↔ Marathi" preset | Settings show pa ↔ mr; session starts |
| 3.2 | Click the "Marathi ↔ Hindi" preset | Pair updates to mr ↔ hi; next translations follow the new pair |
| 3.3 | Click "Swap" in Settings | The two languages exchange places |

### 4. Direction Flip Per Turn

| # | Action | Expected Result |
|---|--------|-----------------|
| 4.1 | With pair pa ↔ mr, speak Punjabi | Detected badge shows "Punjabi — ਪੰਜਾਬੀ"; TTS speaks Marathi |
| 4.2 | Speak Marathi | Badge shows "Marathi — मराठी"; TTS speaks Punjabi |
| 4.3 | Alternate turns 3+ times | Each turn translates into the other language; history labels each message with its language |

### 4A. Auto-Detect Customer Mode

| # | Action | Expected Result |
|---|--------|-----------------|
| 4A.1 | Open Settings, set "Your language" = Hindi, "Customer language" = Auto-detect | Select shows "Auto-detect (recommended)" |
| 4.2 | Customer speaks Tamil: "வணக்கம்" | Badge shows "Tamil — தமிழ்"; translation is spoken in Hindi |
| 4.3 | You reply in Hindi | Reply is spoken in Tamil (customer's remembered language) |
| 4.4 | You speak before the customer says anything | Translation falls back to English |
| 4.5 | Customer switches to Bengali mid-conversation | New language is detected and remembered; your next reply is in Bengali |

### 5. Mid-Session Pair Change

| # | Action | Expected Result |
|---|--------|-----------------|
| 5.1 | Open Settings mid-session, change "You speak" to Hindi | update_config is sent; no reconnect needed |
| 5.2 | Speak in Hindi | Translation is spoken in the other language of the new pair |

### 6. Barge-in

| # | Action | Expected Result |
|---|--------|-----------------|
| 6.1 | Speak a long sentence in Punjabi | Translation audio starts playing |
| 6.2 | While it plays, say "ਥੋਪ ਕਰੋ" (stop) in Punjabi | Audio stops immediately, state → "Listening", your words are transcribed |
| 6.3 | Wait | The interruption is translated into Marathi and spoken |

### 6. Turn Relay & Controls

| # | Action | Expected Result |
|---|--------|-----------------|
| 6.1 | Start a session and speak | After your translation plays, YOUR panel shows "Your turn — speak now"; the customer's panel waits |
| 6.2 | Same person keeps talking before the reply | Extra speech is ignored (no new translations, no captions) — no flooding |
| 6.3 | The other side speaks | Accepted, translated, floor passes back |
| 6.4 | Nobody speaks for ~12 seconds | The floor auto-releases (open) — either side can speak again |
| 6.5 | Tap a panel mic while a translation plays | Playback stops immediately (barge-in) and the mic is live |
| 6.6 | Click "Restart" mid-conversation | Session ends, conversation clears, a fresh session starts immediately |
| 6.7 | Click "Stop" | Session ends; transcript stays visible; mics return to "tap to speak" |

### 7. Code-Switching

| # | Action | Expected Result |
|---|--------|-----------------|
| 7.1 | Speak: "ਮੇਰਾ phone number ਹੈ 9840950950" | Transcript captures the mixed text |
| 7.2 | Wait for translation | Translation is in the target language; common English words (like "phone number") may be kept naturally |

### 8. Voice Selection

| # | Action | Expected Result |
|---|--------|-----------------|
| 8.1 | Open Settings, change Voice to "anushka" | Next translation uses the selected voice |
| 8.2 | Change Voice back to "Default for language" | Next translation uses the per-language default voice |

### 9. Two-Panel Conversation View

| # | Action | Expected Result |
|---|--------|-----------------|
| 9.1 | Start a session | Two panels appear: "You" (left) and "Customer" (right), each with its own mic button and language label |
| 9.2 | Speak in your language | Your panel highlights, live caption "Spoken: …" appears in YOUR panel |
| 9.3 | Wait for translation | "Translation: …" appears in the CUSTOMER panel and the audio plays |
| 9.4 | Customer speaks | Their panel highlights; their words appear in THEIR panel; translation appears in YOUR panel |
| 9.5 | Complete 3+ turns | Each panel keeps its own chat-style log: spoken bubbles (right) and translation bubbles (left), labeled with language endonyms |
| 9.6 | Tap either mic while active | Session stops (both mics control the same device microphone) |
| 9.7 | Click "Clear conversation" | Both panels clear |

### 10. Error Handling

| # | Action | Expected Result |
|---|--------|-----------------|
| 10.1 | Stop the backend server, tap mic | Error message appears, state → "Error" |
| 10.2 | Restart backend, tap mic again | Session reconnects, error clears |
| 10.3 | Deny microphone permission in browser | "Microphone permission denied" error message |
| 10.4 | Simulate a stalled LLM (slow API) | After ~15s the watchdog aborts, an error appears, and the session returns to "Listening" automatically — it never stays stuck on "Translating…" |

### 11. Latency

| # | Action | Expected Result |
|---|--------|-----------------|
| 11.1 | Speak a short phrase, observe the latency display | `voice latency: <N>ms` appears at bottom |
| 11.2 | Verify latency is under 2000ms | Translation adds LLM work vs a chatbot; short phrases should stay well under ~2s |

### 12. Accessibility

| # | Action | Expected Result |
|---|--------|-----------------|
| 12.1 | Tab to the microphone button | Focus ring visible, aria-label describes current action |
| 12.2 | Press Enter/Space on mic button | Same as click — starts/stops session |
| 12.3 | Use a screen reader | State changes announced via aria-live regions |
| 12.4 | Enable "Reduce motion" in OS | Animations are minimal (CSS media query respected) |

### 13. Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 90+ | Full support (AudioWorklet, Web Audio API) |
| Edge 90+ | Full support |
| Firefox 90+ | Should work (AudioWorklet supported since FF 90) |
| Safari 15+ | Should work (AudioWorklet supported since Safari 15) |
