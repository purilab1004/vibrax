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

# 입체화 — 2D 그림을 '3D 로 렌더한 피규어' 이미지로 다시 그린다 (Qwen-Image-Edit-2509, Apache 2.0) → TRELLIS 가 둥근 입체를 만든다
edit_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install("torch==2.6.0", "torchvision==0.21.0", index_url="https://download.pytorch.org/whl/cu124")
    .pip_install("git+https://github.com/huggingface/diffusers", "transformers>=4.51", "accelerate", "sentencepiece", "protobuf", "huggingface_hub[hf_transfer]", "pillow", "rembg", "onnxruntime")
    .env({"HF_HOME": f"{CACHE}/hf", "HF_HUB_ENABLE_HF_TRANSFER": "1", "U2NET_HOME": f"{CACHE}/u2net"})
)
VOLUMIZE = ("Turn this 2D drawing into a high-quality 3D rendered figurine of the same character: rounded volumetric body and head, "
            "soft vinyl toy material, same design, colors, face and proportions, full body, front view, centered, "
            "plain pure white background, soft studio lighting, no outlines, no text.")

# 자동 리깅 — VAST UniRig(MIT): GLB → 뼈대 예측 → 스킨 가중치 → 원본에 합쳐 리깅된 GLB (bpy 4.2 로 입출력)
import subprocess  # noqa: E402
import tempfile  # noqa: E402

UNIRIG = "/UniRig"
rig_image = (
    modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "git-lfs", "libgl1", "libegl1", "libglib2.0-0", "libxrender1", "libxi6", "libxkbcommon0", "libsm6", "libxext6", "libxfixes3", "libxxf86vm1", "libusb-1.0-0", "libgomp1", "build-essential")
    .pip_install("torch==2.3.1", "torchvision==0.18.1", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install("https://github.com/Dao-AILab/flash-attention/releases/download/v2.6.3/flash_attn-2.6.3+cu123torch2.3cxx11abiFALSE-cp311-cp311-linux_x86_64.whl")
    .pip_install("torch_scatter", "torch_cluster", find_links="https://data.pyg.org/whl/torch-2.3.0+cu121.html")
    .pip_install("transformers==4.51.3", "python-box", "einops", "omegaconf", "pytorch_lightning", "lightning", "addict", "timm",
                 "fast-simplification", "bpy==4.2", "trimesh", "open3d", "pyrender", "huggingface_hub", "spconv-cu120", "scipy", "numpy==1.26.4")
    .run_commands(f"GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/VAST-AI-Research/UniRig {UNIRIG}")
    .env({"HF_HOME": "/cache/hf", "PYOPENGL_PLATFORM": "egl"})
)


def _run(cmd: list[str]):
    r = subprocess.run(cmd, cwd=UNIRIG, capture_output=True, text=True)
    if r.returncode != 0 or "Traceback" in (r.stderr or ""):
        raise RuntimeError(f"{' '.join(cmd[:3])} failed:\n{(r.stdout or '')[-1500:]}\n{(r.stderr or '')[-3000:]}")
    return r


