import argparse
import time
import timeit
from pathlib import Path

import numpy
import onnxruntime


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, action="append", required=True)
    arguments = parser.parse_args()

    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 1
    generator = numpy.random.default_rng(0)
    executions = []
    for model in arguments.model:
        session = onnxruntime.InferenceSession(
            model, options, providers=["CPUExecutionProvider"]
        )
        declared = session.get_inputs()[0]
        shape = [
            dimension if isinstance(dimension, int) else 1
            for dimension in declared.shape
        ]
        executions.append(
            (session, {declared.name: generator.random(shape, dtype=numpy.float32)})
        )

    def run_models() -> None:
        for session, feed in executions:
            session.run(None, feed)

    timeit.timeit(run_models, number=50)
    durations = timeit.repeat(
        run_models, timer=time.perf_counter_ns, repeat=1000, number=1
    )
    p50_ms, p95_ms = numpy.percentile(durations, [50, 95]) / 1e6

    names = ",".join(model.name for model in arguments.model)
    print(f"latency model={names} runs=1000 p50_ms={p50_ms:.3f} p95_ms={p95_ms:.3f}")


if __name__ == "__main__":
    main()
