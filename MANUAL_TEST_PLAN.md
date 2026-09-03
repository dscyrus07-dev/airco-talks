# Manual Test Plan

## Prerequisites

- `.env` file with valid `SARVAM_API_KEY` and `CEREBRAS_API_KEY`
- `npm install` and `npm run build --workspace shared` completed
- Backend running: `npm run dev --workspace server` (port 8080)
- Frontend running: `npm run dev --workspace web` (port 3000)
- Microphone-enabled browser (Chrome/Edge recommended)
- Quiet environment (for VAD accuracy)

## Test Cases

### 1. Connection

| # | Action | Expected Result |
|---|--------|-----------------|
| 1.1 | Open http://localhost:3000 | Page loads with microphone button, "Not connected" status |
| 1.2 | Tap microphone button | Status changes to "Connecting…" then "Connected", state shows "Listening" |
| 1.3 | Tap microphone button again | Session stops, status returns to "Not connected", state "Idle" |

### 2. Basic Voice Loop (Marathi)

| # | Action | Expected Result |
|---|--------|-----------------|
| 2.1 | Tap mic, speak in Marathi: "तुम्ही कसे आहात?" | Partial transcript appears live, then final transcript in history |
| 2.2 | Wait for AI response | AI responds in Marathi (audio plays + text appears), state → "AI Speaking" → "Listening" |
| 2.3 | Speak again: "आणखी एक सांगा" | Second turn completes similarly |

### 3. Language Detection (AUTO mode)

| # | Action | Expected Result |
|---|--------|-----------------|
| 3.1 | With language set to "Auto-detect", speak in Hindi | Detected language badge shows "Hindi — हिन्दी", AI responds in Hindi |
| 3.2 | Speak in Marathi | Badge updates to "Marathi — मराठी", AI responds in Marathi |
| 3.3 | Speak in English | Badge updates to "English", AI responds in English |
| 3.4 | Speak in Tamil | Badge updates to "Tamil — தமிழ்", AI responds in Tamil |

### 4. Fixed Language Mode

| # | Action | Expected Result |
|---|--------|-----------------|
| 4.1 | Open Settings, select "Marathi — मराठी" | Language badge shows "Marathi", STT pinned to mr-IN |
| 4.2 | Speak in Hindi | Transcript appears (STT may transcribe Hindi with mr-IN), AI responds in Marathi |
| 4.3 | Speak in Marathi | Normal Marathi conversation flow |

### 5. Barge-in

| # | Action | Expected Result |
|---|--------|-----------------|
| 5.1 | Speak a long question: "मला भारताचा इतिहास सांगा" | AI starts responding |
| 5.2 | While AI is speaking, say "थांबा" (stop) | AI audio stops immediately, state → "Listening", your "थांबा" is transcribed |
| 5.3 | AI responds to "थांबा" | Short acknowledgment in the detected language |

### 6. Code-Switching

| # | Action | Expected Result |
|---|--------|-----------------|
| 6.1 | Speak: "माझा phone number आहे 9840950950" | Transcript captures the mixed text correctly |
| 6.2 | AI responds | AI responds in Marathi (does NOT switch to English for a few borrowed words) |

### 7. Voice Selection

| # | Action | Expected Result |
|---|--------|-----------------|
| 7.1 | Open Settings, change Voice to "anushka" | Next AI response uses the selected voice |
| 7.2 | Change Voice back to "Default for language" | Next response uses the language default voice |

### 8. Conversation History

| # | Action | Expected Result |
|---|--------|-----------------|
| 8.1 | Complete 3+ turns | History shows all user + AI messages with language labels |
| 8.2 | Click "Clear" | History clears, conversation context resets |

### 9. Error Handling

| # | Action | Expected Result |
|---|--------|-----------------|
| 9.1 | Stop the backend server, tap mic | Error message appears, state → "Error" |
| 9.2 | Restart backend, tap mic again | Session reconnects, error clears |
| 9.3 | Deny microphone permission in browser | "Microphone permission denied" error message |

### 10. Latency

| # | Action | Expected Result |
|---|--------|-----------------|
| 10.1 | Speak a short phrase, observe the latency display | `voice latency: <N>ms` appears at bottom |
| 10.2 | Verify latency is under 1500ms | For a short phrase, total voice latency should be < 1.5s |

### 11. Accessibility

| # | Action | Expected Result |
|---|--------|-----------------|
| 11.1 | Tab to the microphone button | Focus ring visible, aria-label describes current action |
| 11.2 | Press Enter/Space on mic button | Same as click — starts/stops session |
| 11.3 | Use screen reader | State changes announced via aria-live regions |
| 11.4 | Enable "Reduce motion" in OS | Animations are minimal (CSS media query respected) |

### 12. Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 90+ | Full support (AudioWorklet, Web Audio API) |
| Edge 90+ | Full support |
| Firefox 90+ | Should work (AudioWorklet supported since FF 90) |
| Safari 15+ | Should work (AudioWorklet supported since Safari 15) |
