# Model memory and device compatibility research

Last researched: November 6, 2026. Status: research/proposed implementation, not shipped compatibility checks or measured phone requirements.

## Scope

Research download storage, runtime RAM and practical phone suitability for the exact catalog model files/quantizations. Owner deferred the review's pricing, APK trust, update wording and mockup changes; do not reopen those as part of this task. Keep research separate from verified A54 measurements and public website claims.

## What the current app does

`src/data/models.json` supplies approximate `sizeBytes` and `minFreeBytes`. `src/services/models.ts` compares `minFreeBytes` with free disk storage; it is NOT a RAM threshold. Defaults are 2048 context tokens and a 384-token reply limit. `src/services/localInference.ts` loads the selected GGUF with four CPU threads, no GPU layers, and requests memory locking on Android. Cache precision and batch sizes are not explicitly configured by the app; inspect the installed native engine's actual defaults/logs before treating an FP16 calculation as its measured allocation.

Whisper loads separately on CPU. An idle loaded chat context can coexist with a voice context even though concurrent chat generation and recording are disabled. Budget for both, the UI/native runtime, and live-transcription audio buffers; do not assume mutually exclusive UI actions imply only one model resides in RAM.

## Source-backed initial findings

- Recommended Qwen 3.5 0.8B: the exact ggml-org Q4_0 file currently lists approximately **563 MB**, whereas the catalog uses 590,000,000 bytes as an estimate. Verify exact remote byte length/revision before changing download accounting. File storage does not establish its process RAM use. [Exact artifact](https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF/blob/main/Qwen3.5-0.8B-Q4_0.gguf).
- Qwen 3.5 0.8B is a hybrid architecture: its configuration mixes 18 linear-attention and six full-attention layers. A full-transformer KV formula does not describe all its state. A 262144-token architectural context ceiling is not a recommended phone setting. [Official config](https://huggingface.co/Qwen/Qwen3.5-0.8B/raw/main/config.json).
- SmolLM2 1.7B has 24 layers and 32 KV heads with 64 dimensions per head. Its context cache can be significant even with small quantized weights. [Official config](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct/raw/main/config.json).
- Qwen3 0.6B and 1.7B configurations both use 28 layers, eight KV heads and 128-dimensional heads. Fine-tuned catalog derivatives must have their actual GGUF metadata checked before inheriting estimates. [0.6B config](https://huggingface.co/Qwen/Qwen3-0.6B/raw/main/config.json), [1.7B config](https://huggingface.co/Qwen/Qwen3-1.7B/raw/main/config.json).
- DeepSeek R1 Distill Qwen 1.5B uses 28 layers, two KV heads and 128 dimensions inferred from hidden size/attention heads. Confirm metadata for the uncensored derivatives. [Official base config](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B/raw/main/config.json).
- Upstream whisper.cpp lists approximate engine memory of Tiny **273 MB**, Base **388 MB**, Small **852 MB**. These are upstream reference figures, not PhoneGPT Android peak process measurements. Small Q5_1 does not have a separately verified figure here; a smaller weight file does not make all scratch/audio allocations proportionally smaller. [Upstream memory reference](https://github.com/ggml-org/whisper.cpp#memory-usage).

## Illustrative calculations — NOT total app RAM

For ordinary full-attention layers, assuming one sequence, FP16 K and V, equal head dimensions and no cache compression/sharing:

`cacheBytes = 2 * layers * kvHeads * headDim * contextTokens * 2`

The first factor counts K and V, the last counts FP16 bytes. Actual allocation can differ through padding, cache type, backend, recurrent state, batch settings and engine version. [Engine implementation](https://github.com/ggml-org/llama.cpp/blob/master/src/llama-kv-cache.cpp).

- SmolLM2 1.7B: approximately **384 MiB** cache at 2048 tokens and **1536 MiB** at 8192 tokens.
- Qwen3 0.6B / 1.7B base architecture: **224 MiB** at 2048 and **896 MiB** at 8192.
- DeepSeek distill base architecture: **56 MiB** at 2048 and **224 MiB** at 8192.
- Qwen 3.5 0.8B: the six full-attention layers alone would contribute approximately **24 MiB** at 2048 and **96 MiB** at 8192 under these assumptions. This excludes its recurrent/linear state and is not a complete cache or total-memory estimate.

Total process memory additionally includes resident weights, compute/scratch buffers, native/JS/UI overhead and any loaded voice model. Model quantization affects weights; it does not automatically apply the same quantization to the context cache. Do not add a download byte count to one cache number and publish the sum as a guaranteed peak.

## Implementation to-do and acceptance criteria

1. Record exact artifact identity (URL, revision/hash, quantization, byte size); retain catalog approximations as such until verified. Cover all 13 chat entries and four voice entries, starting with Qwen 3.5 0.8B and Whisper Tiny/Base, followed by SmolLM2 and DeepSeek Q5/Q8. Gemma and uninspected Llama variants remain unknown rather than receiving invented device minima.
2. Define separate metadata for disk requirement, estimated model-runtime memory at a stated context/cache/batch setup, recommended total device RAM tier, evidence source/date and validation status. Unknown and untested are valid values. A recommended tier needs real-device evidence.
3. Measure standalone PhoneGPT baseline, cold model load, first prompt, long prompt, sustained generation and chat-plus-voice on A54. Test contexts 2048, 4096 and 8192 where supported; include repeat runs, warm/cold starts and background app pressure. Record Android version, physical RAM variant, app/engine version, model hash, settings, PSS/RSS/native memory, system available memory, first-token latency, speed, thermal behavior and load/crash outcome.
4. Use Android memory information and `adb shell dumpsys meminfo com.phonegpt.app` with sampling during allocation/inference. Java heap alone misses native inference memory. Distinguish baseline, total process peak and incremental model memory; sampling can miss short peaks, so document cadence. Do not treat total advertised RAM as currently available or guaranteed allocatable memory. [MemoryInfo](https://developer.android.com/reference/android/app/ActivityManager.MemoryInfo), [dumpsys](https://developer.android.com/tools/dumpsys#meminfo).
5. Show plain labels such as Download size, Estimated memory at 2048 context, and Tested on [device/config]. Compare available memory against a documented estimate plus measured safety margin before loading, but use advisory warnings while data is incomplete. Avoid false hard rejection from unvalidated thresholds.
6. Recompute estimates/warnings when context changes, account for a loaded voice model, and detect/recover from load failure. Keep measurements local; this feature does not need analytics uploads.
7. Publish website/device guidance only after validating the specific file/settings on actual devices. A 4/6/8-GB device class, loading success, useful speed and sustained stability are different claims.

No APK/model download, model benchmark, device RAM measurement or inference-setting change was performed for this research task. No fixed minimum RAM or guaranteed model compatibility is established yet.
