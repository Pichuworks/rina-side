function evaluateBasisCurve(basisEntries, stepMap, targetLength) {
  const out = new Array(targetLength).fill(0);
  for (const basis of basisEntries) {
    const step = stepMap.get(basis.bandId) ?? 0;
    for (let i = 0; i < out.length; i++) out[i] += (basis.effectDbPerStep[i] ?? 0) * step;
  }
  return out;
}

function computeError(target, predicted, weights, mask) {
  let sum = 0;
  for (let i = 0; i < target.length; i++) {
    if (!mask[i]) continue;
    const error = (predicted[i] ?? 0) - (target[i] ?? 0);
    sum += error * error * Math.max(0, weights[i] ?? 0);
  }
  return sum;
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  if (!n) return [];
  const a = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let pivotValue = Math.abs(a[col][col]);
    for (let row = col + 1; row < n; row++) {
      const value = Math.abs(a[row][col]);
      if (value > pivotValue) {
        pivotValue = value;
        pivotRow = row;
      }
    }
    if (pivotValue < 1e-12) {
      a[col][col] += 1e-9;
      pivotValue = Math.abs(a[col][col]);
      if (pivotValue < 1e-12) continue;
    }
    if (pivotRow !== col) {
      const tmp = a[col];
      a[col] = a[pivotRow];
      a[pivotRow] = tmp;
    }
    const pivot = a[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / pivot;
      if (!Number.isFinite(factor) || Math.abs(factor) < 1e-18) continue;
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  const out = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let rhs = a[row][n];
    for (let col = row + 1; col < n; col++) rhs -= a[row][col] * out[col];
    const denom = a[row][row];
    out[row] = Math.abs(denom) < 1e-12 ? 0 : (rhs / denom);
  }
  return out;
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

function buildActiveProblem(targetDeltaDb, weights, usableMask, eqModel) {
  const activeRows = [];
  for (let i = 0; i < targetDeltaDb.length; i++) {
    if (!usableMask[i]) continue;
    const weight = Math.max(0, weights[i] ?? 0);
    if (!(weight > 0)) continue;
    activeRows.push({ index: i, sqrtWeight: Math.sqrt(weight), target: targetDeltaDb[i] ?? 0 });
  }
  const basisByBandId = new Map(eqModel.basis.map((basis) => [basis.bandId, basis]));
  const bands = eqModel.bands.map((band) => {
    const basis = basisByBandId.get(band.id);
    const weightedColumn = activeRows.map((row) => ((basis?.effectDbPerStep[row.index] ?? 0) * row.sqrtWeight));
    return {
      id: band.id,
      minStep: band.minStep,
      maxStep: band.maxStep,
      weightedColumn,
      weightedNormSq: dot(weightedColumn, weightedColumn),
    };
  });
  return {
    rhs: activeRows.map((row) => row.target * row.sqrtWeight),
    bands,
  };
}

function evaluateWeightedPrediction(columns, steps) {
  const out = new Array(columns[0]?.length || 0).fill(0);
  for (let bandIndex = 0; bandIndex < columns.length; bandIndex++) {
    const step = steps[bandIndex] ?? 0;
    if (!step) continue;
    const column = columns[bandIndex];
    for (let i = 0; i < out.length; i++) out[i] += (column[i] ?? 0) * step;
  }
  return out;
}

function subtractVectors(a, b) {
  return a.map((value, index) => value - (b[index] ?? 0));
}

function computeResidualNormSq(residual) {
  return dot(residual, residual);
}

function solveContinuousRelaxation(problem, freeIndices, rhs) {
  if (!freeIndices.length) return { solution: [], error: computeResidualNormSq(rhs) };
  const size = freeIndices.length;
  const gram = Array.from({ length: size }, () => new Array(size).fill(0));
  const proj = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    const columnI = problem.bands[freeIndices[i]].weightedColumn;
    proj[i] = dot(columnI, rhs);
    for (let j = i; j < size; j++) {
      const columnJ = problem.bands[freeIndices[j]].weightedColumn;
      const value = dot(columnI, columnJ);
      gram[i][j] = value;
      gram[j][i] = value;
    }
  }
  const solution = solveLinearSystem(gram, proj);
  const predicted = new Array(rhs.length).fill(0);
  for (let i = 0; i < size; i++) {
    const column = problem.bands[freeIndices[i]].weightedColumn;
    const scalar = solution[i] ?? 0;
    for (let row = 0; row < rhs.length; row++) predicted[row] += (column[row] ?? 0) * scalar;
  }
  const error = computeResidualNormSq(subtractVectors(rhs, predicted));
  return { solution, error };
}

function nearestInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function buildBranchOrder(center, min, max) {
  const candidates = [];
  for (let value = min; value <= max; value++) candidates.push(value);
  candidates.sort((a, b) => {
    const da = Math.abs(a - center);
    const db = Math.abs(b - center);
    if (Math.abs(da - db) > 1e-12) return da - db;
    return a - b;
  });
  return candidates;
}