def rig_glb(glb: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        src, skel, skin, out = (os.path.join(d, n) for n in ("in.glb", "skeleton.fbx", "skin.fbx", "rigged.glb"))
        open(src, "wb").write(glb)
        _run(["bash", "launch/inference/generate_skeleton.sh", "--input", src, "--output", skel])
        _run(["bash", "launch/inference/generate_skin.sh", "--input", skel, "--output", skin])
        _run(["bash", "launch/inference/merge.sh", "--source", skin, "--target", src, "--output", out])
        if not os.path.exists(out):
            raise RuntimeError("merge produced no output")
        # 움직임 클립을 GLB 안에 굽는다 — 실패해도 뼈대만 있는 GLB 는 돌려준다
        anim = os.path.join(d, "animated.glb")
        open(os.path.join(d, "bake.py"), "w").write(BAKE)
        # Blender 는 드라코 라이브러리 경고 등을 stderr 로 내므로 결과 파일로만 성공을 판단한다
        r = subprocess.run(["python", os.path.join(d, "bake.py"), out, anim], cwd=UNIRIG, capture_output=True, text=True)
        if os.path.exists(anim) and os.path.getsize(anim) > 1000:
            return open(anim, "rb").read()
        print("bake failed:", (r.stdout or "")[-800:], (r.stderr or "")[-1500:])
        return open(out, "rb").read()


# Blender(bpy) 로 뼈대 구조에서 다리·팔·머리를 찾아 idle·walk·run·jump·attack·happy·hit 클립을 키프레임으로 만든다.
# (Blender 는 Z 위, 앞은 -Y) 이름 없는 자동 리깅 뼈(bone_N)라 위치·구조로 판별 — 게임 쪽 THREE.makeAlive 와 같은 규칙
BAKE = r"""
import sys, math, bpy
from mathutils import Vector, Quaternion
src, dst = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
M = arm.matrix_world
B = arm.data.bones
pos = {b.name: M @ b.tail_local for b in B}
leaves = [b for b in B if not b.children]
zs = [M @ b.head_local for b in B] + list(pos.values())   # 뼈 위치로 범위를 잡는다(메시 좌표계는 다를 수 있다)
root = next(b for b in B if b.parent is None)
zmin, zmax = min(v.z for v in zs), max(v.z for v in zs)
xmin, xmax = min(v.x for v in zs), max(v.x for v in zs)
h, w, cx = max(1e-3, zmax - zmin), max(1e-3, xmax - xmin), (M @ root.head_local).x
top = max(leaves, key=lambda b: pos[b.name].z)
low = [b for b in leaves if (pos[b.name].z - zmin) / h < 0.3]
legL = min([b for b in low if pos[b.name].x >= cx] or [None], key=lambda b: pos[b.name].z if b else 0)
legR = min([b for b in low if pos[b.name].x < cx] or [None], key=lambda b: pos[b.name].z if b else 0)
rest = [b for b in leaves if b not in (legL, legR, top) and abs(pos[b.name].x - cx) > w * 0.05]
armL = max([b for b in rest if pos[b.name].x > cx] or [None], key=lambda b: pos[b.name].x if b else 0)
armR = min([b for b in rest if pos[b.name].x < cx] or [None], key=lambda b: pos[b.name].x if b else 0)
def path(b):
    p = []
    while b: p.insert(0, b); b = b.parent
    return p
def after(a, b):
    pa, pb = path(a), path(b) if b else []
    i = 0
    while i < len(pa) and i < len(pb) and pa[i] == pb[i]: i += 1
    return pa[i:]
def chain(a, b, drop=False):
    if not a: return []
    c = after(a, b) if b else path(a)[-2:]
    return c[1:] if drop and len(c) >= 3 else c
LL, LR = chain(legL, legR), chain(legR, legL)
AL, AR = chain(armL, armR or top, True), chain(armR, armL or top, True)
HEAD = [top.parent or top] if top else []
SPINE = [b for b in path(top)[:3]] if top else []
PB = arm.pose.bones
def q(bone, axis, ang):
    loc = (M.to_3x3() @ bone.matrix_local.to_3x3()).inverted() @ Vector(axis)
    return Quaternion(loc.normalized(), ang)
FPS = 30
bpy.context.scene.render.fps = FPS
def clip(name, seconds, fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    n = max(2, int(seconds * FPS))
    for f in range(n + 1):
        t = f / n
        poses = fn(t)
        for b in B:
            pb = PB[b.name]; pb.rotation_mode = 'QUATERNION'
            r = Quaternion()
            for (bone, axis, ang) in poses.get(b.name, []): r = q(bone, axis, ang) @ r
            pb.rotation_quaternion = r
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
    tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act)
    arm.animation_data.action = None
def put(d, bones, axis, ang, idx=0):
    if len(bones) > idx: d.setdefault(bones[idx].name, []).append((bones[idx], axis, ang))
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
def gait(sw, knee):
    def fn(t):
        s = math.sin(t * 2 * math.pi); d = {}
        put(d, LL, X, -s * sw); put(d, LR, X, s * sw)
        put(d, LL, X, max(0, s) * knee, 1); put(d, LR, X, max(0, -s) * knee, 1)
        put(d, AL, X, s * sw * 0.8); put(d, AR, X, -s * sw * 0.8)
        for sp in SPINE[1:2]: put(d, [sp], Z, s * 0.06)
        return d
    return fn
def idle(t):
    s = math.sin(t * 2 * math.pi); d = {}
    put(d, HEAD, Z, s * 0.15); put(d, AL, X, s * 0.05); put(d, AR, X, -s * 0.05)
    for sp in SPINE[1:2]: put(d, [sp], X, s * 0.03)
    return d
def jump(t):
    e = math.sin(t * math.pi); d = {}
    put(d, LL, X, -0.5 * e); put(d, LR, X, -0.5 * e); put(d, LL, X, 0.9 * e, 1); put(d, LR, X, 0.9 * e, 1)
    put(d, AL, Y, -1.4 * e); put(d, AR, Y, 1.4 * e)
    return d
def attack(t):
    e = math.sin(min(1, t * 1.6) * math.pi); d = {}
    put(d, AR, X, -1.9 * e); put(d, AL, X, 0.3 * e)
    for sp in SPINE[1:2]: put(d, [sp], Z, -0.25 * e)
    return d
def happy(t):
    e = abs(math.sin(t * 2 * math.pi)); d = {}
    put(d, AL, Y, -2.2 * e); put(d, AR, Y, 2.2 * e); put(d, HEAD, X, -0.15 * e)
    return d
def hit(t):
    e = math.sin(t * math.pi) * (1 - t * 0.5); d = {}
    put(d, HEAD, X, 0.4 * e); put(d, AL, Y, -0.6 * e); put(d, AR, Y, 0.6 * e)
    for sp in SPINE[1:2]: put(d, [sp], X, 0.25 * e)
    return d
clip('idle', 2.4, idle); clip('walk', 0.9, gait(0.5, 0.7)); clip('run', 0.55, gait(0.85, 1.1))
clip('jump', 0.8, jump); clip('attack', 0.5, attack); clip('happy', 0.9, happy); clip('hit', 0.45, hit)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True)
print('baked', [a.name for a in bpy.data.actions])
"""


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
        # TRELLIS 는 metallicFactor 를 비워 둔다 → glTF 기본값 1(완전 금속)이라 게임·뷰어에서 색이 검게 죽는다 → 비금속으로
        for geom in getattr(glb, "geometry", {glb: glb}).values():
            mat = getattr(getattr(geom, "visual", None), "material", None)
            if mat is not None and hasattr(mat, "metallicFactor"):
                mat.metallicFactor = 0.0
                mat.roughnessFactor = 0.85
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


# 이미지 생성 — Qwen-Image (Apache 2.0, gated 아님, 한국어·영어 프롬프트 이해). AI 이미지와 글 → 3D 의 첫 단계에 쓴다
FIGURE = ("A high-quality 3D rendered figurine of {p}. Full body, single character, front view, standing, centered, "
          "rounded volumetric shapes, soft vinyl toy material, plain pure white background, soft studio lighting, no text.")


@app.cls(image=edit_image, gpu="H100", volumes={CACHE: cache}, timeout=900, scaledown_window=120, max_containers=2)
class QwenImage:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import DiffusionPipeline
        self.pipe = DiffusionPipeline.from_pretrained("Qwen/Qwen-Image", torch_dtype=torch.bfloat16).to("cuda")
        self.bg = None
        cache.commit()

    @modal.method()
    def generate(self, prompt: str, n: int = 4, width: int = 1024, height: int = 1024, transparent: bool = False, seed: int | None = None, fmt: str = "WEBP") -> dict:
        import random

        import torch
        seed = seed if seed is not None else random.randint(0, 2**31 - 1)
        out = []
        for i in range(max(1, min(n, 4))):
            im = self.pipe(prompt=prompt, negative_prompt=" ", width=width, height=height, num_inference_steps=30, true_cfg_scale=4.0,
                           generator=torch.Generator("cuda").manual_seed(seed + i)).images[0]
            if transparent:
                if self.bg is None:
                    from rembg import new_session
                    self.bg = new_session("isnet-general-use")
                from rembg import remove
                im = remove(im, session=self.bg)
            b = io.BytesIO(); im.save(b, fmt, **({"quality": 90} if fmt == "WEBP" else {})); out.append(b.getvalue())
        return {"images": out, "seed": seed}


@app.cls(image=rig_image, gpu="A10G", volumes={"/cache": cache}, timeout=900, scaledown_window=120, max_containers=2)
class Rigger:
    @modal.method()
    def rig(self, glb: bytes) -> dict:
        out = rig_glb(glb)
        cache.commit()
        return {"glb": out}


@app.function(image=web_image, timeout=1500)
def text_then_3d(prompt: str, seed: int = 1, rig: bool = False) -> dict:
    """글 → 피규어 렌더 이미지(Qwen-Image) → TRELLIS (→ 자동 리깅). TRELLIS 자체 글→3D 는 짧은 영어만 알아들어 설명과 다른 모양이 나온다"""
    ref = QwenImage().generate.remote(FIGURE.format(p=prompt), 1, 1024, 1024, False, seed, "PNG")["images"][0]
    r = Trellis().generate.remote("image", ref, "", seed)
    r["ref"] = ref
    return _maybe_rig(r, rig)


def _maybe_rig(r: dict, rig: bool) -> dict:
    """뼈대·움직임 클립까지 — 실패하면(사람·동물 모양이 아닌 경우 등) 움직임 없는 모델을 그대로 돌려준다"""
    if not rig:
        return r
    try:
        r["glb"] = Rigger().rig.remote(r["glb"])["glb"]
        r["rigged"] = True
    except Exception as e:  # noqa: BLE001
        print("rig failed:", str(e)[:500])
        r["rigged"] = False
    return r


@app.function(image=web_image, timeout=1500)
def image_then_3d(image_bytes: bytes, seed: int = 1, rig: bool = False) -> dict:
    return _maybe_rig(Trellis().generate.remote("image", image_bytes, "", seed), rig)


@app.function(image=web_image, timeout=1500)
def volumize_then_3d(image_bytes: bytes, hint: str = "", seed: int = 1, rig: bool = False) -> dict:
    """2D → 입체 렌더 이미지 → TRELLIS. 결과에 입체 렌더 이미지(ref)도 담는다"""
    ref = Volumize().edit.remote(image_bytes, hint)
    r = Trellis().generate.remote("image", ref, "", seed)
    r["ref"] = ref
    return _maybe_rig(r, rig)


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
        if body.get("mode") == "rig":  # 자동 리깅
            glb = base64.b64decode(body["glb_b64"]) if body.get("glb_b64") else urllib.request.urlopen(str(body.get("glb_url")), timeout=60).read()
            if not glb or len(glb) > 40_000_000:
                raise HTTPException(400, "glb required")
            call = Rigger().rig.spawn(glb)
            return {"id": call.object_id}
        if body.get("mode") == "img":  # 이미지 생성
            prompt = str(body.get("prompt") or "")[:1000]
            if not prompt:
                raise HTTPException(400, "prompt required")
            w, h = int(body.get("width") or 1024), int(body.get("height") or 1024)
            w, h = max(256, min(1440, w // 16 * 16)), max(256, min(1440, h // 16 * 16))
            call = QwenImage().generate.spawn(prompt, int(body.get("n") or 4), w, h, bool(body.get("transparent")), body.get("seed"))
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
        if mode == "text":
            call = text_then_3d.spawn(prompt, int(body.get("seed") or 1), bool(body.get("rig")))
        elif mode == "image" and body.get("volumize"):
            call = volumize_then_3d.spawn(img, str(body.get("hint") or "")[:200], int(body.get("seed") or 1), bool(body.get("rig")))
        else:
            call = image_then_3d.spawn(img, int(body.get("seed") or 1), bool(body.get("rig")))
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
        return {"status": "done", "glb_bytes": len(r["glb"]), "thumb": bool(r.get("thumb")), "ref": bool(r.get("ref")), "rigged": r.get("rigged")}

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
