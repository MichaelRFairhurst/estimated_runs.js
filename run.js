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
  return transition_matrix(pas, bbs, ks, fcs, errs, h1s, h2s, h3s, hrs);
}

const b1mask = 1 << 2;
const b2mask = 1 << 3;
const b3mask = 1 << 4;
const basesmask = b1mask | b2mask | b3mask;
const outmask = 3;
const runsmask = 7 << 5;

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
  let shifted = (stateId & basesmask) << bases;
  // "runs scored" bits are a binary repr of runners.
  let excess = getRunsScored(shifted);
  let scored = 0;

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
  let withOuts = out ? addOut(stateId) : stateId;

  if (getOuts(withOuts) > 2) {
    return withOuts;
  }

  let runnersMoved = runnerBases > 0 ? moveRunners(withOuts, runnerBases) : withOuts;
  let withBatterScore = batterScore ? addRunsScored(runnersMoved, 1) : runnersMoved;
  return withBatterScore | batterBase;
}

function printState(stateId) {
  let outs = getOuts(stateId);
  let runs = getRunsScored(stateId);
  let b1 = (stateId & b1mask) == b1mask;
  let b2 = (stateId & b2mask) == b2mask;
  let b3 = (stateId & b3mask) == b3mask;

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
  let state = 0;
  let runs = 0;
  let inning = 1;
  
  while (true) {
    if (getOuts(state) == 3) {
      state = 0;
      inning++;
      if (inning == 8) {
        break;
      }
    }

    let pa = Math.floor(Math.random() * pas);

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

    printState(state);
    runs += getRunsScored(state);
    state = clearRunsScored(state);
    //console.log("runs: " + runs)
  }

    //console.log("final runs: " + runs)
  return runs;
}

//var sum = 0;
//for (var i = 0; i < 100000; ++i) {
//  // old scores
//  //sum += simulate(27, 2, 4, 0, 2, 7, 1, 1, 0);
//
//  // new totals
//  sum += simulate(40, 2, 6, 1, 4, 9, 2, 1, 1);
//
//  // big pink
//  //sum += simulate(13, 0, 3, 1, 1, 3, 1, 1, 1);
//
//  // reign
//  // sum += simulate(8, 0, 0, 0, 2, 2, 1, 0, 0);
//
//  // randos
//  //sum += simulate(15, 2, 3, 0, 1, 3, 0, 0, 0);
//
//}
//
//console.log("");
//console.log(sum / 100000);
//console.log((sum / 100000) / 7);
//console.log("walks: " + walksSeen);
//console.log("ks: " + strikeoutsSeen);
//console.log("fcs: " + fcsSeen);
//console.log("singles: " + singlesSeen);
//console.log("doubles: " + doublesSeen);
//console.log("triples: " + triplesSeen);
//console.log("homers: " + hrsSeen);
//console.log("outs: " + outsSeen);

var transitions = new Map();

function transition_matrix(pas, bbs, ks, fcs, errs, h1s, h2s, h3s, hrs) {
  const stats = {
    'pas': pas,
    'bbs': bbs,
    'ks': ks,
    'fcs': fcs,
    'errs': errs,
    'h1s': h1s,
    'h2s': h2s,
    'h3s': h3s,
    'hrs': hrs
  };

  transition_matrix_step(0, stats);
  //console.log(transitions);

  const expectedRuns = new Map();
  for (const state of transitions.keys()) {
    expectedRuns.set(state, 0);
  }
  
  for (let i = 0; i < 50; ++i) {
    const previousExpected = new Map(expectedRuns);

    for (const [state, probs] of transitions) {
      let sum = 0;
      for (const [result, chance] of probs) {
        let scored = getRunsScored(result);
        let next = clearRunsScored(result);
        sum += (scored + previousExpected.get(next)) * chance;
      }

      expectedRuns.set(state, sum);
    }
  }

  //for (const [state, expected] of expectedRuns) {
  //  printState(state);
  //  console.log("  expected: " + expected + " (" + state + ")");
  //}
  //console.log("");
  //console.log(expectedRuns.get(0) * 7);

  return expectedRuns.get(0) * 7;
}

function transition_matrix_step(state, stats) {
  if (transitions.has(state)) {
    return;
  }

  if (getRunsScored(state) > 0) {
    transition_matrix_step(clearRunsScored(state), stats);
    return;
  }

  if (getOuts(state) == 3) {
    const end = new Map();
    end.set(state, 1);
    transitions.set(state, end);
    return;
  }

  const ends = new Map();
  transitions.set(state, ends);
  const pas = stats.pas;
  
  const bb_chance = stats.bbs / pas;
  // TODO: only forced runners move up!
  const bb_state = stateTransition(state, false, 1, false, b1mask);
  transition_matrix_step(bb_state, stats);
  
  const k_chance = stats.ks / pas;
  const k_state = stateTransition(state, true, 0, false, 0);
  transition_matrix_step(k_state, stats);

  const fc_chance = stats.fcs / pas;
  // TODO: Throw out lead runner? Lead forced runner?
  const fc_state = stateTransition(state, true, 0, false, 0);
  transition_matrix_step(fc_state, stats);

  const err_h1_chance = (stats.errs + stats.h1s) / pas;
  // TODO: simulate singles that drive runners two bases.
  const err_h1_state = stateTransition(state, false, 1, false, b1mask);
  transition_matrix_step(err_h1_state, stats);

  const h2_chance = stats.h2s / pas;
  const h2_state = stateTransition(state, false, 2, false, b2mask);
  transition_matrix_step(h2_state, stats);

  const h3_chance = stats.h3s / pas;
  const h3_state = stateTransition(state, false, 3, false, b3mask);
  transition_matrix_step(h3_state, stats);

  const hr_chance = stats.hrs / pas;
  const hr_state = stateTransition(state, false, 3, true, 0);
  transition_matrix_step(hr_state, stats);

  const bip_out_chance = 1 - bb_chance - k_chance - fc_chance - err_h1_chance - h2_chance - h3_chance - hr_chance;
  const prod_out_chance = bip_out_chance * 0.33;
  const unprod_out_chance = bip_out_chance - prod_out_chance;
  const prod_out_state = stateTransition(state, true, 1, false, 0);
  const unprod_out_state = stateTransition(state, true, 0, false, 0);
  transition_matrix_step(prod_out_state, stats);
  transition_matrix_step(unprod_out_state, stats);

  // Zero all possible transitions
  ends.set(bb_state, 0);
  ends.set(k_state, 0);
  ends.set(fc_state, 0);
  ends.set(err_h1_state, 0);
  ends.set(h2_state, 0);
  ends.set(h3_state, 0);
  ends.set(hr_state, 0);
  ends.set(prod_out_state, 0);
  ends.set(unprod_out_state, 0);

  // Sum all transition probabilities:
  ends.set(bb_state, ends.get(bb_state) + bb_chance);
  ends.set(k_state, ends.get(k_state) + k_chance);
  ends.set(fc_state, ends.get(fc_state) + fc_chance);
  ends.set(err_h1_state, ends.get(err_h1_state) + err_h1_chance);
  ends.set(h2_state, ends.get(h2_state) + h2_chance);
  ends.set(h3_state, ends.get(h3_state) + h3_chance);
  ends.set(hr_state, ends.get(hr_state) + hr_chance);
  ends.set(prod_out_state, ends.get(prod_out_state) + prod_out_chance);
  ends.set(unprod_out_state, ends.get(unprod_out_state) + unprod_out_chance);
}

