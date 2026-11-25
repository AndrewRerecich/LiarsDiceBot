// BOT_NAME: MomentumAdaptiveWithAggressiveTwist
// Authorship: Andrew Rerecich (000845049)

const BASE_CALL_THRESHOLD = 0.22;
const HIGH_MOMENTUM_SKEPTIC = 0.31;
const LOW_MOMENTUM_FRIENDLY = 0.16; //Just a few adjustements to skepticism and how to define momentum, turns out higher all around skepticism is better

const MOM_WINDOW = 3;
const MOM_HIGH = 2; // Way lower high momentum means, in too many raises in quantity is more likely to be a bluff
const MOM_LOW = 1;

self.onmessage = (e) => {
    const { state } = e.data;
    const myDice = state.you.dice || [];
    const players = state.players || [];
    const currentBid = state.currentBid || null;
    const history = state.history || null;

    const totalDiceOnTable = players.reduce((s, p) => s + p.diceCount, 0);
    const unknownDiceCount = totalDiceOnTable - myDice.length;

    const myFaceCounts = Array(7).fill(0);
    for (const d of myDice)
        if (d >= 1 && d <= 6)
            myFaceCounts[d]++;

    function recentMomentum() {
        // This function now gets the current hands first quantity raise and compairs it with the hands last quantity raise
        // If it's been risen too much since it's first raise, the bot doesn't call liar, but gets skeptical. 
        // I made it not measure increase in face as increase in face did not necessarily mean someone is increasing the probability to slip by.

        const currentHandNumber = history[history.length - 1].hand;
        const recent = history.slice(0 - MOM_WINDOW);
        let numberOfRaises = 0;
        let qtyOfRaises = 0;
        let firstRaise = 0;
        for (const h of recent) {
            if (h.hand == currentHandNumber && h.action === 'raise') {
                numberOfRaises++;
                qtyOfRaises += h.quantity;
                if (numberOfRaises == 1) {
                    firstRaise = qtyOfRaises;
                }
            }
        }
        return qtyOfRaises - firstRaise;
    }


    function binomPMF(unknownQuantityNeeded) {
        let c = 1;
        for (let i = 1; i <= unknownQuantityNeeded; i++)
            c = c * (unknownDiceCount - (unknownQuantityNeeded - i)) / i;
        return c * Math.pow((1 / 6), unknownQuantityNeeded) * Math.pow(1 - (1 / 6), unknownDiceCount - unknownQuantityNeeded);
    }

    function binomTail(unknownQuantityNeeded) { //Cleaned up some redundant code and made it MUCH MORE readable so I could understand what it was doing
        if (unknownQuantityNeeded <= 0)
            return 1;
        if (unknownQuantityNeeded > unknownDiceCount)
            return 0;
        let t = binomPMF(unknownQuantityNeeded);
        let sum = t;
        for (let x = unknownQuantityNeeded + 1; x <= unknownDiceCount; x++) {
            t = t * ((unknownDiceCount - (x - 1)) / x) * ((1 / 6) / (1 - (1 / 6)));
            sum += t;
            if (t < 1e-3)
                break;
        }
        return Math.max(0, Math.min(1, sum));
    }

    function probabilityAtLeast(face, qty) {
        const unknownQuantityNeeded = Math.max(0, qty - myFaceCounts[face]);
        return binomTail(unknownQuantityNeeded);
    }


    if (!currentBid) {
        let bestFace = 1, bestCount = -1;
        for (let f = 1; f <= 6; f++)
            if (myFaceCounts[f] > bestCount) {
                bestFace = f;
                bestCount = myFaceCounts[f];
            }

        let qty = Math.max(2, bestCount);

        while (probabilityAtLeast(bestFace, qty + 1) >= (0.85))    // Took the aggressive bot's call strategy when no current bid
            qty++;                                                // Then adjusted the probability to so its aggression is less detectable

        postMessage({
            action: 'raise',
            quantity: qty - 1,
            face: bestFace
        });
        return;
    }

    const { quantity: prevQty, face: prevFace } = currentBid;
    // Unchanged from original Momentum Adaptaive Bot
    const mom = recentMomentum();
    let liarThreshold = BASE_CALL_THRESHOLD;
    if (mom >= MOM_HIGH)
        liarThreshold = HIGH_MOMENTUM_SKEPTIC;
    else if (mom <= MOM_LOW)
        liarThreshold = LOW_MOMENTUM_FRIENDLY;
    const claimLikely = probabilityAtLeast(prevFace, prevQty);
    if (claimLikely < liarThreshold) {
        postMessage({
            action: 'liar'
        });
        return;
    }

    const raiseQ = prevQty + 1;
    const ok = probabilityAtLeast(prevFace, raiseQ) >= liarThreshold;
    if (ok || prevFace == 6) { // Made it so that if the face is already as high as it can go, increase the quantity even if increasing it will be a little unlikely
        postMessage({
            action: 'raise',
            quantity: raiseQ,
            face: prevFace
        });
    } else {
        for (let f = prevFace + 1; f <= 6; f++) {
            if (probabilityAtLeast(f, prevQty) >= liarThreshold) {
                postMessage({
                    action: 'raise',
                    quantity: prevQty,
                    face: f
                });
                return;
            } else {
                postMessage({ //Whatever gets through, increase quantity instead
                    action: 'raise',
                    quantity: prevQty +1,
                    face: prevFace
                });
                return;
            }
        }
        postMessage({ action: 'liar' }); // Keeping the catch-all. I like it.
    }
};