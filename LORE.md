# SISTA BUSSEN — lore

Draft for approval. Nothing here exists in the game yet; see issue #7 for the delivery plan. Written to
answer the two questions a new player actually asks: *why am I waiting for the last bus* and *who are these
things I am killing*. Tone: deadpan Swedish, funny in the details, never winking at the player.

Constraint: this must not touch `src/sim/`. Lore is text and presentation over frozen mechanics.

## The premise

The city stops running at midnight. Buses stop, trains stop, most people go home. One departure is left on
the board, the one nobody talks about: **03:00**, destination `Slutstation`.

It stops only for someone who is still standing at a stop when it arrives. Not someone who is sitting down.
Not someone who gave up and walked. Not someone who is already dead.

Everyone else at the stop has been waiting longer than you. They are not monsters. They missed the bus,
once, and never left. Now every night there is one seat, and they want it back. That is the whole game: you
are holding a place in a queue that other people have been holding since before you were born.

The three playable characters are all people with a reason to be out at 23:00 and no money for a taxi.

## Cold open — 20 seconds, once, skippable

Four still frames over a bus-stop sign, text only, no voice, no video file. Skippable at any point and
replayable from the menu (see #7).

1. **Frame 1.** A departures board. Everything is greyed out except one line: `03:00 Slutstation`. Caption:
   *"Det går en buss. Den går sällan."*
2. **Frame 2.** The stop seen from the back: silhouettes waiting, all facing the road, none of them moving.
   Caption: *"De andra har stått här längre än du."*
3. **Frame 3.** The board again, now lit from below. Your name is not on it. Theirs are not either. Caption:
   *"Bussen stannar inte för vem som helst. Den stannar för den som står kvar."*
4. **Frame 4.** Headlights approaching from far down the road, sodium lamps going out one by one behind them.
   Caption: *"Håll ut till 03:00."*

Then the menu. No explanation of mechanics here; the existing first-night card still teaches those.

## Anslagstavlan — the codex

Delivered as an in-game notice board at the stop, entries written as laminated notes and torn timetable
scraps, unlocked the night you first meet each one. This is the answer to *what am I fighting*, given at the
moment the player actually cares.

| Enemies | Entry |
|---|---|
| Fyllo | "Har väntat sedan 1998. Har fortfarande inte bråttom. Tar plats." |
| Duva | "Det enda i den här stan som aldrig varit försenat." |
| Skugga | "Allt som ljuset inte når fram till." |
| Vaktmästare | "Ska stänga hållplatsen. Har försökt sedan 23:00." (kastar koner) |
| Elsparkcykel | "Någon ställde den mitt på trottoaren. Nu står den inte still längre." |
| Nattvakten (02:30) | "Bestämmer vem som får vara kvar i kylan. Matar duvorna. Har gjort det i trettio år." |
| Busschauffören (03:00) | "Bussen stannar inte för de döda. Du måste visa att du är levande." |

Character notes, shown once the player picks them:

- **Nattvandraren** — "*Går hem varje natt. Har aldrig kommit fram.*" (van vid mörkret)
- **Pensionären** — "*Har tid. Har alltid tid. Det är det som är problemet.*" (har tid)
- **Studenten** — "*Pluggar på natten. Det gör alla andra också.*" (pluggar natten)

## Win and loss

- **Win (03:00).** Doors open. The board flickers and shows the next stop instead of `Slutstation`. One line:
  *"Du kom med. Nästa hållplats är längre bort."* The bus does not explain itself and neither do we.
- **Loss.** The bus is delayed again (existing copy). It never says how long. It is always there tomorrow.
- **Revive.** An advertisement, in fiction: *"BUSSEN ÄR FÖRSENAD"* — the one thing the city is reliable at is
  being late. Keep it exactly as it reads today; it is already the best line in the game.

## Why this and not a video

A video intro is the obvious instinct and the wrong first move here:

- The app is offline-first and installable. A video is megabytes in the binary and in the cache, for something
  a player sees once.
- Every line above is text. Text can be fixed, translated and rewritten without a render or an App Store
  review, and it costs nothing to keep in the service worker cache.
- In-app copy can only be changed through the update flow, which is fast. A rendered video cannot.

Where a video *does* earn its place: the App Store preview/trailer and the launch post. That is a marketing
asset, produced once, outside the binary. Not the in-app explanation.

## Open questions for Max

1. Is "en plats i kön" the right frame, or should the bus stop be rarer still (once a year)?
2. Should the bus driver speak at 03:00, or stay silent? Silence is stronger; speaking is friendlier.
3. Any objection to the 1998 joke in the Fyllo entry — it dates the game.