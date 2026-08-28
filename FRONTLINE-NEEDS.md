# Frontline AI widget: open questions and notes

Owner: Tanner. Started 2026-08-27 from a chat-widget edit batch on frontlinewebdesign.tech.

## Waiting on Tanner

- [x] "Once you bring iPhone keyboard up the chat bubble all messed up" -> SHIPPED
      2026-08-27, commit a2a7c57, live on Render about 30s after the push and verified by
      content against the local source. TANNER CHECKED IT ON HIS REAL IPHONE the same day
      and reported "Way better". That is HIS report of the live behaviour, which is the
      only evidence that exists for the real keyboard: everything on this machine was
      simulated. Note the wording is "way better", not "fixed", so if this file is ever
      reopened, do not read it as a clean pass.

- [ ] The SECOND screenshot (9:00, panel running off the right edge with Send cut off) is
      STILL UNEXPLAINED, and two theories were tested and both failed:
        1. Page zoom, from the sub-16px input fixed on 2026-08-26. Measured by isolating the
           amber Send button as a connected component in both screenshots: 125px tall in the
           first shot, 135px in the second. 8 percent, not the ~50 percent a zoom would give.
           So the page was NOT meaningfully zoomed and this is not the cause.
        2. The host page scrolling sideways, which drags fixed elements out of place.
           Measured on the live homepage at 375px wide: scrollWidth equals clientWidth, zero
           overflow, zero elements past the right edge. Not the cause either.
      What the measurement DOES say: the panel sat roughly 53 CSS px further right in that
      shot, clipped, rather than being scaled up. The shipped fix makes the panel span the
      screen below 520px, which should absorb a shift that size, but that is reasoning and
      not a measurement of the original failure.
      Cheapest way to close this: retest on the iPhone now that the fix is live. If it still
      happens, send a screenshot taken THAT DAY, and say which page it was on.

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
  Verified again on the LIVE site after deploy: header visible, input above the keyboard,
  panel inside the screen width, call bar correctly hidden while chatting.
  NOT verified on a real iPhone. That is the open item above.
