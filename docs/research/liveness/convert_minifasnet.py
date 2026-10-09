import argparse
import hashlib
import sys
from pathlib import Path

import numpy
import onnx
import onnxruntime
import torch


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()

    sys.path.insert(0, str(arguments.repo))
    from src.model_lib import MiniFASNet as architectures
    from src.utility import get_kernel, parse_model_name

    height, width, model_type = parse_model_name(arguments.weights.name)[:3]
    model = getattr(architectures, model_type)(conv6_kernel=get_kernel(height, width))
    state = torch.load(arguments.weights, map_location="cpu", weights_only=True)
    model.load_state_dict(
        {key.removeprefix("module."): value for key, value in state.items()}
    )
    model.eval()

    torch.manual_seed(0)
    sample = torch.rand(1, 3, height, width)
    torch.onnx.export(
        model, (sample,), arguments.output, verbose=False, external_data=False
    )
    exported = onnx.load(arguments.output)
    for node in exported.graph.node:
        del node.metadata_props[:]
    onnx.save(exported, arguments.output)

    with torch.no_grad():
        expected = model(sample).numpy()
    session = onnxruntime.InferenceSession(
        arguments.output, providers=["CPUExecutionProvider"]
    )
    actual = session.run(None, {session.get_inputs()[0].name: sample.numpy()})[0]
    max_abs_diff = float(numpy.abs(actual - expected).max())

    if max_abs_diff > 1e-4:
        arguments.output.unlink()
        print(
            f"conversion mismatch model={arguments.output.name} max_abs_diff={max_abs_diff:.3e}"
        )
        return 1

    opset = next(
        entry.version
        for entry in exported.opset_import
        if entry.domain == ""
    )
    sha256 = hashlib.sha256(arguments.output.read_bytes()).hexdigest()
    print(
        f"converted model={arguments.output.name} opset={opset} sha256={sha256} "
        f"max_abs_diff={max_abs_diff:.3e}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
