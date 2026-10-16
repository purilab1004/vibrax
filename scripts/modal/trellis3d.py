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
    .apt_install("git", "libgl1", "libglib2.0-0", "libxrender1", "libsm6", "libxext6", "libgomp1", "build-essential", "ninja-build")
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
    .env({
        "PYTHONPATH": "/trellis", "ATTN_BACKEND": "xformers", "SPCONV_ALGO": "native",
        "HF_HOME": f"{CACHE}/hf", "TORCH_HOME": f"{CACHE}/torch", "U2NET_HOME": f"{CACHE}/u2net",
    })
)

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
            im = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
            pre = self.img.preprocess_image(im)          # 배경 제거·가운데 정렬 → 썸네일로도 쓴다
            b = io.BytesIO(); pre.save(b, "PNG"); thumb = b.getvalue()
            out = self.img.run(pre, preprocess_image=False, **args)
        glb = postprocessing_utils.to_glb(out["gaussian"][0], out["mesh"][0], simplify=0.95, texture_size=1024, verbose=False)
        if thumb is None:
            thumb = self._render_thumb(out["gaussian"][0])
        buf = io.BytesIO(); glb.export(buf, file_type="glb")
        return {"glb": buf.getvalue(), "thumb": thumb}

    def _render_thumb(self, gaussian) -> bytes | None:
        try:
            from PIL import Image
            from trellis.utils import render_utils
            frames = render_utils.render_video(gaussian, num_frames=1, resolution=512, bg_color=(1, 1, 1))["color"]
            b = io.BytesIO(); Image.fromarray(frames[0]).save(b, "PNG"); return b.getvalue()
        except Exception:
            return None


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
        return {"status": "done", "glb_bytes": len(r["glb"]), "thumb": bool(r.get("thumb"))}

    @web.get("/result/{id}/{part}")
    def file(id: str, part: str, authorization: str | None = Header(None)):
        auth(authorization)
        r = result(id)
        if r is None or part not in ("glb", "thumb") or not r.get(part):
            raise HTTPException(404, "not ready")
        return Response(r[part], media_type="model/gltf-binary" if part == "glb" else "image/png")

    return web