export function solveGraphicBasis(targetDeltaDb, weights, usableMask, eqModel) {
  const zeroStepMap = new Map(eqModel.bands.map((band) => [band.id, 0]));
  const zeroCurve = evaluateBasisCurve(eqModel.basis, zeroStepMap, targetDeltaDb.length);
  const problem = buildActiveProblem(targetDeltaDb, weights, usableMask, eqModel);
  if (!problem.rhs.length) {
    return {
      eqSteps: eqModel.bands.map((band) => ({ bandId: band.id, value: 0 })),
      predictedEqDb: zeroCurve,
    };
  }

  const order = problem.bands
    .map((band, index) => ({ index, score: band.weightedNormSq }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.index);

  const columns = problem.bands.map((band) => band.weightedColumn);

  // Solve continuous relaxation first (always fast — just linear algebra)
  const relaxation = solveContinuousRelaxation(problem, order, problem.rhs);
  const continuousSteps = new Array(problem.bands.length).fill(0);
  for (let i = 0; i < order.length; i++) {
    continuousSteps[order[i]] = relaxation.solution[i] ?? 0;
  }

  // Determine if branch-and-bound is feasible
  // Total search space = product of (maxStep - minStep + 1) for all bands
  const maxBranchNodes = problem.bands.reduce((product, band) => {
    const range = Math.abs(band.maxStep - band.minStep) + 1;
    return product * Math.min(range, 50); // cap per-band for estimation
  }, 1);
  const useBranchAndBound = maxBranchNodes <= 1e8; // ~100M nodes max

  if (useBranchAndBound) {
    // Original branch-and-bound for coarse integer EQ (few options per band)
    const initialSteps = new Array(problem.bands.length).fill(0);
    for (let i = 0; i < order.length; i++) {
      const bandIndex = order[i];
      const band = problem.bands[bandIndex];
      initialSteps[bandIndex] = nearestInteger(relaxation.solution[i] ?? 0, band.minStep, band.maxStep);
    }
    let bestSteps = [...initialSteps];
    let bestError = computeResidualNormSq(
      subtractVectors(problem.rhs, evaluateWeightedPrediction(columns, initialSteps)),
    );

    let nodeCount = 0;
    const nodeLimit = 5e6; // hard cap: 5M nodes

    function search(fixedSteps, predictedWeighted) {
      if (++nodeCount > nodeLimit) return;
      const freeIndices = order.filter((index) => fixedSteps[index] == null);
      if (!freeIndices.length) {
        const err = computeResidualNormSq(subtractVectors(problem.rhs, predictedWeighted));
        if (err < bestError) {
          bestError = err;
          bestSteps = [...fixedSteps];
        }
        return;
      }
      const rhs = subtractVectors(problem.rhs, predictedWeighted);
      const innerRelax = solveContinuousRelaxation(problem, freeIndices, rhs);
      if (innerRelax.error >= bestError - 1e-9) return;

      let pivotBandIndex = freeIndices[0];
      let pivotLocalIndex = 0;
      let bestPriority = -Infinity;
      for (let localIndex = 0; localIndex < freeIndices.length; localIndex++) {
        const bandIndex = freeIndices[localIndex];
        const band = problem.bands[bandIndex];
        const continuousValue = innerRelax.solution[localIndex] ?? 0;
        const nearest = Math.round(continuousValue);
        const fractional = Math.abs(continuousValue - nearest);
        const priority = fractional * Math.max(1, band.weightedNormSq);
        if (priority > bestPriority) {
          bestPriority = priority;
          pivotBandIndex = bandIndex;
          pivotLocalIndex = localIndex;
        }
      }

      const pivotBand = problem.bands[pivotBandIndex];
      const branchValues = buildBranchOrder(
        innerRelax.solution[pivotLocalIndex] ?? 0,
        pivotBand.minStep,
        pivotBand.maxStep,
      );

      // Limit branches per node to 7 closest values
      const branchLimit = Math.min(branchValues.length, 7);
      for (let bi = 0; bi < branchLimit; bi++) {
        if (nodeCount > nodeLimit) return;
        const value = branchValues[bi];
        const nextFixed = [...fixedSteps];
        nextFixed[pivotBandIndex] = value;
        const nextPredicted = [...predictedWeighted];
        const column = columns[pivotBandIndex];
        for (let row = 0; row < nextPredicted.length; row++) nextPredicted[row] += (column[row] ?? 0) * value;
        search(nextFixed, nextPredicted);
      }
    }

    search(new Array(problem.bands.length).fill(null), new Array(problem.rhs.length).fill(0));

    const bestStepMap = new Map(eqModel.bands.map((band, index) => [band.id, bestSteps[index] ?? 0]));
    return {
      eqSteps: eqModel.bands.map((band, index) => ({ bandId: band.id, value: bestSteps[index] ?? 0 })),
      predictedEqDb: evaluateBasisCurve(eqModel.basis, bestStepMap, targetDeltaDb.length),
    };
  }

  // ── Fast path: continuous solution quantized to nearest valid step ──
  // Used when step count is too large for B&B (e.g. 0.1dB steps, ±12dB range)
  const quantizedSteps = problem.bands.map((band, index) => {
    const raw = continuousSteps[index];
    const gainStep = eqModel.bands[index]?.gainStepDb || 1;
    // Quantize to the nearest gainStep multiple within [minStep, maxStep]
    const inStepUnits = raw / gainStep;
    const rounded = band.integerOnly !== false ? Math.round(inStepUnits) : Math.round(inStepUnits * 10) / 10;
    return Math.max(band.minStep, Math.min(band.maxStep, rounded));
  });

  const quantizedStepMap = new Map(eqModel.bands.map((band, index) => [band.id, quantizedSteps[index]]));
  return {
    eqSteps: eqModel.bands.map((band, index) => ({ bandId: band.id, value: quantizedSteps[index] })),
    predictedEqDb: evaluateBasisCurve(eqModel.basis, quantizedStepMap, targetDeltaDb.length),
  };
}
