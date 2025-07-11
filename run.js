/**
 * Estimates the number of runs a batter will score based on their stats
 * @param {number} pas Plate appearances
 * @param {number} bbs Walks
 * @param {number} ks Strikeouts
 * @param {number} fcs Fielder's choices
 * @param {number} errs Bases on error
 * @param {number} h1s Singles
 * @param {number} h2s Doubles
 * @param {number} h3s Triples
 * @param {number} hrs Home runs
 * @return The estimated runs
 * @customfunction
*/
function EST_RUNS(pas, bbs, ks, fcs, errs, h1s, h2s, h3s, hrs) {
  
}

var b1mask = 1 << 2;
var b2mask = 1 << 3;
var b3mask = 1 << 4;
var basesmask = b1mask | b2mask | b3mask;
var outmask = 3;
var runsmask = 7 << 5;

function stateId(b1, b2, b3, outs) {
  return (b1 << 4) | (b2 << 3) | (b3 << 2) | outs
}

function getOuts(stateId) {
  return stateId & outmask;
}

function addOut(stateId) {
  if (getOuts(stateId) >= 2) {
    return 3; // no runners, no runs scored, just 3 outs.
  }
  // Clear outs from state bits, set to outs + 1
  return (stateId & ~outmask) | (getOuts(stateId) + 1);
}

function clearRunsScored(stateId) {
  return stateId & ~runsmask;
}

function getRunsScored(stateId) {
  return stateId >> 5;
}

function addRunsScored(stateId, runs) {
  return clearRunsScored(stateId) | ((getRunsScored(stateId) + runs) << 5);
}

function moveRunners(stateId, bases) {
  // Literally move the bits as if they are runners
  var shifted = (stateId & basesmask) << bases;
  // "runs scored" bits are a binary repr of runners.
  var excess = getRunsScored(shifted);
  var scored = 0;

  if (excess == 1 || excess == 2 || excess == 4) {
    // binary 001, 010, 100
    scored = 1;
  } else if (excess == 3 || excess == 6 || excess == 5) {
    // binary 011, 110, 101
    scored = 2;
  } else if (excess == 7) {
    // binary 111
    scored = 3;
  }

  return clearRunsScored(shifted) | (scored << 5) | getOuts(stateId);
}

function stateTransition(stateId, out, runnerBases, batterScore, batterBase) {
  var withOuts = out ? addOut(stateId) : stateId;

  if (getOuts(withOuts) > 2) {
    return withOuts;
  }

  var runnersMoved = runnerBases > 0 ? moveRunners(withOuts, runnerBases) : withOuts;
  var withBatterScore = batterScore ? addRunsScored(runnersMoved, 1) : runnersMoved;
  return withBatterScore | batterBase;
}

function printState(stateId) {
  var outs = getOuts(stateId);
  var runs = getRunsScored(stateId);
  var b1 = (stateId & b1mask) == b1mask;
  var b2 = (stateId & b2mask) == b2mask;
  var b3 = (stateId & b3mask) == b3mask;

  console.log("1b: " + b1 + ", 2b: " + b2 + ", 3b: " + b3 + ", " + outs + " outs (and " + runs + " just scored)");
}

var walksSeen = 0;
var strikeoutsSeen = 0;
var fcsSeen = 0;
var singlesSeen = 0;
var doublesSeen = 0;
var triplesSeen = 0;
var hrsSeen = 0;
var outsSeen = 0;
function simulate(pas, bbs, ks, fcs, errs, h1s, h2s, h3s, hrs) {
  var state = 0;
  var runs = 0;
  var inning = 1;
  
  while (true) {
    if (getOuts(state) == 3) {
      state = 0;
      inning++;
      if (inning == 8) {
        break;
      }
    }

    var pa = Math.floor(Math.random() * pas);

    if (pa < bbs) {
      // Walk
      // TODO: only forced runners move up!
      //console.log("walk");
      walksSeen++;
      state = stateTransition(state, false, 1, false, b1mask);
    } else if (pa < bbs + ks) {
      // Strikeout
      //console.log("strikeout");
      strikeoutsSeen++;
      state = stateTransition(state, true, 0, false, 0);
    } else if (pa < bbs + ks + fcs) {
      // Fielder's choice
      // TODO: Throw out lead runner? Lead forced runner?
      //console.log("fielder's choice");
      fcsSeen++;
      state = stateTransition(state, true, 0, false, 0);
    } else if (pa < bbs + ks + fcs + errs + h1s) {
      // Error and singles:
      // TODO: simulate singles that drive runners two bases.
      //console.log("single or error");
      singlesSeen++;
      state = stateTransition(state, false, 1, false, b1mask);
    } else if (pa < bbs + ks + fcs + errs + h1s + h2s) {
      // Doubles
      //console.log("double");
      doublesSeen++;
      state = stateTransition(state, false, 2, false, b2mask);
    } else if (pa < bbs + ks + fcs + errs + h1s + h2s + h3s) {
      // Triples
      //console.log("triple");
      triplesSeen++;
      state = stateTransition(state, false, 3, false, b3mask);
    } else if (pa < bbs + ks + fcs + errs + h1s + h2s + h3s + hrs) {
      // HRs
      //console.log("home run");
      // TODO: include home runs (I don't have any in the data)
      hrsSeen++;
      state = stateTransition(state, false, 3, true, 0);
    } else {
      // Groundouts and flyouts. Assume 1/3rd move runners up?
      //console.log("groundout or flyout etc");
      outsSeen++;
      if (Math.random() < 0.33) {
        state = stateTransition(state, true, 1, false, 0);
      } else {
        state = stateTransition(state, true, 0, false, 0);
      }
    }

    //printState(state);
    runs += getRunsScored(state);
    state = clearRunsScored(state);
    //console.log("runs: " + runs)
  }

    console.log("final runs: " + runs)
  return runs;
}

var sum = 0;
for (var i = 0; i < 100000; ++i) {
  // old scores
  //sum += simulate(27, 2, 4, 0, 2, 7, 1, 1, 0);

  // new totals
  //sum += simulate(40, 2, 6, 1, 4, 9, 2, 1, 1);

  // big pink
  //sum += simulate(13, 0, 3, 1, 1, 3, 1, 1, 1);

  // reign
  // sum += simulate(8, 0, 0, 0, 2, 2, 1, 0, 0);

  // randos
  sum += simulate(15, 2, 3, 0, 1, 3, 0, 0, 0);

}

console.log("");
console.log(sum / 100000);
console.log("walks: " + walksSeen);
console.log("ks: " + strikeoutsSeen);
console.log("fcs: " + fcsSeen);
console.log("singles: " + singlesSeen);
console.log("doubles: " + doublesSeen);
console.log("triples: " + triplesSeen);
console.log("homers: " + hrsSeen);
console.log("outs: " + outsSeen);
