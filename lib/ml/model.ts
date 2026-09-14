import type { MlModel } from "@/lib/ml/types";
import { FEATURE_VERSION } from "@/lib/ml/features";

const MIN_STD = 1e-8;

function sigmoid(x: number) {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function standardize(rows: number[][]) {
  const width = rows[0]?.length ?? 0;
  const mean = Array.from({ length: width }, (_, j) => rows.reduce((sum, row) => sum + row[j], 0) / rows.length);
  const std = mean.map((m, j) => Math.sqrt(rows.reduce((sum, row) => sum + (row[j] - m) ** 2, 0) / rows.length) || 1);
  return { mean, std };
}

function normalize(row: number[], mean: number[], std: number[]) {
  return row.map((value, i) => (value - mean[i]) / Math.max(std[i], MIN_STD));
}

export function predict(model: MlModel, features: number[]) {
  const x = normalize(features, model.mean, model.std);
  return sigmoid(model.bias + model.weights.reduce((sum, w, i) => sum + w * x[i], 0));
}

export function trainLogisticRegression(features: number[][], labels: boolean[]): MlModel {
  if (!features.length || features.length !== labels.length) throw new Error("Dataset ML vacío o inconsistente");
  const { mean, std } = standardize(features);
  const x = features.map((row) => normalize(row, mean, std));
  const y: number[] = labels.map((value) => value ? 1 : 0);
  const width = x[0].length;
  const positiveRate = y.reduce((a, b) => a + b, 0) / y.length;
  let weights = Array<number>(width).fill(0);
  let bias = Math.log(Math.max(0.001, Math.min(0.999, positiveRate)) / Math.max(0.001, 1 - positiveRate));

  const epochs = Math.min(900, Math.max(250, Math.floor(250 + features.length / 4)));
  const learningRate = 0.035;
  const l2 = 0.012;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const grad = Array<number>(width).fill(0);
    let biasGrad = 0;
    for (let i = 0; i < x.length; i += 1) {
      const p = sigmoid(bias + weights.reduce((sum, w, j) => sum + w * x[i][j], 0));
      const error = p - y[i];
      for (let j = 0; j < width; j += 1) grad[j] += error * x[i][j];
      biasGrad += error;
    }
    const rate = learningRate / Math.sqrt(1 + epoch / 120);
    for (let j = 0; j < width; j += 1) {
      weights[j] -= rate * ((grad[j] / x.length) + l2 * weights[j]);
    }
    bias -= rate * (biasGrad / x.length);
  }

  const probabilities = features.map((row) => sigmoid(bias + weights.reduce((sum, w, i) => sum + w * normalize(row, mean, std)[i], 0)));
  let correct = 0;
  let logLoss = 0;
  probabilities.forEach((p, i) => {
    if ((p >= 0.5) === labels[i]) correct += 1;
    const q = Math.max(1e-6, Math.min(1 - 1e-6, p));
    logLoss += -(y[i] * Math.log(q) + (1 - y[i]) * Math.log(1 - q));
  });

  return {
    model_version: "ml-calibrator-v1",
    feature_version: FEATURE_VERSION,
    weights,
    mean,
    std,
    bias,
    sample_count: features.length,
    accuracy: correct / features.length,
    log_loss: logLoss / features.length,
    trained_at: new Date().toISOString(),
  };
}
