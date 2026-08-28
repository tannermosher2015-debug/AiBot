# Frontline AI widget: open questions and notes

Owner: Tanner. Started 2026-08-27 from a chat-widget edit batch on frontlinewebdesign.tech.

## Waiting on Tanner

- [ ] "Once you bring iPhone keyboard up the chat bubble all messed up" -> the fix is in
      `public/widget.js` and is NOT pushed. Render auto-deploys on push to main, and the
      widget is embedded on every page of the main site, so the push is the publish.
      Confirm on your real iPhone before it ships, because the keyboard behaviour here was
      only ever simulated. What to check: open the chat, tap the message box, and the
      header plus the message box should both stay visible above the keyboard.

- [ ] Which day was the SECOND screenshot taken (the 9:00 one, where the panel runs off the
      right edge and Send is cut off)? Screenshots carry no EXIF date, and the 16px input
      fix that cures the zoom-driven version of that symptom only landed 2026-08-26. If the
      shot predates that fix, it is already cured and needs nothing. If it is from after,
      there is a second cause still to find.

## Noticed, not changed

- `real-clients.html` and `start.html` load the widget but do NOT carry the "hide the mobile
  call bar while the chat is open" script. Only `index.html` has it (line ~1128). So on those
  two pages the call bar and the chat panel are both `position:fixed` and can overlap on a
  phone. Not touched: nobody asked, and the widget fix may make the workaround unnecessary
  anyway. Decide after the iPhone check.

- The comment at `frontline-website/index.html:400` already described this exact iOS keyboard
  problem and worked around it by hiding the call bar. The underlying widget bug was never
  fixed until now. Worth knowing that the workaround can probably be reconsidered.

- The bot still writes em dashes (83 lines across the repo, 35 in `lib/agents.js`). Known and
  open, recorded in memory as [[frontline-ai-bot-live]]. Not part of this batch.

## Done this round

- Chat panel is dragged off screen and its message box buried when the iOS keyboard opens
  (defect). Fixed in `public/widget.js`:
  - the panel now sits above the keyboard instead of under it, driven by the `visualViewport`
    API mirrored into two CSS custom properties;
  - the panel shrinks to the visible height instead of holding 540px;
  - below 520px wide it spans the screen instead of a fixed 370px pinned to the right edge,
    which is the half that produced the off-the-right-edge symptom.
  Verified: old widget leaves the message box 236px under the keyboard line, patched widget
  keeps it 22px above it. Desktop and inline mode measured pixel-identical to before.
  NOT verified on a real iPhone. That is the open item above.
