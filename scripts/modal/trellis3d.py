# Vibrex 3D 생성 서버 — Microsoft TRELLIS(MIT) 를 Modal GPU 서버리스에서 돌린다.
# 배포: python3 -m modal deploy scripts/modal/trellis3d.py
# 비밀값: modal secret create vibrex-3d AUTH_TOKEN=<임의 문자열>  (Vercel 의 MODAL_3D_TOKEN 과 같은 값)
#
# POST /submit  {mode:'image'|'text', image_b64?, image_url?, prompt?, seed?} → {id}
# GET  /result/{id}            → {status:'running'} | {status:'done', glb_bytes} | {status:'failed', error}
# GET  /result/{id}/glb|thumb  → 파일 바이트
import io
import os

import modal

app = modal.App("vibrex-3d")
cache = modal.Volume.from_name("vibrex-3d-cache", create_if_missing=True)
CACHE = "/cache"

ARCH = "8.6;8.9"  # A10G · L4
image = (
    modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.10")
    .apt_install("git", "libgl1", "libglib2.0-0", "libxrender1", "libsm6", "libxext6", "libgomp1", "libegl1", "libopengl0", "libglvnd0", "libglx0", "libx11-6", "libusb-1.0-0", "libgomp1", "build-essential", "ninja-build")
    .pip_install("torch==2.4.0", "torchvision==0.19.0", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install("xformers==0.0.27.post2", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install(
        "pillow", "imageio", "imageio-ffmpeg", "tqdm", "easydict", "opencv-python-headless", "scipy", "ninja",
        "rembg", "onnxruntime", "trimesh", "open3d", "xatlas", "pyvista", "pymeshfix", "igraph",
        "transformers==4.46.3", "huggingface_hub", "safetensors", "spconv-cu120", "fastapi[standard]",
        "git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8",
    )
    .pip_install("kaolin", find_links="https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.0_cu121.html")
    .pip_install("wheel", "setuptools<70")
    .env({"TORCH_CUDA_ARCH_LIST": ARCH, "FORCE_CUDA": "1", "CC": "gcc", "CXX": "g++"})
    .run_commands(
        "git clone --branch v0.3.3 --depth 1 https://github.com/NVlabs/nvdiffrast /tmp/nvdiffrast && pip install --no-build-isolation /tmp/nvdiffrast",
        "git clone --recursive https://github.com/autonomousvision/mip-splatting /tmp/mip && pip install --no-build-isolation /tmp/mip/submodules/diff-gaussian-rasterization/",
        "git clone --depth 1 https://github.com/microsoft/TRELLIS /trellis",
    )
    .run_commands("cd /trellis && git submodule update --init --recursive --depth 1")  # flexicubes
    .env({
        "PYTHONPATH": "/trellis", "ATTN_BACKEND": "xformers", "SPCONV_ALGO": "native",
        "HF_HOME": f"{CACHE}/hf", "TORCH_HOME": f"{CACHE}/torch", "U2NET_HOME": f"{CACHE}/u2net",
    })
)

# 이미지 생성 — FLUX.1-schnell (Apache 2.0) · 4스텝 · L40S(48GB). 투명 배경이 필요하면 rembg 로 배경을 지운다
flux_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("torch==2.5.1", index_url="https://download.pytorch.org/whl/cu124")
    .pip_install("diffusers==0.32.2", "transformers==4.48.3", "accelerate", "sentencepiece", "protobuf", "huggingface_hub[hf_transfer]", "pillow", "rembg[gpu]", "onnxruntime-gpu")
    .env({"HF_HOME": f"{CACHE}/hf", "U2NET_HOME": f"{CACHE}/u2net", "HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

# 입체화 — 2D 그림을 '3D 로 렌더한 피규어' 이미지로 다시 그린다 (Qwen-Image-Edit-2509, Apache 2.0) → TRELLIS 가 둥근 입체를 만든다
edit_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install("torch==2.6.0", "torchvision==0.21.0", index_url="https://download.pytorch.org/whl/cu124")
    .pip_install("git+https://github.com/huggingface/diffusers", "transformers>=4.51", "accelerate", "sentencepiece", "protobuf", "huggingface_hub[hf_transfer]", "pillow")
    .env({"HF_HOME": f"{CACHE}/hf", "HF_HUB_ENABLE_HF_TRANSFER": "1"})
)
VOLUMIZE = ("Turn this 2D drawing into a high-quality 3D rendered figurine of the same character: rounded volumetric body and head, "
            "soft vinyl toy material, same design, colors, face and proportions, full body, front view, centered, "
            "plain pure white background, soft studio lighting, no outlines, no text.")

web_image = modal.Image.debian_slim(python_version="3.10").pip_install("fastapi[standard]")


@app.cls(image=image, gpu="A10G", volumes={CACHE: cache}, timeout=600, scaledown_window=120, max_containers=3)
class Trellis:
    @modal.enter()
    def load(self):
        import torch  # noqa: F401
        from trellis.pipelines import TrellisImageTo3DPipeline
        self.img = TrellisImageTo3DPipeline.from_pretrained("JeffreyXiang/TRELLIS-image-large")
        self.img.cuda()
        self.txt = None
        cache.commit()

    def _text_pipeline(self):
        if self.txt is None:
            from trellis.pipelines import TrellisTextTo3DPipeline
            self.txt = TrellisTextTo3DPipeline.from_pretrained("JeffreyXiang/TRELLIS-text-large")
            self.txt.cuda()
            cache.commit()
        return self.txt

    @modal.method()
    def generate(self, mode: str, image_bytes: bytes | None = None, prompt: str = "", seed: int = 1) -> dict:
        from PIL import Image
        from trellis.utils import postprocessing_utils

        thumb = None
        args = dict(seed=seed, formats=["gaussian", "mesh"],
                    sparse_structure_sampler_params={"steps": 12, "cfg_strength": 7.5},
                    slat_sampler_params={"steps": 12, "cfg_strength": 3})
        if mode == "text":
            out = self._text_pipeline().run(prompt, **args)
        else:
            im = self._cutout(Image.open(io.BytesIO(image_bytes)))
            pre = self.img.preprocess_image(im)          # 배경 제거·가운데 정렬 → 썸네일로도 쓴다
            b = io.BytesIO(); pre.save(b, "PNG"); thumb = b.getvalue()
            out = self.img.run(pre, preprocess_image=False, **args)
        glb = postprocessing_utils.to_glb(out["gaussian"][0], out["mesh"][0], simplify=0.95, texture_size=1024, verbose=False)
        if thumb is None:
            thumb = self._render_thumb(out["gaussian"][0])
        buf = io.BytesIO(); glb.export(buf, file_type="glb")
        return {"glb": buf.getvalue(), "thumb": thumb}

    def _cutout(self, im):
        """배경 제거 — 이미 투명하면 그대로, 아니면 BiRefNet(MIT). TRELLIS 기본(u2net)은 검은·복잡한 배경을 자주 못 뗀다"""
        im = im.convert("RGBA")
        import numpy as np
        a = np.array(im)[:, :, 3]
        if (a < 250).mean() > 0.02:
            return im
        if getattr(self, "bg", None) is None:
            from rembg import new_session
            self.bg = new_session("birefnet-general")
        from rembg import remove
        return remove(im.convert("RGB"), session=self.bg)

    def _render_thumb(self, gaussian) -> bytes | None:
        try:
            from PIL import Image
            from trellis.utils import render_utils
            frames = render_utils.render_video(gaussian, num_frames=1, resolution=512, bg_color=(1, 1, 1))["color"]
            b = io.BytesIO(); Image.fromarray(frames[0]).save(b, "PNG"); return b.getvalue()
        except Exception:
            return None


# FLUX.1-schnell 은 HF 에서 약관 동의(gated)가 필요 — modal secret create vibrex-hf HF_TOKEN=hf_…
@app.cls(image=flux_image, gpu="L40S", volumes={CACHE: cache}, secrets=[modal.Secret.from_name("vibrex-hf")], timeout=600, scaledown_window=120, max_containers=2)
class Flux:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import FluxPipeline
        self.pipe = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-schnell", torch_dtype=torch.bfloat16).to("cuda")
        self.rembg = None
        cache.commit()

    @modal.method()
    def generate(self, prompt: str, n: int = 4, width: int = 1024, height: int = 1024, transparent: bool = False, seed: int | None = None) -> dict:
        import random

        import torch
        seed = seed if seed is not None else random.randint(0, 2**31 - 1)
        imgs = self.pipe(prompt, num_images_per_prompt=max(1, min(n, 4)), width=width, height=height, num_inference_steps=4,
                         guidance_scale=0.0, max_sequence_length=256, generator=torch.Generator("cuda").manual_seed(seed)).images
        out = []
        for im in imgs:
            if transparent:
                if self.rembg is None:
                    from rembg import new_session
                    self.rembg = new_session("isnet-general-use")
                from rembg import remove
                im = remove(im, session=self.rembg)
            b = io.BytesIO(); im.save(b, "WEBP", quality=90); out.append(b.getvalue())
        return {"images": out, "seed": seed}


@app.cls(image=edit_image, gpu="H100", volumes={CACHE: cache}, timeout=900, scaledown_window=120, max_containers=2)
class Volumize:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import QwenImageEditPlusPipeline
        self.pipe = QwenImageEditPlusPipeline.from_pretrained("Qwen/Qwen-Image-Edit-2509", torch_dtype=torch.bfloat16).to("cuda")
        cache.commit()

    @modal.method()
    def edit(self, image_bytes: bytes, hint: str = "") -> bytes:
        import torch
        from PIL import Image
        im = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im); im = bg.convert("RGB")
        prompt = VOLUMIZE + (f" The character is: {hint}." if hint else "")
        out = self.pipe(image=[im], prompt=prompt, negative_prompt=" ", true_cfg_scale=4.0, num_inference_steps=28,
                        guidance_scale=1.0, generator=torch.Generator("cuda").manual_seed(7)).images[0]
        b = io.BytesIO(); out.save(b, "PNG"); return b.getvalue()


@app.function(image=web_image, timeout=1500)
def volumize_then_3d(image_bytes: bytes, hint: str = "", seed: int = 1) -> dict:
    """2D → 입체 렌더 이미지 → TRELLIS. 결과에 입체 렌더 이미지(ref)도 담는다"""
    ref = Volumize().edit.remote(image_bytes, hint)
    r = Trellis().generate.remote("image", ref, "", seed)
    r["ref"] = ref
    return r


@app.function(image=web_image, secrets=[modal.Secret.from_name("vibrex-3d")])
@modal.asgi_app()
def api():
    import base64
    import urllib.request

    from fastapi import FastAPI, Header, HTTPException, Response

    web = FastAPI()

    def auth(token: str | None):
        if not token or token != f"Bearer {os.environ['AUTH_TOKEN']}":
            raise HTTPException(401, "unauthorized")

    @web.post("/submit")
    def submit(body: dict, authorization: str | None = Header(None)):
        auth(authorization)
        if body.get("mode") == "img":  # 이미지 생성
            prompt = str(body.get("prompt") or "")[:1000]
            if not prompt:
                raise HTTPException(400, "prompt required")
            w, h = int(body.get("width") or 1024), int(body.get("height") or 1024)
            w, h = max(256, min(1440, w // 16 * 16)), max(256, min(1440, h // 16 * 16))
            call = Flux().generate.spawn(prompt, int(body.get("n") or 4), w, h, bool(body.get("transparent")), body.get("seed"))
            return {"id": call.object_id}
        mode = "text" if body.get("mode") == "text" else "image"
        img = None
        if mode == "image":
            if body.get("image_b64"):
                img = base64.b64decode(body["image_b64"])
            elif body.get("image_url"):
                img = urllib.request.urlopen(body["image_url"], timeout=30).read()
            if not img or len(img) > 10_000_000:
                raise HTTPException(400, "image required")
        prompt = str(body.get("prompt") or "")[:300]
        if mode == "text" and not prompt:
            raise HTTPException(400, "prompt required")
        if mode == "image" and body.get("volumize"):
            call = volumize_then_3d.spawn(img, str(body.get("hint") or "")[:200], int(body.get("seed") or 1))
        else:
            call = Trellis().generate.spawn(mode, img, prompt, int(body.get("seed") or 1))
        return {"id": call.object_id}

    def result(id: str):
        try:
            return modal.FunctionCall.from_id(id).get(timeout=0)
        except TimeoutError:
            return None

    @web.get("/result/{id}")
    def status(id: str, authorization: str | None = Header(None)):
        auth(authorization)
        try:
            r = result(id)
        except Exception as e:  # 생성 중 오류
            return {"status": "failed", "error": str(e)[:300]}
        if r is None:
            return {"status": "running"}
        if "images" in r:
            return {"status": "done", "images": len(r["images"]), "seed": r.get("seed")}
        return {"status": "done", "glb_bytes": len(r["glb"]), "thumb": bool(r.get("thumb")), "ref": bool(r.get("ref"))}

    @web.get("/result/{id}/{part}")
    def file(id: str, part: str, authorization: str | None = Header(None)):
        auth(authorization)
        r = result(id)
        if r is not None and part.startswith("img") and part[3:].isdigit() and int(part[3:]) < len(r.get("images", [])):
            return Response(r["images"][int(part[3:])], media_type="image/webp")
        if r is None or part not in ("glb", "thumb", "ref") or not r.get(part):
            raise HTTPException(404, "not ready")
        return Response(r[part], media_type="model/gltf-binary" if part == "glb" else "image/png")  # ref·thumb 는 PNG

    return web


@app.function(image=image, timeout=600)
def smoke():
    """GPU 없이 import 만 확인 — python3 -m modal run scripts/modal/trellis3d.py::smoke"""
    from trellis.pipelines import TrellisImageTo3DPipeline, TrellisTextTo3DPipeline  # noqa: F401
    from trellis.utils import postprocessing_utils, render_utils  # noqa: F401
    print("imports ok")
