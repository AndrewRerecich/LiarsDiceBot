// BOT_NAME: CallsLiarWithGive
// Authorship: Andrew Rerecich (000845049)

self.onmessage = (e) => {
  const { state } = e.data;
  const { you, players, currentBid, history, rules } = state;

  const totalDice = players.reduce((s, p) => s + p.diceCount, 0);

  const expected = Math.round(totalDice / 6);

  const counts = [0, 0, 0, 0, 0, 0];
  for (const d of you.dice) {
    counts[d - 1]++;
  }

  let halfAmountOfDice = Math.round(you.dice.length / 2) - 1;
  let median = you.dice[halfAmountOfDice];
  if (!currentBid) {

    let medFace = 6, medCount = -1;
    for (let f = 1; f <= 6; f++) {
      if (f == median) {
        medCount = counts[f - 1];
        medFace = f;
      }
    }

    const q = Math.max(1, medCount, expected);
    postMessage({
      action: "raise",
      quantity: q,
      face: medFace
    });
    return;
  } else {
    const { quantity: Q, face: F } = currentBid;

    const recent = history.slice(-50);
    const raisesBySeat = {};
    for (const h of recent)
      if (h.action === 'raise')
        raisesBySeat[h.actor] = (raisesBySeat[h.actor] || 0) + 1;


    if (Q > expected + 1) {
      postMessage({ action: "liar" });
      return;
    }

    if (F < you.dice[you.dice.length - 1]) {
      for (const d of you.dice) {
        if (F + 1 <= d) {
          postMessage({ action: "raise", quantity: Q, face: d });
          return;
        }
      }
    }
    else if (F >= you.dice[you.dice.length - 1]) {
      if (Q + 2 <= expected) {
        postMessage({ action: "raise", quantity: Q + 1, face: F });
        return;
      } else {
        const lastAction = history.slice(-1);
        const lastActor = lastAction[0].actor;
        const lastActorRaiseRatio = raisesBySeat[lastActor] / history[history.length - 1].hand;
        if (lastActorRaiseRatio > 0.7) {
          postMessage({ action: "liar" });
          return;
        }
        let myPosition = false;
        for (const p of players) {
          if (p.id != you.id) {
            if (p.diceCount > 0 && myPosition) {
              const nextActorRaiseRatio = raisesBySeat[p.id] / history[history.length - 1].hand;
              if (nextActorRaiseRatio < 0.8) {
                postMessage({ action: "liar" });
                return;
              } else {
                postMessage({ action: "raise", quantity: Q + 1, face: F });
                return;
              }
            }
          } else {
            myPosition = true;
          }
        }
      }
    }
  }
};
